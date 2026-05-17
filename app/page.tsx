/**
 * 本文件实现 AI 聊天应用首页，串联会话、消息和分享交互。
 */
'use client';
import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { LoginDialog } from '@/app/features/auth/components/LoginDialog';
import { useAuth } from '@/app/features/auth/hooks/useAuth';
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
  // 手动分享弹窗状态只在剪贴板不可用或复制失败时使用。
  const [manualShareUrl, setManualShareUrl] = useState<string | null>(null);
  const [manualShareCopied, setManualShareCopied] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const auth = useAuth();
  const {
    messages,
    currentConversationId,
    conversations,
    filteredConversations,
    conversationSearchQuery,
    conversationsLoading,
    loadConversations,
    createNewConversation,
    switchConversation,
    deleteConversation,
    updateConversationTitle,
    sendMessage,
    retryLastMessage,
    retryMessage,
    editAndResend,
    continueGeneration,
    setConversationSearchQuery,
    stopGeneration,
    isGenerating,
    isLoading,
    streamingMessageId,
    error,
  } = useChatStore();

  const handleSendMessage = (content: string) => {
    // 空消息和正在发送中的消息不进入 store，避免重复创建请求。
    if (!content.trim() || isLoading) return;
    sendMessage(content);
  };

  const handleNewChat = async () => {
    // 新对话只重置本地草稿，真正会话会在第一条消息发送时创建。
    await createNewConversation();
    toast.success('已开启新对话');
  };

  const handleDeleteConversation = async (id: string | null) => {
    // 没有选中会话时删除按钮不会产生任何后端请求。
    if (!id) return;

    // 删除不可恢复，所以这里保留浏览器确认框防止误点。
    const confirmed = window.confirm('确定删除这个会话吗？此操作不可恢复。');
    if (!confirmed) return;

    await deleteConversation(id);
    toast.success('会话已删除');
  };

  const handleRenameConversation = async (id: string, title: string) => {
    // 侧边栏内联编辑提交后，交给 store 同步更新本地列表。
    await updateConversationTitle(id, title);
    toast.success('会话标题已更新');
  };

  const copyShareUrl = async (shareUrl: string) => {
    // 某些浏览器或非安全上下文没有剪贴板 API，需要回退到手动复制。
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
    // 分享动作必须针对当前会话，没有会话 ID 时直接忽略。
    if (!currentConversationId) return;

    try {
      // 生成分享链接后刷新侧边栏，让分享状态和时间立即显示出来。
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
    // 弹窗里没有可复制链接时，不触发剪贴板操作。
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
    // 取消分享同样依赖当前会话 ID，用它清空服务端分享 token。
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
    if (auth.isAuthenticated) {
      void loadConversations();
    }
  }, [auth.isAuthenticated, loadConversations]);
  useEffect(() => {
    requestAnimationFrame(() => {
      setSidebarCollapsed(
        window.localStorage.getItem('chat-sidebar-collapsed') === 'true',
      );
    });
  }, []);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((current) => {
      // 折叠状态写入 localStorage，下次进入页面时保持用户偏好。
      const next = !current;
      window.localStorage.setItem('chat-sidebar-collapsed', String(next));
      return next;
    });
  };

  const activeConversation = conversations.find(
    (conversation) => conversation.id === currentConversationId,
  );

  return (
    <ChatLayout
      conversations={filteredConversations}
      activeConversationId={currentConversationId || undefined}
      conversationsLoading={conversationsLoading}
      sidebarCollapsed={sidebarCollapsed}
      searchQuery={conversationSearchQuery}
      filteredCount={filteredConversations.length}
      totalCount={conversations.length}
      onToggleSidebar={handleToggleSidebar}
      onSearchQueryChange={setConversationSearchQuery}
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
        <MessageList
          messages={messages}
          conversationId={currentConversationId}
          isGenerating={isGenerating}
          streamingMessageId={streamingMessageId}
          onContinueGeneration={continueGeneration}
          onRetryMessage={retryMessage}
          onEditAndResend={editAndResend}
        />
        <MessageInput
          onSend={handleSendMessage}
          onStop={stopGeneration}
          onRetry={retryLastMessage}
          disabled={isLoading}
          isGenerating={isGenerating}
          error={error}
        />
      </div>
      <LoginDialog
        open={!auth.isChecking && !auth.isAuthenticated}
        loading={auth.isLoggingIn}
        error={auth.error}
        onLogin={auth.login}
      />
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
