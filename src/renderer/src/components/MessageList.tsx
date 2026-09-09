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
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {messages.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-zinc-600">
          <span>{hasSession ? '开始与 Agent 对话' : '请在左侧选择或新建一个项目与会话'}</span>
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
