import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <ScrollArea className="flex-1 bg-white">
      <div className="space-y-4 p-6">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-slate-400">
              <div className="mb-2 text-4xl">💬</div>
              <p className="text-sm">开始聊天吧！</p>
            </div>
          </div>
        ) : (
          messages.map((message, idx) => (
            <div
              key={message.id || idx}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                <p className="word-break text-sm whitespace-pre-wrap">
                  {message.content}
                </p>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-slate-100 px-4 py-3">
              <div className="flex gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 delay-100" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
