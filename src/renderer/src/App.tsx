import { useEffect } from 'react'
import { FileText } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { Composer } from './components/Composer'
import { MessageList } from './components/MessageList'
import { useAgentStore } from './store'
import log from './logger'

/**
 * 只初始化一次 Agent 运行时（模块级单例）。
 * 解决 React.StrictMode 在开发模式下卸载/重挂载 effect 的问题：
 * 若把订阅放在 useEffect 里并返回 cleanup，StrictMode 会先卸载（移除订阅），
 * 重挂载时因已置位而不再重新订阅，导致渲染进程收不到 agent 事件。
 */
let runtimeStarted = false
function startRuntime(): void {
  if (runtimeStarted) return
  runtimeStarted = true

  window.api.onEvent((event) => {
    useAgentStore.getState().handleEvent(event)
  })

  window.api.init().then((result) => {
    const s = useAgentStore.getState()
    if (result.ok) {
      s.setModelReady(result.models)
      s.setProjects(result.projects)
      log.info('应用初始化完成，项目:', result.projects.length)
    } else {
      s.setModelError(result.error ?? '初始化失败')
    }
  })
}

export default function App(): React.JSX.Element {
  const modelStatus = useAgentStore((s) => s.modelStatus)
  const error = useAgentStore((s) => s.error)

  useEffect(() => {
    startRuntime()
  }, [])

  const openLogs = async (): Promise<void> => {
    const result = await window.api.openLogs()
    if (!result.ok) {
      log.error('打开日志目录失败:', result.error)
    }
  }

  return (
    <div className="app-shell flex h-screen bg-[#0b0b0d] text-zinc-100">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,.08),transparent_45%)]">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[.07] px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 ring-1 ring-blue-400/20">✦</div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Agent Workspace</div>
              <div className="text-[11px] text-zinc-500">本地智能编程助手</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
          {modelStatus === 'ready' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />模型就绪</span>
          )}
          {modelStatus === 'error' && (
            <span className="text-xs text-red-400">初始化失败</span>
          )}
          {modelStatus === 'loading' && (
            <span className="text-xs text-zinc-500">初始化中…</span>
          )}
          <button type="button" onClick={openLogs} title="打开日志目录" className="rounded-lg p-2 text-zinc-500 hover:bg-white/[.06] hover:text-zinc-200"><FileText className="h-4 w-4" /></button>
          </div>
        </header>

        {error && (
          <div className="border-b border-red-900/50 bg-red-950/50 px-4 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1">
          <MessageList />
        </div>
        <Composer />
      </main>
    </div>
  )
}
