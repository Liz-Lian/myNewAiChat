export type ChatMessage = {
  id?: string;
  conversationId?: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: unknown;
  isComplete?: boolean;
  hasError?: boolean;
  createdAt?: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  isShared?: boolean;
  sharedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationDetail = ConversationSummary & {
  userId: string;
  messages: ChatMessage[];
};

type JsonError = {
  error?: string;
  details?: string;
};

/**
 * 解析接口错误响应。
 *
 * @param response fetch 响应对象。
 * @param fallback 兜底错误文案。
 * @returns Error 实例。
 */
async function createServiceError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as JsonError | null;
  return new Error(payload?.error || payload?.details || fallback);
}

/**
 * 获取当前用户会话列表。
 *
 * @returns 按更新时间倒序排列的会话列表。
 */
export async function fetchConversations(): Promise<ConversationSummary[]> {
  const response = await fetch('/api/conversations', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw await createServiceError(response, '获取会话列表失败');
  }

  const payload = (await response.json()) as {
    conversations: ConversationSummary[];
  };
  return payload.conversations;
}

/**
 * 创建新会话。
 *
 * @param title 可选会话标题。
 * @returns 新建会话元信息。
 */
export async function createConversation(
  title?: string,
): Promise<ConversationSummary> {
  const response = await fetch('/api/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw await createServiceError(response, '创建会话失败');
  }

  const payload = (await response.json()) as {
    conversation: ConversationSummary;
  };
  return payload.conversation;
}

/**
 * 获取单个会话详情和消息列表。
 *
 * @param id 会话 ID。
 * @returns 会话详情。
 */
export async function fetchConversationDetail(
  id: string,
): Promise<ConversationDetail> {
  const response = await fetch(`/api/conversations/${id}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw await createServiceError(response, '获取会话失败');
  }

  const payload = (await response.json()) as {
    conversation: ConversationDetail;
  };
  return payload.conversation;
}

/**
 * 更新会话标题。
 *
 * @param id 会话 ID。
 * @param title 新标题。
 * @returns 更新后的会话元信息。
 */
export async function renameConversation(
  id: string,
  title: string,
): Promise<ConversationSummary> {
  const response = await fetch(`/api/conversations/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw await createServiceError(response, '重命名会话失败');
  }

  const payload = (await response.json()) as {
    conversation: ConversationSummary;
  };
  return payload.conversation;
}

/**
 * 删除会话。
 *
 * @param id 会话 ID。
 */
export async function removeConversation(id: string): Promise<void> {
  const response = await fetch(`/api/conversations/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw await createServiceError(response, '删除会话失败');
  }
}

/**
 * 为会话生成分享链接。
 *
 * @param id 会话 ID。
 * @returns 分享链接信息。
 */
export async function shareConversation(id: string): Promise<{
  shareToken: string;
  shareUrl: string;
  isShared: boolean;
  sharedAt: string | null;
}> {
  const response = await fetch(`/api/conversations/${id}/share`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw await createServiceError(response, '生成分享链接失败');
  }

  return response.json();
}

/**
 * 取消会话分享。
 *
 * @param id 会话 ID。
 */
export async function unshareConversation(id: string): Promise<void> {
  const response = await fetch(`/api/conversations/${id}/share`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw await createServiceError(response, '取消分享失败');
  }
}

/**
 * 请求继续补发指定 assistant 消息尚未送达的内容。
 *
 * @param conversationId 会话 ID。
 * @param messageId assistant 消息 ID。
 * @param signal 可选中断信号。
 * @returns fetch 响应，调用方负责消费 SSE 流。
 */
export async function continueConversationGeneration(
  conversationId: string,
  messageId: string,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch('/api/chat/continue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      messageId,
    }),
    signal,
  });

  if (!response.ok) {
    throw await createServiceError(response, '继续生成失败');
  }

  return response;
}
