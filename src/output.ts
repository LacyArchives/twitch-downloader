import logUpdate from "log-update";

export interface VODUpdate {
  type: "VOD_UPDATE";
  identifier: number;
  totalFrames: number;
  frame: number;
  reset?: boolean;
}

export interface ChatUpdate {
  type: "CHAT_UPDATE";
  messages: number;
}

export interface Payload {
  event: VODUpdate | ChatUpdate;
}

let frameHolder: number[] = [];
let oldSum = 0;
let messageCount = -1;
let totalFrames = 0;
const startTime = Date.now();

const sum = (array: number[]): number => array.reduce((p, c) => p + c, 0);

export const start = (chat: boolean) => {
  if (chat) messageCount = 0;

  setInterval(() => {
    logUpdate(
      `Current Time: ${formatTime(sum(frameHolder) / 60)} (${
        Math.floor((sum(frameHolder) / totalFrames) * 10000) / 100 || 0
      }%) FPS: ${sum(frameHolder) - oldSum} Total Time: ${formatTime(
        totalFrames / 60,
      )} Speed: ${Math.floor(
        ((sum(frameHolder) / 60 / ((Date.now() - startTime) / 1000)) * 100) /
          100,
      )}x${
        messageCount > -1
          ? messageCount === 0
            ? ` Messages: Bypassing Anti Bot..`
            : ` Messages: ${messageCount}`
          : ""
      } Elapsed Time: ${formatTime((Date.now() - startTime) / 1000)}`,
    );
    oldSum = sum(frameHolder);
  }, 1000);
};

const formatTime = (time: number): string =>
  `${Math.floor(time / 60 / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(time / 60 - 60 * Math.floor(time / 60 / 60))
    .toString()
    .padStart(2, "0")}:${Math.floor(time - 60 * Math.floor(time / 60))
    .toString()
    .padStart(2, "0")}`;

export const logEvent = (payload: Payload) => {
  if (payload.event.type === "VOD_UPDATE") {
    if (payload.event.reset) {
      frameHolder = [];
      return;
    }
    frameHolder[payload.event.identifier] = payload.event.frame;
    totalFrames = payload.event.totalFrames;
  } else if (payload.event.type === "CHAT_UPDATE") {
    messageCount = payload.event.messages;
  }
};
