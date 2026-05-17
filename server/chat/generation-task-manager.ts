/**
 * 流式生成任务管理器，负责记录 assistant 回复的服务端生成进度。
 */
type GenerationTaskStatus = 'running' | 'paused' | 'completed' | 'error';

type GenerationTask = {
  messageId: string;
  userId: string;
  conversationId: string;
  status: GenerationTaskStatus;
  sentContent: string;
  fullContent: string;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

type CreateTaskInput = {
  messageId: string;
  userId: string;
  conversationId: string;
};

const COMPLETED_TASK_TTL_MS = 30 * 60 * 1000;
const PAUSED_TASK_TTL_MS = 2 * 60 * 60 * 1000;

class GenerationTaskManager {
  private readonly tasks = new Map<string, GenerationTask>();

  /**
   * 创建或覆盖一条生成任务。
   *
   * @param input 任务所属用户、会话和消息。
   * @returns 新建任务快照。
   */
  createTask(input: CreateTaskInput): GenerationTask {
    const now = Date.now();
    const task: GenerationTask = {
      ...input,
      status: 'running',
      sentContent: '',
      fullContent: '',
      error: null,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(input.messageId, task);
    return { ...task };
  }

  /**
   * 获取任务快照。
   *
   * @param messageId assistant 消息 ID。
   * @returns 任务存在时返回快照，否则返回 `null`。
   */
  getTask(messageId: string): GenerationTask | null {
    const task = this.tasks.get(messageId);
    return task ? { ...task } : null;
  }

  /**
   * 获取某个会话下仍在内存中的生成任务。
   *
   * @param userId 当前用户 ID。
   * @param conversationId 会话 ID。
   * @returns 属于该会话的任务快照。
   */
  listConversationTasks(
    userId: string,
    conversationId: string,
  ): GenerationTask[] {
    return [...this.tasks.values()]
      .filter(
        (task) =>
          task.userId === userId && task.conversationId === conversationId,
      )
      .map((task) => ({ ...task }));
  }

  /**
   * 追加服务端从上游实际收到的内容。
   *
   * @param messageId assistant 消息 ID。
   * @param content 增量内容。
   */
  appendFullContent(messageId: string, content: string): void {
    const task = this.tasks.get(messageId);
    if (!task || !content) return;

    task.fullContent += content;
    task.updatedAt = Date.now();
  }

  /**
   * 追加已成功发送给前端的内容。
   *
   * @param messageId assistant 消息 ID。
   * @param content 增量内容。
   */
  appendSentContent(messageId: string, content: string): void {
    const task = this.tasks.get(messageId);
    if (!task || !content) return;

    task.sentContent += content;
    task.updatedAt = Date.now();
  }

  /**
   * 标记任务暂停。
   *
   * @param messageId assistant 消息 ID。
   */
  pauseTask(messageId: string): void {
    const task = this.tasks.get(messageId);
    if (!task || task.status === 'completed') return;

    task.status = 'paused';
    task.updatedAt = Date.now();
  }

  /**
   * 标记任务恢复为运行中。
   *
   * @param messageId assistant 消息 ID。
   */
  resumeTask(messageId: string): void {
    const task = this.tasks.get(messageId);
    if (!task || task.status === 'completed') return;

    task.status = 'running';
    task.updatedAt = Date.now();
  }

  /**
   * 标记任务完成。
   *
   * @param messageId assistant 消息 ID。
   */
  completeTask(messageId: string): void {
    const task = this.tasks.get(messageId);
    if (!task) return;

    task.status = 'completed';
    task.updatedAt = Date.now();
  }

  /**
   * 标记任务失败。
   *
   * @param messageId assistant 消息 ID。
   * @param error 错误文案。
   */
  errorTask(messageId: string, error: string): void {
    const task = this.tasks.get(messageId);
    if (!task) return;

    task.status = 'error';
    task.error = error;
    task.updatedAt = Date.now();
  }

  /**
   * 获取尚未发送给前端的内容。
   *
   * @param messageId assistant 消息 ID。
   * @returns 未发送内容；任务不存在时返回 `null`。
   */
  getUnsentContent(messageId: string): string | null {
    const task = this.tasks.get(messageId);
    if (!task) return null;

    return task.fullContent.slice(task.sentContent.length);
  }

  /**
   * 清理过期任务。
   */
  cleanupOldTasks(): void {
    const now = Date.now();

    for (const [messageId, task] of this.tasks) {
      const age = now - task.updatedAt;
      const shouldCleanCompleted =
        (task.status === 'completed' || task.status === 'error') &&
        age > COMPLETED_TASK_TTL_MS;
      const shouldCleanPaused =
        task.status === 'paused' && age > PAUSED_TASK_TTL_MS;

      if (shouldCleanCompleted || shouldCleanPaused) {
        this.tasks.delete(messageId);
      }
    }
  }
}

export const generationTaskManager = new GenerationTaskManager();
export type { GenerationTask, GenerationTaskStatus };
