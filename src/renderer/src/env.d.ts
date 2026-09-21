/// <reference types="vite/client" />

import type { AgentEvent, ChatMessage, Project, SessionInfo } from '../shared/types'

declare global {
  interface Api {
    init(): Promise<{ ok: boolean; error?: string; models: string[]; projects: Project[] }>
    chooseDirectory(): Promise<string | null>
    createProject(
      directory: string,
    ): Promise<{ ok: boolean; error?: string; project?: Project }>
    removeProject(projectId: string): Promise<{ ok: boolean }>
    listSessions(projectId: string): Promise<SessionInfo[]>
    openSession(
      projectId: string,
      sessionFile?: string,
    ): Promise<{
      ok: boolean
      error?: string
      models?: string[]
      sessionId?: string
      sessionFile?: string | null
      messages?: ChatMessage[]
    }>
    removeSession(projectId: string, sessionPath: string): Promise<{ ok: boolean }>
    prompt(text: string, images?: { type: 'image'; data: string; mimeType: string }[]): Promise<void>
    setModel(modelName: string): Promise<void>
    abort(): Promise<void>
    openLogs(): Promise<{ ok: boolean; error?: string }>
    onEvent(listener: (event: AgentEvent) => void): () => void
  }

  interface Window {
    api: Api
  }
}

export {}
