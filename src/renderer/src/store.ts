import { create } from 'zustand'
import log from './logger'
import type { AgentEvent, ChatMessage, Project, SessionInfo, ToolCall } from './types'

interface AgentState {
  messages: ChatMessage[]
  streaming: boolean
  queue: { steering: string[]; followUp: string[] }
  error: string | null
  modelStatus: 'loading' | 'ready' | 'error'
  availableModels: string[]
  selectedModel: string | null

  // 项目 / 会话管理
  projects: Project[]
  sessions: SessionInfo[]
  activeProjectId: string | null
  activeSessionId: string | null
  loadingSessions: boolean

  handleEvent: (event: AgentEvent) => void
  addUserMessage: (text: string) => void
  setError: (message: string) => void
  setModelReady: (models: string[]) => void
  setSelectedModel: (model: string) => void
  setModelError: (message: string) => void
  setProjects: (projects: Project[]) => void
  setSessions: (sessions: SessionInfo[]) => void
  setActiveProject: (projectId: string | null) => void
  setActiveSession: (sessionId: string | null) => void
  setLoadingSessions: (value: boolean) => void
  replaceMessages: (messages: ChatMessage[]) => void
  refreshSessions: () => Promise<void>
}

let nextId = 1
const newId = (): string => `m${nextId++}`

function newAssistant(): ChatMessage {
  return { id: newId(), role: 'assistant', content: '', thinking: '', toolCalls: [], done: false }
}

/** 从工具 result / partialResult 中提取可展示文本 */
function extractText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(extractText).join('')
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (Array.isArray(obj.content)) return extractText(obj.content)
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.delta === 'string') return obj.delta
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** 更新最后一条未完成的 assistant 消息；若不存在则先创建 */
function updateLastAssistant(patch: (msg: ChatMessage) => ChatMessage): void {
  const state = useAgentStore.getState()
  const last = state.messages[state.messages.length - 1]
  if (!last || last.role !== 'assistant' || last.done) {
    const created = newAssistant()
    useAgentStore.setState({ messages: [...state.messages, patch(created)] })
    return
  }
  useAgentStore.setState({ messages: [...state.messages.slice(0, -1), patch(last)] })
}

function markLastAssistantDone(message?: unknown): void {
  const state = useAgentStore.getState()
  const last = state.messages[state.messages.length - 1]
  if (last && last.role === 'assistant' && !last.done) {
    const raw = message as { usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; cost?: { total?: number } } } | undefined
    const u = raw?.usage
    const usage = u ? {
      input: u.input ?? 0,
      output: u.output ?? 0,
      cacheRead: u.cacheRead ?? 0,
      cacheWrite: u.cacheWrite ?? 0,
      total: (u.input ?? 0) + (u.output ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0),
      cost: u.cost?.total,
    } : undefined
    useAgentStore.setState({ messages: [...state.messages.slice(0, -1), { ...last, done: true, usage }] })
  }
}

/**
 * 用 pi 的 message_update 事件携带的完整 assistant 消息重建展示字段。
 * 这样能把 text / thinking / toolCall 三种内容块都正确落到同一条消息上，
 * 避免出现“空消息”或工具调用被拆到独立空消息里的问题。
 */
function syncAssistantParts(msg: unknown, current: ChatMessage): ChatMessage {
  const m = msg as Record<string, unknown>
  const blocks = Array.isArray(m.content) ? (m.content as unknown[]) : []
  let content = ''
  let thinking = ''
  const toolCalls: ToolCall[] = []
  for (const block of blocks) {
    const b = block as Record<string, unknown>
    if (b.type === 'text') content += String(b.text ?? '')
    else if (b.type === 'thinking') thinking += String(b.thinking ?? '')
    else if (b.type === 'toolCall') {
      // 保留 tool_execution_* 已经写入的状态/输出，避免被重置
      const prev = current.toolCalls.find((t) => t.id === b.id)
      toolCalls.push({
        id: String(b.id ?? ''),
        name: String(b.name ?? ''),
        status: prev?.status ?? 'running',
        // 入参从当前 arguments 实时重建（流式时 arguments 逐块增长），不会冻结在空对象
        input: formatToolInput(b.arguments),
        output: prev?.output ?? '',
      })
    }
  }
  return { ...current, content, thinking, toolCalls }
}

/** 更新任意一条消息里指定 toolCallId 的工具调用；找不到则回退挂到最后一条 assistant 消息 */
function updateToolCallById(toolCallId: string, fn: (t: ToolCall) => ToolCall): void {
  const state = useAgentStore.getState()
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const m = state.messages[i]
    if (m.role === 'assistant' && m.toolCalls.some((t) => t.id === toolCallId)) {
      const newMsgs = [...state.messages]
      newMsgs[i] = { ...m, toolCalls: m.toolCalls.map((t) => (t.id === toolCallId ? fn(t) : t)) }
      useAgentStore.setState({ messages: newMsgs })
      return
    }
  }
  // 理论上不会走到：工具调用应已被 message_update 捕获
  updateLastAssistant((msg) => ({
    ...msg,
    toolCalls: [
      ...msg.toolCalls,
      fn({ id: toolCallId, name: 'tool', status: 'running', input: '', output: '' }),
    ],
  }))
}

/** 把 tool call 的入参对象格式化为可展示的 JSON 字符串；空对象/空串则不展示 */
function formatToolInput(args: unknown): string {
  if (args == null) return ''
  if (typeof args === 'string') return args
  try {
    const s = JSON.stringify(args, null, 2)
    return s === '{}' || s === '' ? '' : s
  } catch {
    return String(args)
  }
}

export const useAgentStore = create<AgentState>((set) => ({
  messages: [],
  streaming: false,
  queue: { steering: [], followUp: [] },
  error: null,
  modelStatus: 'loading',
  availableModels: [],
  selectedModel: null,

  // 项目 / 会话管理
  projects: [],
  sessions: [],
  activeProjectId: null,
  activeSessionId: null,
  loadingSessions: false,

  handleEvent: (event) => {
    log.debug('收到 Agent 事件:', event.type)
    switch (event.type) {
      case 'agent_start':
        log.info('Agent 开始运行')
        set({ streaming: true, error: null })
        break

      case 'message_start': {
        // 只处理 assistant 消息：用户消息已由 addUserMessage 乐观显示，
        // toolResult 通过 tool_execution_* 写入对应 toolCall，均不新建气泡
        const role = (event.message as Record<string, unknown>)?.role
        if (role === 'assistant') {
          set((state) => ({ messages: [...state.messages, newAssistant()] }))
        }
        break
      }

      case 'message_update':
        // 用完整 assistant 消息重建 content / thinking / toolCalls
        updateLastAssistant((msg) => syncAssistantParts(event.message, msg))
        break

      case 'tool_execution_start':
        updateToolCallById(event.toolCallId, (t) => ({ ...t, status: 'running' }))
        break

      case 'tool_execution_update':
        updateToolCallById(event.toolCallId, (t) => ({
          ...t,
          output: extractText(event.partialResult),
        }))
        break

      case 'tool_execution_end':
        updateToolCallById(event.toolCallId, (t) => ({
          ...t,
          status: event.isError ? ('error' as const) : ('success' as const),
          output: extractText(event.result),
        }))
        break

      case 'message_end':
        if ((event.message as Record<string, unknown>)?.role === 'assistant') {
          markLastAssistantDone(event.message)
        }
        break

      case 'agent_end':
      case 'agent_settled':
        log.info('Agent 结束/收敛')
        markLastAssistantDone()
        set({ streaming: false })
        // 让新建的会话（首个消息后才落盘）同步到侧边栏
        void useAgentStore.getState().refreshSessions()
        break

      case 'queue_update':
        set({ queue: { steering: [...event.steering], followUp: [...event.followUp] } })
        break

      default:
        break
    }
  },

  addUserMessage: (text) => {
    log.info('用户发送消息:', text)
    set((state) => ({
      messages: [
        ...state.messages,
        { id: newId(), role: 'user', content: text, thinking: '', toolCalls: [], done: true },
      ],
    }))
  },

  setError: (message) => {
    log.error('设置错误:', message)
    set({ error: message })
  },
  setModelReady: (models) => {
    log.info('模型就绪:', models)
    set((state) => ({
      modelStatus: 'ready',
      availableModels: models,
      selectedModel: state.selectedModel && models.includes(state.selectedModel) ? state.selectedModel : models[0] ?? null,
    }))
  },
  setSelectedModel: (model) => set({ selectedModel: model }),
  setModelError: (message) => {
    log.error('模型初始化失败:', message)
    set({ modelStatus: 'error', error: message })
  },

  setProjects: (projects) => set({ projects }),
  setSessions: (sessions) => set({ sessions }),
  setActiveProject: (projectId) => set({ activeProjectId: projectId }),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  setLoadingSessions: (value) => set({ loadingSessions: value }),
  replaceMessages: (messages) => set({ messages, streaming: false, error: null }),

  refreshSessions: async () => {
    const projectId = useAgentStore.getState().activeProjectId
    if (!projectId) return
    try {
      const list = await window.api.listSessions(projectId)
      useAgentStore.getState().setSessions(list)
    } catch (e) {
      log.debug('刷新会话列表失败:', e)
    }
  },
}))
