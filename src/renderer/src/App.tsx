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
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
          <button
            type="button"
            onClick={openLogs}
            title="打开日志目录"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          >
            <FileText className="h-3.5 w-3.5" />
            日志
          </button>
          <span className="font-semibold">Pi Agent</span>
          {modelStatus === 'ready' && (
            <span className="text-xs text-emerald-400">模型就绪</span>
          )}
          {modelStatus === 'error' && (
            <span className="text-xs text-red-400">初始化失败</span>
          )}
          {modelStatus === 'loading' && (
            <span className="text-xs text-zinc-500">初始化中…</span>
          )}
        </header>

        {error && (
          <div className="border-b border-red-900/50 bg-red-950/50 px-4 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <MessageList />
        <Composer />
      </main>
    </div>
  )
}
