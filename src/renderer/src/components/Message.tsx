import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import {
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  User,
  Wrench,
  XCircle,
} from 'lucide-react'
import { cn } from '../lib/cn'
import type { ChatMessage, ToolCall } from '../types'

export function Message({ message }: { message: ChatMessage }): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className={cn('group flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
          isUser ? 'bg-blue-500/20 text-blue-300' : 'bg-violet-500/15 text-violet-300',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn('max-w-[85%] min-w-0', isUser && 'text-right')}>
        {isUser ? (
          <div className="inline-block whitespace-pre-wrap rounded-2xl rounded-tr-md bg-blue-600/90 px-4 py-2.5 text-sm leading-6 text-white shadow-lg shadow-blue-950/20">
            {message.content}
          </div>
        ) : (
          <div className="space-y-2">
            {message.thinking && <ThinkingBlock text={message.thinking} />}

            {message.toolCalls.map((tool) => (
              <ToolCallView key={tool.id} tool={tool} />
            ))}

            {message.content && (
              <div className="rounded-2xl rounded-tl-md border border-white/[.07] bg-white/[.035] px-4 py-3 shadow-xl shadow-black/10">
                <div className="markdown text-sm text-zinc-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {message.content}
                </ReactMarkdown>
                </div>
              </div>
            )}

            {message.done && message.usage && <UsageView usage={message.usage} />}

            {!message.content &&
              !message.thinking &&
              message.toolCalls.length === 0 &&
              !message.done && (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  思考中…
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  )
}

function UsageView({ usage }: { usage: NonNullable<ChatMessage['usage']> }): React.JSX.Element {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500" title="本轮对话 token 消耗">
      <span>本轮 Token {usage.total.toLocaleString()}</span>
      <span>输入 {usage.input.toLocaleString()}</span>
      <span>输出 {usage.output.toLocaleString()}</span>
      <span>缓存命中 {usage.cacheRead.toLocaleString()}</span>
      <span>缓存写入 {usage.cacheWrite.toLocaleString()}</span>
      {usage.cost != null && <span>费用 ${usage.cost.toFixed(6)}</span>}
    </div>
  )
}

function ThinkingBlock({ text }: { text: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs text-zinc-400"
      >
        <Brain className="h-3 w-3" />
        思考过程
        {open ? (
          <ChevronDown className="ml-auto h-3 w-3" />
        ) : (
          <ChevronRight className="ml-auto h-3 w-3" />
        )}
      </button>
      {open && (
        <pre className="whitespace-pre-wrap border-t border-white/10 px-3 py-2 text-xs text-zinc-500">
          {text}
        </pre>
      )}
    </div>
  )
}

function ToolCallView({ tool }: { tool: ToolCall }): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs"
      >
        {tool.status === 'running' ? (
          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
        ) : tool.status === 'error' ? (
          <XCircle className="h-3 w-3 text-red-400" />
        ) : (
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        )}
        <Wrench className="h-3 w-3 text-zinc-400" />
        <span className="font-mono text-zinc-300">{tool.name}</span>
        {tool.status === 'running' && <span className="text-zinc-500">执行中…</span>}
        {open ? (
          <ChevronDown className="ml-auto h-3 w-3 text-zinc-500" />
        ) : (
          <ChevronRight className="ml-auto h-3 w-3 text-zinc-500" />
        )}
      </button>
      {open && (
        <div className="max-h-60 overflow-auto border-t border-white/10">
          {tool.input && (
            <div className="border-b border-white/10 px-3 py-2">
              <div className="mb-1 text-[11px] font-medium text-zinc-500">入参</div>
              <pre className="whitespace-pre-wrap break-all text-xs text-zinc-300">
                {tool.input.slice(0, 4000)}
              </pre>
            </div>
          )}
          {tool.output && (
            <div className="px-3 py-2">
              <div className="mb-1 text-[11px] font-medium text-zinc-500">出参</div>
              <pre className="whitespace-pre-wrap break-all text-xs text-zinc-400">
                {tool.output.slice(0, 4000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
