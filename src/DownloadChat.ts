import { request } from "undici";
import { log } from "./logger";
import { writeFile } from "fs/promises";
import { logEvent, type Payload } from "./output";

interface Message {
  badges: string[];
  color: string;
  displayName: string;
  emotes: string[];
  content: string;
  timestamp: Date;
}

interface RawGQLChat {
  cursor: string;
  node: {
    id: string;
    commenter?: {
      id: string;
      login: string;
      displayName: string;
    };
    contentOffSeconds: number;
    createdAt: string;
    message: {
      fragments: {
        text: string;
      }[];
      userBadges: {
        id: string;
        setID: string;
        version: string;
      }[];
      userColor: string;
    };
  };
}

interface RawGQLChatPayload {
  data: {
    video: {
      id: string;
      comments: {
        edges: RawGQLChat[];
        pageInfo: {
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
      };
    };
  };
}

let totalChatMessages = 0;

export const downloadChat = async (videoId: number) => {
  let solver: any;
  let browser: any;

  try {
    // @ts-ignore - im not writing types for this project
    const Solver = (await import("kpsdk-solver")).default;

    const { firefox } = await import("playwright");
    browser = firefox;

    solver = new Solver({
      "load-complete": true, // default

      "sdk-script": {
        url: "https://gql.twitch.tv/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/ips.js",
      },
      url: `https://www.twitch.tv/videos/${videoId}`,
    });
  } catch (e) {
    log.error(
      `Playwright or KPSDK-Solver is not installed, chat download will be ignored.`,
      e,
    );
    return;
  }
  let startTime: Date | null = null;

  const messages: Message[] = [];

  // no public kasada bypass from me, takes around ~30 seconds to bypass with playwright

  const playwright = await browser.launch({ headless: true });
  const context = await playwright.newContext();

  const page = await solver.create(context);

  const routeAndRequest = await page.solver.fetch("https://gql.twitch.tv/gql");

  await routeAndRequest.route.abort();

  const headers = routeAndRequest.request.headers();
  const token = headers["client-integrity"];
  const clientId = headers["client-id"];
  const deviceId = headers["x-device-id"];

  await page.close();
  await context.close();
  await playwright.close();

  const fetchMessages = async (cursor?: string): Promise<void> => {
    const variables = { videoID: videoId.toString() } as any;
    if (cursor) variables.cursor = cursor;
    else variables.contentOffsetSeconds = 0;

    const query = (await request("https://gql.twitch.tv/gql", {
      headers: {
        "Client-Id": clientId,
        "X-Device-Id": deviceId,
        "Client-Integrity": token,
      },
      method: "POST",
      body: JSON.stringify([
        {
          operationName: "VideoCommentsByOffsetOrCursor",
          variables,
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash:
                "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a",
            },
          },
        },
      ]),
    }).then((r) => r.body.json())) as RawGQLChatPayload[];

    if (!startTime) {
      const { node } = query[0].data.video.comments.edges[0];
      startTime = new Date(
        new Date(node.createdAt).getTime() - node.contentOffSeconds * 1000,
      );
    }

    for (const { node } of query[0].data.video.comments.edges.filter(
      (n) => n.node.commenter,
    )) {
      messages.push({
        badges: node.message.userBadges.map((b) => `${b.setID}/${b.version}`),
        color: node.message.userColor,
        content: node.message.fragments.map((f) => f.text).join(" "),
        displayName: node.commenter!.displayName,
        emotes: [],
        timestamp: new Date(node.createdAt),
      });
      totalChatMessages++;
      logEvent({
        event: {
          type: "CHAT_UPDATE",
          messages: totalChatMessages,
        },
      } as Payload);
    }

    if (query[0].data.video.comments.pageInfo.hasNextPage) {
      return fetchMessages(query[0].data.video.comments.edges[0].cursor);
    }
  };

  await fetchMessages();

  await writeFile(
    `./output/${videoId}.json`,
    JSON.stringify({
      startTime,
      badges: [],
      messages,
    }),
  );
};
