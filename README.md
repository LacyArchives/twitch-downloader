# Twitch Downloader
Rapid Twitch CLI VOD Downloader.

## Manual Installation (Git)
### Requirements
- [Node.js](https://nodejs.org/en/download/package-manager) v21 or later
- [Yarn](https://yarnpkg.com/)
### Steps
- Clone with `git clone https://github.com/LacyArchives/twitch-downloader`
- If you plan on downloading chat, install all dependencies using `yarn install`, otherwise feel free to skip playwright installation (can cause issues on some systems) using `yarn install --ignore-optional`
- Build with `yarn build` and start using `yarn start`

# Usage
You have to pass in 2 arguments minimum to the program: the Video ID you're trying to download, and the name.
Ex command: `yarn start --id 2169890378 --name Lacy`

This will assume defaults for all other arguments and begin downloading at 3 chunks. Note that you can run `yarn start --help` to get a list of all arguments available.

If you have a good PC and have good internet, you may want to consider upping the chunks argument (default is 3) to download more chunks in parallel leading to faster results.

By default, the bot downloads in 3 chunks leaving it in Twitch's format (av1; MPEG-2 Transport) and then combines them together into one .ts file. This is extremely fast, and if you plan on editing the video at all or just straight uploading to designated platform, or you just want some segments of the video, this is the fastest option because the editing software will re-encode the video anyway. 

If you *need* it to be in another format, say h264 MP4, you have 2 main ways:
- Straight from Twitch:
    - Twitch allows you to download in h264 encoding. Ex: `yarn start --id 2169890378 --name Lacy -e h264 --ext mp4`
- Transcode av1 -> h264 using custom ffmpeg args
    - Ex:
`yarn start --id 2169890378 --name Lacy --ffmpeg_args -v:c h264_nvenc --ext mp4` (I've seen higher performance through transcoding to h264_nvenc compared to downloading h264 from Twitch. Your experience may vary with your components.)

*h264_nvenc is intended for Nvidia GPUs and enables hardware acceleration, depending on your specifications you may want to opt for h264 or a similar format which encodes it through your CPU, note that arguments are provided to ffmpeg after the input command and before the output file.*

*Note: ffmpeg_args adds the args to each chunk rather then the final combine command (which just copies) as it typically yields the highest performance, so you may want to lower chunks to yield the most optimal performance.*

This took me from 5.9k fps to ~2k fps, only use it if you actually need it.

## Chat
Assuming you haven't chosen to not download the optional dependencies, you can download chat by passing `--chat`.

To download chat it makes use of the [playwright](https://playwright.dev/) project which allows you to automate browser interactions. Please see their website for help installing the package if you have any issues.

It downloads chat in a specific format that allows for you to replay chat messages in real time, for information on this format, try it out or check [DownloadChat.ts](https://github.com/LacyArchives/twitch-downloader/tree/main/src/DownloadChat.ts).

*Note: In this format, timestamps are all relative to the time the bot starts downloading messages. This can be used to calculate message offsets to figure out how long into the stream a message was sent, but can not be used to find the original timestamps.*