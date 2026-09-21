import { useState } from 'react'
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react'
import { useAgentStore } from '../store'
import { cn } from '../lib/cn'
import log from '../logger'
import type { Project, SessionInfo } from '../types'

function sessionTitle(s: SessionInfo): string {
  const text = s.firstMessage || s.name || '(空会话)'
  return text.length > 24 ? `${text.slice(0, 24)}…` : text
}

function sessionSubtitle(s: SessionInfo): string {
  const d = new Date(s.modified)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} · ${s.messageCount} 条`
}

export function Sidebar(): React.JSX.Element {
  const projects = useAgentStore((s) => s.projects)
  const sessions = useAgentStore((s) => s.sessions)
  const activeSessionId = useAgentStore((s) => s.activeSessionId)
  const loadingSessions = useAgentStore((s) => s.loadingSessions)
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)

  const store = useAgentStore.getState

  async function loadSessions(projectId: string): Promise<void> {
    store().setLoadingSessions(true)
    try {
      const list = await window.api.listSessions(projectId)
      store().setSessions(list)
    } catch (e) {
      log.error('加载会话列表失败:', e)
    } finally {
      store().setLoadingSessions(false)
    }
  }

  async function toggleProject(p: Project): Promise<void> {
    if (expandedProjectId === p.id) {
      setExpandedProjectId(null)
      return
    }
    setExpandedProjectId(p.id)
    store().setActiveProject(p.id)
    await loadSessions(p.id)
  }

  async function createProject(): Promise<void> {
    const dir = await window.api.chooseDirectory()
    if (!dir) return
    const res = await window.api.createProject(dir)
    if (res.ok && res.project) {
      const exists = store().projects.some((x) => x.id === res.project!.id)
      if (!exists) {
        store().setProjects([...store().projects, res.project])
      }
      setExpandedProjectId(res.project.id)
      store().setActiveProject(res.project.id)
      await loadSessions(res.project.id)
    } else if (!res.ok) {
      log.error('创建项目失败:', res.error)
      setError(res.error ?? '创建项目失败')
    }
  }

  async function selectSession(p: Project, s: SessionInfo): Promise<void> {
    setExpandedProjectId(p.id)
    store().setActiveProject(p.id)
    store().setActiveSession(s.id)
    const res = await window.api.openSession(p.id, s.path)
    if (res.ok) {
      store().replaceMessages(res.messages ?? [])
      if (res.models) store().setModelReady(res.models)
      store().setActiveSession(res.sessionId ?? s.id)
    } else {
      log.error('打开会话失败:', res.error)
      setError(res.error ?? '打开会话失败')
    }
  }

  async function newSession(p: Project): Promise<void> {
    setExpandedProjectId(p.id)
    store().setActiveProject(p.id)
    const res = await window.api.openSession(p.id)
    if (res.ok) {
      store().replaceMessages([])
      if (res.models) store().setModelReady(res.models)
      store().setActiveSession(res.sessionId ?? null)
      await loadSessions(p.id)
    } else {
      log.error('新建会话失败:', res.error)
      setError(res.error ?? '新建会话失败')
    }
  }

  async function deleteSession(p: Project, s: SessionInfo): Promise<void> {
    const name = sessionTitle(s)
    if (!window.confirm(`删除会话「${name}」？此操作不可恢复。`)) return
    const res = await window.api.removeSession(p.id, s.path)
    if (res.ok) {
      if (store().activeSessionId === s.id) {
        store().replaceMessages([])
        store().setActiveSession(null)
      }
      await loadSessions(p.id)
    }
  }

  async function deleteProject(p: Project): Promise<void> {
    const msg = `删除项目「${p.name}」及其全部会话？（不会删除磁盘目录 ${p.directory}）`
    if (!window.confirm(msg)) return
    const res = await window.api.removeProject(p.id)
    if (res.ok) {
      store().setProjects(store().projects.filter((x) => x.id !== p.id))
      if (store().activeProjectId === p.id) {
        store().setActiveProject(null)
        store().setActiveSession(null)
        store().replaceMessages([])
      }
      store().setSessions([])
      if (expandedProjectId === p.id) setExpandedProjectId(null)
    }
  }

  function setError(message: string): void {
    store().setError(message)
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-white/[.07] bg-[#101012]">
      <div className="flex h-14 items-center justify-between border-b border-white/[.07] px-4">
        <span className="text-xs font-semibold uppercase tracking-[.18em] text-zinc-500">
          工作区
        </span>
        <button
          type="button"
          onClick={() => void createProject()}
          title="新建项目"
          className="flex items-center gap-1 rounded-lg bg-white/[.06] px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          新建
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {projects.length === 0 && (
          <div className="px-2 py-8 text-center text-xs text-zinc-500">
            暂无项目
            <br />
            点击右上角「新建」关联一个目录
          </div>
        )}

        <ul className="space-y-1">
          {projects.map((p) => {
            const expanded = expandedProjectId === p.id
            return (
              <li key={p.id}>
                <div
                  className={cn(
                    'group flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm text-zinc-200 transition-colors hover:bg-white/[.06]',
                    expanded && 'bg-white/5',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void toggleProject(p)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    {expanded ? (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-zinc-500" />
                    )}
                    {expanded ? (
                      <FolderOpen className="h-4 w-4 shrink-0 text-amber-400" />
                    ) : (
                      <Folder className="h-4 w-4 shrink-0 text-amber-400" />
                    )}
                    <span className="truncate font-medium">{p.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void newSession(p)}
                    title="新建会话"
                    className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteProject(p)}
                    title="删除项目"
                    className="rounded p-1 text-zinc-500 hover:bg-red-500/20 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="px-1.5 text-[11px] text-zinc-500">
                  <span className="truncate pl-6">{p.directory}</span>
                </div>

                {expanded && (
                  <div className="mt-1 space-y-0.5 pl-8">
                    {loadingSessions && (
                      <div className="py-1 text-xs text-zinc-500">加载中…</div>
                    )}
                    {!loadingSessions && sessions.length === 0 && (
                      <div className="py-1 text-xs text-zinc-600">暂无会话</div>
                    )}
                    {sessions.map((s) => {
                      const active = s.id === activeSessionId
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            'group flex items-center gap-1 rounded-md px-2 py-1',
                            active
                              ? 'bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400/15'
                              : 'text-zinc-300 hover:bg-white/[.06]',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => void selectSession(p, s)}
                            className="flex min-w-0 flex-1 flex-col items-start text-left"
                          >
                            <span className="flex w-full items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                              <span className="truncate">{sessionTitle(s)}</span>
                            </span>
                            <span className="ml-5 truncate text-[11px] text-zinc-500">
                              {sessionSubtitle(s)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteSession(p, s)}
                            title="删除会话"
                            className="rounded p-1 text-zinc-500 hover:bg-red-500/20 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
