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
    <div className="text-foreground flex min-h-screen overflow-hidden bg-transparent">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={onSelectConversation}
        onNewChat={onNewChat}
      />

      <div className="border-border/40 bg-background/75 flex min-h-0 flex-1 flex-col overflow-hidden border-l shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-2xl">
        <ChatHeader title={currentTitle} onDelete={onDeleteConversation} />

        {children}
      </div>
    </div>
  );
}
