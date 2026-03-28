import { ReactNode } from 'react';
import { ConversationSidebar } from '@/components/sidebar/conversation-sidebar';
import { ChatHeader } from '@/components/header/chat-header';

interface Conversation {
  id: string;
  title: string;
  date: string;
}

interface ChatLayoutProps {
  children: ReactNode;
  conversations?: Conversation[];
  activeConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
  currentTitle?: string;
  onDeleteConversation?: () => void;
}

export function ChatLayout({
  children,
  conversations = [],
  activeConversationId,
  onSelectConversation = () => {},
  onNewChat = () => {},
  currentTitle,
  onDeleteConversation,
}: ChatLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={onSelectConversation}
        onNewChat={onNewChat}
      />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <ChatHeader title={currentTitle} onDelete={onDeleteConversation} />

        {/* Chat Content */}
        {children}
      </div>
    </div>
  );
}
