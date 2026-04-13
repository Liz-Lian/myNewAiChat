This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.


## Voice features

The chat UI now supports SiliconFlow-powered voice playback and speech input.

### Environment variables

Add these server-side variables to your local env file:

```bash
SILICONFLOW_API_KEY=...
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_TTS_MODEL=FunAudioLLM/CosyVoice2-0.5B
SILICONFLOW_STT_MODEL=FunAudioLLM/SenseVoiceSmall
SILICONFLOW_TTS_VOICE=default
SILICONFLOW_TTS_RESPONSE_FORMAT=mp3
SILICONFLOW_TTS_SAMPLE_RATE=24000
SILICONFLOW_TTS_SPEED=1
SILICONFLOW_TTS_GAIN=1
```

### Usage

- To record speech, click **开始录音** in the input area, speak, then click **停止录音**. The transcription is filled back into the text box for editing before sending.
- To listen to an AI reply, click **朗读** beside the assistant message. You can then pause or stop playback while it is playing.
- If the browser does not support recording, the input area shows a downgrade notice and the app still works with text input.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
