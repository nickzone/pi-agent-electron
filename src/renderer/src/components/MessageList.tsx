import { useEffect, useRef } from 'react'
import { useAgentStore } from '../store'
import { Message } from './Message'

export function MessageList(): React.JSX.Element {
  const messages = useAgentStore((s) => s.messages)
  const hasSession = useAgentStore((s) => s.activeSessionId != null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6 overflow-y-auto px-6 py-8">
      {messages.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-2xl text-blue-400 ring-1 ring-blue-400/20">✦</div>
          <div className="text-base font-medium text-zinc-300">{hasSession ? '准备开始协作' : '选择一个会话开始'}</div>
          <div className="text-sm text-zinc-600">{hasSession ? '描述你的问题、代码任务或想法' : '请在左侧选择或新建一个项目与会话'}</div>
        </div>
      )}
      {messages.map((m) => {
        // 已结束但无任何内容/工具调用的 assistant 气泡不渲染，避免空消息
        if (m.role === 'assistant' && m.done && !m.content && !m.thinking && m.toolCalls.length === 0) {
          return null
        }
        return <Message key={m.id} message={m} />
      })}
      <div ref={bottomRef} />
    </div>
  )
}
