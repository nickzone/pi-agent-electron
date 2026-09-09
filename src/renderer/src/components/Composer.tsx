import { useState } from 'react'
import { Send, Square } from 'lucide-react'
import { useAgentStore } from '../store'
import log from '../logger'

export function Composer(): React.JSX.Element {
  const [text, setText] = useState('')
  const streaming = useAgentStore((s) => s.streaming)
  const activeSessionId = useAgentStore((s) => s.activeSessionId)
  const hasSession = activeSessionId != null

  const send = async (): Promise<void> => {
    const trimmed = text.trim()
    if (!trimmed) return
    useAgentStore.getState().addUserMessage(trimmed)
    setText('')
    try {
      log.debug('调用窗口 API 发送消息')
      await window.api.prompt(trimmed)
    } catch (e) {
      log.error('发送消息失败:', e)
      useAgentStore.getState().setError(e instanceof Error ? e.message : String(e))
    }
  }

  const abort = async (): Promise<void> => {
    log.warn('用户点击中止')
    await window.api.abort()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
      className="flex items-end gap-2 border-t border-white/10 p-3"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void send()
          }
        }}
        rows={1}
        placeholder={hasSession ? '输入消息，Enter 发送，Shift+Enter 换行' : '请先在左侧选择或新建一个会话'}
        className="max-h-40 flex-1 resize-none rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      />
      {streaming ? (
        <button
          type="button"
          onClick={() => void abort()}
          title="中止"
          className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-500"
        >
          <Square className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!hasSession || !text.trim()}
          title="发送"
          className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-500 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </form>
  )
}
