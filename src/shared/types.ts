/**
 * 跨进程共享类型（主进程 / preload / 渲染进程均引用）。
 */

export type ToolCallStatus = 'running' | 'success' | 'error'

export interface ToolCall {
  id: string
  name: string
  status: ToolCallStatus
  /** 入参（JSON 字符串，用于展示） */
  input: string
  /** 出参（展示文本） */
  output: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking: string
  toolCalls: ToolCall[]
  done: boolean
}

/** 一个项目 = 一个工作目录 + 其下的一组实时会话 */
export interface Project {
  id: string
  name: string
  directory: string
  createdAt: number
}

/** 来自 pi SDK SessionManager.list 的会话元信息 */
export interface SessionInfo {
  path: string
  id: string
  cwd: string
  name?: string
  created: Date
  modified: Date
  messageCount: number
  firstMessage: string
  allMessagesText: string
}

export type AssistantMessageEvent =
  | { type: 'start' }
  | { type: 'text_start'; contentIndex: number }
  | { type: 'text_delta'; contentIndex: number; delta: string }
  | { type: 'text_end'; contentIndex: number; content: string }
  | { type: 'thinking_start'; contentIndex: number }
  | { type: 'thinking_delta'; contentIndex: number; delta: string }
  | { type: 'thinking_end'; contentIndex: number; content: string }
  | { type: 'toolcall_start'; contentIndex: number }
  | { type: 'toolcall_delta'; contentIndex: number; delta: string }
  | { type: 'toolcall_end'; contentIndex: number }
  | { type: 'done'; reason: string }
  | { type: 'error'; reason: string }

export type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'agent_end'; messages: unknown[]; willRetry: boolean }
  | { type: 'agent_settled' }
  | { type: 'turn_start' }
  | { type: 'turn_end'; message: unknown; toolResults: unknown[] }
  | { type: 'message_start'; message: unknown }
  | { type: 'message_update'; message: unknown; assistantMessageEvent: AssistantMessageEvent }
  | { type: 'message_end'; message: unknown }
  | { type: 'tool_execution_start'; toolCallId: string; toolName: string; args: unknown }
  | {
      type: 'tool_execution_update'
      toolCallId: string
      toolName: string
      args: unknown
      partialResult: unknown
    }
  | {
      type: 'tool_execution_end'
      toolCallId: string
      toolName: string
      result: unknown
      isError: boolean
    }
  | { type: 'queue_update'; steering: readonly string[]; followUp: readonly string[] }
  | { type: 'compaction_start'; reason: string }
  | {
      type: 'compaction_end'
      reason: string
      result: unknown
      aborted: boolean
      willRetry: boolean
      errorMessage?: string
    }
  | { type: 'auto_retry_start'; attempt: number; maxAttempts: number; delayMs: number; errorMessage: string }
  | { type: 'auto_retry_end'; success: boolean; attempt: number; finalError?: string }
  | { type: 'bash_execution_update'; id?: string; delta: string }
  | { type: 'thinking_level_changed'; level: string }
  | { type: 'session_info_changed'; name?: string }
  | { type: 'entry_appended'; entry: unknown }
