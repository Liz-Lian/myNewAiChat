import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  console.log('API Key exists:', !!process.env.SILICONFLOW_API_KEY);
  console.log(
    'API Key preview:',
    process.env.SILICONFLOW_API_KEY?.slice(0, 10) + '...',
  );
  try {
    const { messages } = await req.json();

    // 1. 调用硅基流动 API
    const response = await fetch(
      'https://api.siliconflow.cn/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'Qwen/Qwen3-8B',
          messages: messages,
          stream: true, // 必须开启流式
        }),
        signal: req.signal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log('=== Siliconflow API Error ===');
      console.log('Status:', response.status);
      console.log('Error response:', errorText);
      return NextResponse.json(
        { error: `AI 接口调用失败: ${response.status}`, details: errorText },
        { status: response.status },
      );
    }

    // 2. 将硅基流动的 ReadableStream 直接返回给前端
    // 这就是“转发”，你的后端像一根水管，水从硅基流进来，直接流向前端
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }

    console.error('Chat Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
