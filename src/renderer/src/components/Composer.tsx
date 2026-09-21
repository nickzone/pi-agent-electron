import { useRef, useState } from 'react'
import { ImagePlus, Send, Square, X } from 'lucide-react'
import { useAgentStore } from '../store'
import log from '../logger'

export function Composer(): React.JSX.Element {
  const [text, setText] = useState('')
  const [image, setImage] = useState<{ type: 'image'; data: string; mimeType: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streaming = useAgentStore((s) => s.streaming)
  const availableModels = useAgentStore((s) => s.availableModels)
  const selectedModel = useAgentStore((s) => s.selectedModel)
  const activeSessionId = useAgentStore((s) => s.activeSessionId)
  const hasSession = activeSessionId != null

  const send = async (): Promise<void> => {
    const trimmed = text.trim()
    if (!trimmed && !image) return
    useAgentStore.getState().addUserMessage(trimmed || '[图片]')
    const selectedImage = image
    setImage(null)
    setText('')
    try {
      log.debug('调用窗口 API 发送消息')
      await window.api.prompt(trimmed, selectedImage ? [selectedImage] : undefined)
    } catch (e) {
      log.error('发送消息失败:', e)
      useAgentStore.getState().setError(e instanceof Error ? e.message : String(e))
    }
  }

  const changeModel = async (model: string): Promise<void> => {
    useAgentStore.getState().setSelectedModel(model)
    try {
      await window.api.setModel(model)
    } catch (e) {
      log.error('切换模型失败:', e)
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
      className="mx-auto flex w-full max-w-4xl items-end gap-2 border-t border-white/[.07] px-6 py-4"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            const result = String(reader.result)
            setImage({ type: 'image', data: result.split(',')[1] ?? '', mimeType: file.type })
          }
          reader.readAsDataURL(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={!hasSession || streaming}
        title="上传图片"
        className="rounded-lg border border-white/10 p-2 text-zinc-300 hover:bg-white/10 disabled:opacity-40"
      >
        <ImagePlus className="h-4 w-4" />
      </button>
      {image ? <button type="button" onClick={() => setImage(null)} title="移除图片" className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-2 text-xs text-zinc-300"><ImagePlus className="h-3 w-3" />图片<X className="h-3 w-3" /></button> : null}
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
        className="max-h-40 flex-1 resize-none rounded-2xl border border-white/[.08] bg-white/[.045] px-4 py-3 text-sm leading-5 text-zinc-100 outline-none transition focus:border-blue-400/40 focus:bg-white/[.06] focus:ring-2 focus:ring-blue-500/10 placeholder:text-zinc-600 disabled:opacity-50"
      />
      <select
        value={selectedModel ?? ''}
        onChange={(e) => void changeModel(e.target.value)}
        disabled={!hasSession || streaming || availableModels.length === 0}
        aria-label="选择模型"
        title="选择模型"
        className="max-w-52 rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
      >
        {availableModels.length === 0 ? <option value="">暂无模型</option> : null}
        {availableModels.map((model) => <option key={model} value={model}>{model}</option>)}
      </select>
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
          disabled={!hasSession || (!text.trim() && !image)}
          title="发送"
          className="rounded-xl bg-blue-600 p-2.5 text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </form>
  )
}
