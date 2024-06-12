import yargs from "yargs";
import { hideBin } from "yargs/helpers";
// import { downloadVod } from "./DownloadVod";
import { log } from "./logger";
import { downloadChat } from "./DownloadChat";
import { start } from "./output";
import { downloadVod } from "./DownloadVod";

const args = await yargs(hideBin(process.argv))
  .option("video_id", {
    alias: "id",
    describe: "The ID of the video to download",
    type: "string",
    demandOption: true,
  })
  .option("name", {
    alias: "n",
    describe: "The name of the streamer from the Video ID",
    type: "string",
    demandOption: true,
  })
  .option("download_chat", {
    alias: "chat",
    type: "boolean",
    description:
      "If the script should download the chat logs from the video as well. Requires optional dependencies.",
    default: false,
  })
  .option("chunks", {
    alias: "c",
    describe:
      "The amount of FFMPEG chunks to split the vod into. More chunks = More processing power",
    type: "number",
    default: 3,
  })
  .option("encoding", {
    alias: "e",
    type: "string",
    description:
      "The encoding to download from Twitch. Options: av1, h264. (h264 is a mp4 encoding). Note: h264 is dramatically bigger and slower to combine together compared to av1 (MPEG-2 Transport encoding). Please also change the extension to mp4 using --ext mp4",
    default: "av1",
  })
  .option("ffmpeg_args", {
    alias: "args",
    describe:
      "Specify FFMPEG args to be added in the 'middle' of each chunk command, after the input and before the output. These allow you to set custom encoding settings. Note: It is drastically slower to transcode video then to leave it alone, so you might want to consider leaving it in MPEG-2. Example custom encoding: -preset fast -c:v h264_nvenc. Note that if you change the output encoding format of the file you MUST use the --extension argument to change the extension of the file. For optimal performance while transcoding, please consider lowering chunks.",
    default: "-c copy",
    defaultDescription:
      "-c copy, Leaves it in MPEG-2 Transport format. Perfect if you're going to re-encode the video after through a video editing software.",
  })
  .option("extension", {
    alias: "ext",
    type: "string",
    describe:
      "The extension on the file of each chunk and the final video. Must be specified if your specified ffmpeg args change the extension of the file from ts. Note: You do not add the leading dot.",
    default: "ts",
  })
  .option("resolution", {
    alias: "res",
    describe:
      "The resolution to download the video at Ex. 1920x1080. Defaults to the highest if option is not available",
    type: "string",
    default: "1920x1080",
  })

  .parse();

const promises: Promise<void>[] = [];

const id = URL.canParse(args.video_id)
  ? /(\d{8,})/.exec(args.video_id)
    ? Number(/(\d{8,})/.exec(args.video_id)![0])
    : 0
  : Number(args.video_id) ?? 0;

if (!id) {
  log.error(`Video ID not specified correctly! Run --help for help.`);
  process.exit();
}

if (!args.name) {
  log.error(`Name not specified correctly! Run -h for help.`);
  process.exit();
}

promises.push(
  downloadVod(
    args.name,
    id,
    args.resolution,
    args.chunks,
    args.ffmpeg_args,
    args.extension,
    args.encoding,
  ),
);

if (args.download_chat) {
  promises.push(downloadChat(id));
}

start(args.download_chat);

await Promise.all(promises);
log.info(`Finished downloading VOD and Chat!`);
process.exit();
