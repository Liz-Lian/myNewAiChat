'use client';
import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import {
  shareConversation,
  unshareConversation,
} from '@/app/features/chat/services/conversationService';
import { useChatStore } from '@/app/features/chat/store/useChatStore';
import { ChatLayout } from '@/components/layouts/chat-layout';
import { MessageList } from '@/app/features/chat/components/MessageList';
import { MessageInput } from '@/app/features/chat/components/MessageInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function Home() {
  const [manualShareUrl, setManualShareUrl] = useState<string | null>(null);
  const [manualShareCopied, setManualShareCopied] = useState(false);
  const {
    messages,
    currentConversationId,
    conversations,
    conversationsLoading,
    loadConversations,
    createNewConversation,
    switchConversation,
    deleteConversation,
    updateConversationTitle,
    sendMessage,
    retryLastMessage,
    stopGeneration,
    isGenerating,
    isLoading,
    error,
  } = useChatStore();

  const handleSendMessage = (content: string) => {
    if (!content.trim() || isLoading) return;
    sendMessage(content);
  };

  const handleNewChat = async () => {
    await createNewConversation();
    toast.success('已开启新对话');
  };

  const handleDeleteConversation = async (id: string | null) => {
    if (!id) return;

    const confirmed = window.confirm('确定删除这个会话吗？此操作不可恢复。');
    if (!confirmed) return;

    await deleteConversation(id);
    toast.success('会话已删除');
  };

  const handleRenameConversation = async (id: string, title: string) => {
    await updateConversationTitle(id, title);
    toast.success('会话标题已更新');
  };

  const copyShareUrl = async (shareUrl: string) => {
    if (!navigator.clipboard?.writeText) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      return true;
    } catch {
      return false;
    }
  };

  const handleShareConversation = async () => {
    if (!currentConversationId) return;

    try {
      const result = await shareConversation(currentConversationId);
      await loadConversations();
      const copied = await copyShareUrl(result.shareUrl);

      if (copied) {
        toast.success('分享链接已复制');
        return;
      }

      setManualShareUrl(result.shareUrl);
      setManualShareCopied(false);
      toast.warning('分享链接已生成，请手动复制');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成分享链接失败');
    }
  };

  const handleManualCopyShareUrl = async () => {
    if (!manualShareUrl) return;

    const copied = await copyShareUrl(manualShareUrl);
    if (!copied) {
      toast.error('复制失败，请选中链接后手动复制');
      return;
    }

    setManualShareCopied(true);
    toast.success('分享链接已复制');
  };

  const handleCancelShare = async () => {
    if (!currentConversationId) return;

    try {
      await unshareConversation(currentConversationId);
      await loadConversations();
      toast.success('已取消分享');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '取消分享失败');
    }
  };

  useEffect(() => stopGeneration, [stopGeneration]);
  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === currentConversationId,
  );

  return (
    <ChatLayout
      conversations={conversations}
      activeConversationId={currentConversationId || undefined}
      conversationsLoading={conversationsLoading}
      onSelectConversation={(id) => {
        void switchConversation(id);
      }}
      onNewChat={() => {
        void handleNewChat();
      }}
      onRenameConversation={(id, title) => {
        void handleRenameConversation(id, title);
      }}
      onDeleteConversationItem={(id) => {
        void handleDeleteConversation(id);
      }}
      currentTitle={activeConversation?.title || '新对话'}
      onDeleteConversation={() => {
        void handleDeleteConversation(currentConversationId);
      }}
      onShareConversation={() => {
        void handleShareConversation();
      }}
      onCancelShare={() => {
        void handleCancelShare();
      }}
      currentConversationIsShared={Boolean(activeConversation?.isShared)}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        <MessageList messages={messages} isGenerating={isGenerating} />
        <MessageInput
          onSend={handleSendMessage}
          onStop={stopGeneration}
          onRetry={retryLastMessage}
          disabled={isLoading}
          isGenerating={isGenerating}
          error={error}
        />
      </div>
      <Dialog
        open={Boolean(manualShareUrl)}
        onOpenChange={(open) => {
          if (!open) {
            setManualShareUrl(null);
            setManualShareCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分享链接已生成</DialogTitle>
            <DialogDescription>
              当前浏览器没有允许自动复制。你可以点击复制按钮，或选中下面的链接手动复制。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="manual-share-url"
              className="text-foreground text-sm font-medium"
            >
              分享链接
            </label>
            <Input
              id="manual-share-url"
              value={manualShareUrl || ''}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setManualShareUrl(null);
                setManualShareCopied(false);
              }}
            >
              关闭
            </Button>
            <Button type="button" onClick={handleManualCopyShareUrl}>
              {manualShareCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {manualShareCopied ? '已复制' : '复制链接'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ChatLayout>
  );
}
