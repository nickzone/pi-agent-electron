import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AgentEvent, ChatMessage, Project, SessionInfo } from '../shared/types'

const api = {
  init: (): Promise<{ ok: boolean; error?: string; models: string[]; projects: Project[] }> =>
    ipcRenderer.invoke('app:init'),

  chooseDirectory: (): Promise<string | null> => ipcRenderer.invoke('app:chooseDirectory'),

  createProject: (
    directory: string,
  ): Promise<{ ok: boolean; error?: string; project?: Project }> =>
    ipcRenderer.invoke('app:createProject', directory),

  removeProject: (projectId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('app:removeProject', projectId),

  listSessions: (projectId: string): Promise<SessionInfo[]> =>
    ipcRenderer.invoke('app:listSessions', projectId),

  openSession: (
    projectId: string,
    sessionFile?: string,
  ): Promise<{
    ok: boolean
    error?: string
    models?: string[]
    sessionId?: string
    sessionFile?: string | null
    messages?: ChatMessage[]
  }> => ipcRenderer.invoke('app:openSession', projectId, sessionFile),

  removeSession: (projectId: string, sessionPath: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('app:removeSession', projectId, sessionPath),

  prompt: (text: string, images?: { type: 'image'; data: string; mimeType: string }[]): Promise<void> =>
    ipcRenderer.invoke('agent:prompt', text, images),
  setModel: (modelName: string): Promise<void> => ipcRenderer.invoke('agent:setModel', modelName),
  abort: (): Promise<void> => ipcRenderer.invoke('agent:abort'),
  openLogs: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('app:openLogs'),

  onEvent: (listener: (event: AgentEvent) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, payload: AgentEvent): void => listener(payload)
    ipcRenderer.on('agent:event', handler)
    return () => {
      ipcRenderer.removeListener('agent:event', handler)
    }
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
