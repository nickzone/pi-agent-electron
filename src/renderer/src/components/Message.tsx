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
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-blue-600' : 'bg-violet-600',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn('max-w-[85%] min-w-0', isUser && 'text-right')}>
        {isUser ? (
          <div className="inline-block whitespace-pre-wrap rounded-2xl bg-blue-600 px-4 py-2 text-sm text-white">
            {message.content}
          </div>
        ) : (
          <div className="space-y-2">
            {message.thinking && <ThinkingBlock text={message.thinking} />}

            {message.toolCalls.map((tool) => (
              <ToolCallView key={tool.id} tool={tool} />
            ))}

            {message.content && (
              <div className="markdown text-sm text-zinc-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}

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
