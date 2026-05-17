/**
 * 本文件封装前端会话 API 调用和错误处理逻辑。
 */
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
  // 后端通常返回 { error, details }，这里优先取可读字段作为抛出的错误信息。
  const payload = (await response.json().catch(() => null)) as JsonError | null;
  return new Error(payload?.error || payload?.details || fallback);
}

/**
 * 获取当前用户会话列表。
 *
 * @returns 按更新时间倒序排列的会话列表。
 */
export async function fetchConversations(): Promise<ConversationSummary[]> {
  // 会话列表不能走浏览器缓存，否则侧边栏会看不到刚创建或刚重命名的会话。
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
  // 只把可选标题交给后端，真正的用户归属由服务端登录态决定。
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
  // 切换会话时需要重新拉取消息列表，避免使用旧会话的本地缓存。
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
  // PATCH 只提交标题字段，后端会校验标题长度并返回更新后的会话摘要。
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
  // 删除操作没有响应体可用，成功时直接让调用方更新本地会话列表。
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
  // 服务端会生成或复用分享 token，并返回前端可直接复制的分享 URL。
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
  // 取消分享只需要清掉服务端分享字段，前端随后把分享按钮恢复为未分享状态。
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
  // 继续生成返回的仍是 SSE 响应，调用方拿到 Response 后自行读取流。
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
