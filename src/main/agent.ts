import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent,
} from '@earendil-works/pi-coding-agent'
import { getProjectSessionDir } from './projects'
import log from './logger'
import type { ChatMessage, Project, ToolCall } from '../shared/types'

let session: AgentSession | null = null
let modelRuntime: ModelRuntime | null = null
let sessionUnsub: (() => void) | null = null
let eventForwarder: ((event: AgentSessionEvent) => void) | null = null

/** 当前会话绑定信息（供 UI 判断是否处于该项目/会话下） */
let activeProjectId: string | null = null
let activeSessionId: string | null = null
let activeSessionFile: string | null = null

export function setEventForwarder(fn: ((event: AgentSessionEvent) => void) | null): void {
  eventForwarder = fn
}

export async function ensureModelRuntime(): Promise<ModelRuntime> {
  if (!modelRuntime) {
    modelRuntime = await ModelRuntime.create()
  }
  return modelRuntime
}

/** 当前已绑定会话的项目 id；未绑定则为 null */
export function getActiveProjectId(): string | null {
  return activeProjectId
}

export function getActiveSessionId(): string | null {
  return activeSessionId
}

export function getActiveSessionFile(): string | null {
  return activeSessionFile
}

export function getSession(): AgentSession {
  if (!session) {
    throw new Error('尚未选择会话，请先在左侧选择一个会话')
  }
  return session
}

function closeSession(): void {
  sessionUnsub?.()
  sessionUnsub = null
  session?.dispose()
  session = null
  activeProjectId = null
  activeSessionId = null
  activeSessionFile = null
}

/**
 * 打开（或新建）一个项目下的会话，并把它设为当前活动会话。
 * @param sessionFile 传入则打开已有会话；不传则新建一个持久化会话。
 */
export async function openSession(
  project: Project,
  sessionFile?: string,
): Promise<{ sessionId: string; sessionFile: string | null; messages: ChatMessage[] }> {
  const rt = await ensureModelRuntime()
  closeSession()

  const sessionDir = getProjectSessionDir(project.id)
  log.info('打开会话:', project.name, sessionFile ?? '(新建)')

  const sessionManager = sessionFile
    ? SessionManager.open(sessionFile, sessionDir)
    : SessionManager.create(project.directory, sessionDir)

  const result = await createAgentSession({
    cwd: project.directory,
    sessionManager,
    modelRuntime: rt,
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
    }),
  })
  session = result.session
  activeProjectId = project.id
  activeSessionId = session.sessionId ?? null
  activeSessionFile = sessionFile ?? session.sessionFile ?? null

  sessionUnsub = session.subscribe((event) => {
    eventForwarder?.(event)
  })

  const messages = session.messages.map(convertAgentMessage)
  log.info('会话就绪:', activeSessionId, '历史消息:', messages.length)
  return { sessionId: session.sessionId, sessionFile: activeSessionFile, messages }
}

export function dispose(): void {
  log.info('释放 Agent 资源')
  closeSession()
  modelRuntime = null
}

/** 关闭当前活动会话（删除会话/项目时由主进程调用） */
export function closeActiveSession(): void {
  closeSession()
}

export interface PromptImage {
  type: 'image'
  data: string
  mimeType: string
}

/** 发送消息；若 agent 正在流式输出则排队（followUp） */
export async function prompt(text: string, images: PromptImage[] = []): Promise<void> {
  const s = getSession()
  const options = images.length > 0 ? { images } : undefined
  if (s.isStreaming) {
    log.info('Agent 正在流式输出，消息进入 followUp 队列')
    await s.prompt(text, { ...options, streamingBehavior: 'followUp' })
  } else {
    log.info('空闲状态，直接发送 prompt')
    await s.prompt(text, options)
  }
}

/** 切换当前会话使用的模型 */
export async function setModel(modelName: string): Promise<void> {
  const separator = modelName.indexOf('/')
  if (separator <= 0 || separator === modelName.length - 1) {
    throw new Error(`无效的模型名称: ${modelName}`)
  }
  const model = (await ensureModelRuntime()).getModel(
    modelName.slice(0, separator),
    modelName.slice(separator + 1),
  )
  if (!model) {
    throw new Error(`找不到模型: ${modelName}`)
  }
  await getSession().setModel(model)
  log.info('已切换模型:', modelName)
}

/** 中止当前运行 */
export async function abort(): Promise<void> {
  log.warn('中止 agent 运行')
  await getSession().abort()
}

/** 已登录（有可用模型）的模型列表，形如 "anthropic/claude-opus-4-5" */
export async function listAvailableModels(): Promise<string[]> {
  if (!modelRuntime) {
    log.warn('listAvailableModels 被调用但 ModelRuntime 尚未初始化')
    return []
  }
  const models = await modelRuntime.getAvailable()
  const result = models.map((m) => `${m.provider}/${m.id}`)
  log.debug('可用模型:', result)
  return result
}

// ---------------------------------------------------------------------------
// AgentMessage -> ChatMessage 转换（用于展示已打开会话的历史消息）
// ---------------------------------------------------------------------------

function extractText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(extractText).join('')
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (Array.isArray(obj.content)) return extractText(obj.content)
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.thinking === 'string') return obj.thinking
    if (typeof obj.delta === 'string') return obj.delta
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

let convertedId = 0
function nextMsgId(): string {
  return `h${++convertedId}`
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

function convertAgentMessage(msg: unknown): ChatMessage {
  const m = msg as Record<string, unknown>
  const role = m.role
  const contentBlocks = Array.isArray(m.content) ? (m.content as unknown[]) : []

  if (role === 'user') {
    return {
      id: nextMsgId(),
      role: 'user',
      content: extractText(m.content),
      thinking: '',
      toolCalls: [],
      done: true,
    }
  }

  if (role === 'assistant') {
    let content = ''
    let thinking = ''
    const toolCalls: ToolCall[] = []
    for (const block of contentBlocks) {
      const b = block as Record<string, unknown>
      if (b.type === 'text') content += String(b.text ?? '')
      else if (b.type === 'thinking') thinking += String(b.thinking ?? '')
      else if (b.type === 'toolCall') {
        toolCalls.push({
          id: String(b.id ?? ''),
          name: String(b.name ?? ''),
          status: 'success',
          input: formatToolInput(b.arguments),
          output: '',
        })
      }
    }
    const usage = m.usage as { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; cost?: { total?: number } } | undefined
    return {
      id: nextMsgId(), role: 'assistant', content, thinking, toolCalls, done: true,
      usage: usage ? { input: usage.input ?? 0, output: usage.output ?? 0, cacheRead: usage.cacheRead ?? 0, cacheWrite: usage.cacheWrite ?? 0, total: (usage.input ?? 0) + (usage.output ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0), cost: usage.cost?.total } : undefined,
    }
  }

  // toolResult / custom / summary 等：当前 UI 展示为空占位，避免重复追加
  return {
    id: nextMsgId(),
    role: m.role === 'user' ? 'user' : 'assistant',
    content: '',
    thinking: '',
    toolCalls: [],
    done: true,
  }
}
