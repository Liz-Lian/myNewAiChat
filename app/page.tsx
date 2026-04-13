'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useChatStore } from '@/app/features/chat/store/useChatStore';
import { ChatLayout } from '@/components/layouts/chat-layout';
import { MessageList } from '@/app/features/chat/components/MessageList';
import { MessageInput } from '@/app/features/chat/components/MessageInput';

export default function Home() {
  const {
    messages,
    sendMessage,
    retryLastMessage,
    stopGeneration,
    clearConversation,
    isLoading,
    error,
  } = useChatStore();
  const [conversations] = useState([
    { id: '1', title: '如何学习 TypeScript', date: '今天' },
    { id: '2', title: 'Next.js 最佳实践', date: '昨天' },
    { id: '3', title: 'React 性能优化', date: '3 天前' },
    { id: '4', title: '数据库设计方案', date: '一周前' },
  ]);
  const [activeConversationId, setActiveConversationId] = useState('1');

  const handleSendMessage = (content: string) => {
    if (!content.trim() || isLoading) return;
    sendMessage(content);
  };

  useEffect(() => stopGeneration, [stopGeneration]);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  );

  return (
    <ChatLayout
      conversations={conversations}
      activeConversationId={activeConversationId}
      onSelectConversation={setActiveConversationId}
      onNewChat={() => {
        clearConversation();
        toast.success('已开启新对话');
      }}
      currentTitle={activeConversation?.title || '新对话'}
      onDeleteConversation={() => {
        clearConversation();
        toast.success('对话已清空');
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        <MessageList messages={messages} isLoading={isLoading} />
        <MessageInput
          onSend={handleSendMessage}
          onStop={stopGeneration}
          onRetry={retryLastMessage}
          disabled={isLoading}
          error={error}
        />
      </div>
    </ChatLayout>
  );
}
