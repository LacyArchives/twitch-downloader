import { request } from "undici";
import { log } from "./logger";
import { mkdir, rm, rmdir } from "fs/promises";
import { type ChildProcess, exec } from "node:child_process";
import { logEvent, type Payload } from "./output";

process.on("SIGINT", () => {
  log.info(`Closing all FFMPEG processes before closing..`);
  for (const process of processes) {
    process.kill();
  }
  process.exit();
});

const fetchDefaultTokens = async () => {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Sec-GPC": "1",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };

  const response = await request("https://www.twitch.tv/", {
    headers,
  });

  const cookieString = response.headers["set-cookie"] as string[] | undefined;

  if (!cookieString)
    throw new Error("Set-Cookie string not found; likely blocked by twitch");

  const deviceId = cookieString[1].split("=")[1].split(";")[0];

  const html = await response.body.text();

  const clientId = html.split('clientId="')[1].split('"')[0];

  return { clientId, deviceId };
};

const fetchGqlVideoAccessToken = async (name: string, vodId: number) => {
  const headers: any = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US",
    "Content-Type": "text/plain; charset=UTF-8",
    "Sec-GPC": "1",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    referrer: "https://www.twitch.tv/",
  };

  const { clientId, deviceId } = await fetchDefaultTokens();

  headers["X-Device-ID"] = deviceId;
  headers["Client-ID"] = clientId;

  const body = {
    operationName: "PlaybackAccessToken_Template",
    query:
      'query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!) {  streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {    value    signature   authorization { isForbidden forbiddenReasonCode }   __typename  }  videoPlaybackAccessToken(id: $vodID, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) {    value    signature   __typename  }}',
    variables: {
      isLive: vodId ? false : true,
      login: name,
      isVod: vodId ? true : false,
      vodID: vodId ? vodId.toString() : "",
      playerType: "site",
    },
  };

  const response = await request("https://gql.twitch.tv/gql", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const payload = (await response.body.json()) as any;

  return payload;
};

const processes: ChildProcess[] = [];

const formatTime = (time: number): string =>
  `${Math.floor(time / 60 / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(time / 60 - 60 * Math.floor(time / 60 / 60))
    .toString()
    .padStart(2, "0")}:${Math.floor(time - 60 * Math.floor(time / 60))
    .toString()
    .padStart(2, "0")}`;

export const downloadVod = async (
  name: string,
  id: number,
  resolution: string,
  chunks: number,
  ffmpegArgs: string,
  extension: string,
  encoding: string,
): Promise<void> => {
  return new Promise(async (res) => {
    const payload = await fetchGqlVideoAccessToken(name, id);

    const { clientId, deviceId } = await fetchDefaultTokens();

    if (!payload || !clientId || !deviceId)
      return void log.error(
        `Failed to download vod! One or more default variables are undefined! Blocked by twitch?`,
      );

    const params = {
      acmb: "e30=",
      allow_source: true,
      browser_family: "firefox",
      browser_version: "123.0",
      cdm: "wv",
      fast_bread: true,
      os_name: "Linux",
      os_version: undefined,
      p: Math.floor(Math.random() * 9_000_000 + 1_000_000),
      platform: "web",
      player_backend: "mediaplayer",
      player_version: "1.28.0-rc.2",
      playlist_include_framerate: true,
      reassignments_supported: true,
      // av1 is drastically smaller while still retaining high quality
      // if this breaks for some reason, twitch also officially supports h264
      supported_codecs: encoding,
      transcode_mode: "cbr_v1",
      sig: payload.data.videoPlaybackAccessToken.signature,
      token: payload.data.videoPlaybackAccessToken.value,
    };

    const lines = await request(
      `https://usher.ttvnw.net/vod/${id}?${Object.entries(params)
        .map((o) => `${o[0]}=${encodeURIComponent(o[1] as string)}`)
        .join("&")}`,
    )
      .then((r) => r.body.text())
      .then((r) => r.split("\n"));

    if (!lines.find((s) => s.includes("EXT-X-STREAM")))
      return log.error(`Failed to fetch m3u8 file!`);
    let link =
      lines[
        lines.findIndex(
          // attempts to find config resolution on stream
          (s: string) =>
            s.includes("EXT-X-STREAM") && resolution && s.includes(resolution),
        ) + 1
      ];
    if (link === "#EXTM3U") {
      link =
        lines[
          lines.findIndex(
            // if it can't find it, just look for the first stream link in there and hope it's good enough
            (s: string) => s.includes("EXT-X-STREAM"),
          ) + 1
        ];
    }

    const segmentsFile = await request(link)
      .then((r) => r.body.text())
      .then((r) => r.split("\n"));

    // fastest way to do this by far is by splitting it up through ffmpeg and letting it download and transcode the vod

    await mkdir(`./output/tmp/${id}`, {
      recursive: true,
    });

    const vodLength = Number(segmentsFile[7].split(":")[1]);

    // split it up n ways

    const promises: Promise<void>[] = [];

    for (let i = 0; i < chunks; i++) {
      promises.push(
        new Promise((res) => {
          const command = `ffmpeg -y -ss ${formatTime(
            (vodLength / chunks) * i,
          )} -t ${formatTime(
            vodLength / chunks,
          )} -i ${link} ${ffmpegArgs} output/tmp/${id}/${i}.${extension}`;
          //   log.debug(`Running ffmpeg command ${command}`);
          const pwd = exec(command);
          processes.push(pwd);
          pwd.stderr?.on("data", (data) => {
            if (!data.toString().includes("frame=")) return;

            const frame = Number(
              data.toString().split("frame=")[1].split("fps=")[0],
            );

            logEvent({
              event: {
                identifier: i,
                frame,
                totalFrames: vodLength * 60,
                type: "VOD_UPDATE",
              },
            } as Payload);
          });

          pwd.on("exit", () => res());
        }),
      );
    }

    await Promise.allSettled(promises);

    // merge all files into one

    log.info(`All segments finished downloading.. Merging into one file`);
    console.log();

    logEvent({
      event: {
        type: "VOD_UPDATE",
        reset: true,
        frame: 0,
        identifier: 0,
        totalFrames: 0,
      },
    });

    const concatStrings = [];
    for (let i = 0; i < chunks; i++) {
      concatStrings.push(`output/tmp/${id}/${i}.${extension}`);
    }

    const pwd = exec(
      `ffmpeg -y -i "concat:${concatStrings.join(
        "|",
      )}" -c copy output/${id}.${extension}`,
    );

    processes.push(pwd);

    pwd.stderr?.on("data", (data) => {
      if (!data.toString().includes("frame=")) return;

      const frame = Number(data.toString().split("frame=")[1].split("fps=")[0]);

      logEvent({
        event: {
          identifier: 0,
          frame,
          totalFrames: vodLength * 60,
          type: "VOD_UPDATE",
        },
      } as Payload);
    });

    pwd.on("exit", async () => {
      // cleanup

      await rm(`./output/tmp/${id}/`, {
        recursive: true,
        force: true,
      });

      // remove directory if empty
      await rmdir(`./output/tmp/`).catch(() => {});
      res();
    });
  });
};
