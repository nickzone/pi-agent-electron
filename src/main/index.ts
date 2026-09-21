import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { dirname, join } from 'node:path'
import {
  abort,
  closeActiveSession,
  dispose,
  ensureModelRuntime,
  getActiveProjectId,
  getActiveSessionFile,
  listAvailableModels,
  openSession,
  prompt,
  setEventForwarder,
  setModel,
  type PromptImage,
} from './agent'
import {
  addProject,
  listProjectSessions,
  listProjects,
  removeProject,
  removeSessionFile,
} from './projects'
import log, { getLogFilePath } from './logger'
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent'
import type { Project } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  log.info('创建主窗口')
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 920,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#09090b',
    title: 'Pi Agent',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    log.info('主窗口已就绪，开始显示')
    mainWindow?.show()
  })

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    log.info('加载开发服务器:', process.env['ELECTRON_RENDERER_URL'])
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    log.info('加载本地构建文件')
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log.error('页面加载失败:', code, desc, url)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function forwardToWindow(event: AgentSessionEvent): void {
  // log.debug('转发 Agent 事件:', event.type)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:event', event)
  }
}

registerIpcHandlers()

function registerIpcHandlers(): void {
  ipcMain.handle('app:init', async () => {
    try {
      await ensureModelRuntime()
      const models = await listAvailableModels()
      const projects = listProjects()
      log.info('应用初始化完成，项目数:', projects.length)
      return { ok: true, models, projects }
    } catch (error) {
      log.error('应用初始化失败:', error)
      return { ok: false, error: error instanceof Error ? error.message : String(error), models: [], projects: [] }
    }
  })

  ipcMain.handle('app:chooseDirectory', async () => {
    const options = {
      title: '选择项目目录',
      properties: ['openDirectory' as const],
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('app:createProject', (_event, directory: string) => {
    log.info('创建项目:', directory)
    try {
      const project = addProject(directory)
      return { ok: true, project }
    } catch (error) {
      log.error('创建项目失败:', error)
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('app:removeProject', (_event, projectId: string) => {
    log.info('删除项目:', projectId)
    if (getActiveProjectId() === projectId) {
      closeActiveSession()
    }
    removeProject(projectId)
    return { ok: true }
  })

  ipcMain.handle('app:listSessions', async (_event, projectId: string) => {
    const project = listProjects().find((p) => p.id === projectId)
    if (!project) {
      log.warn('项目不存在，无法列出会话:', projectId)
      return []
    }
    const sessions = await listProjectSessions(project)
    log.debug('项目会话:', project.name, sessions.length)
    return sessions
  })

  ipcMain.handle(
    'app:openSession',
    async (_event, projectId: string, sessionFile?: string) => {
      const project: Project | undefined = listProjects().find((p) => p.id === projectId)
      if (!project) {
        return { ok: false, error: '项目不存在' }
      }
      try {
        setEventForwarder(forwardToWindow)
        const result = await openSession(project, sessionFile)
        const models = await listAvailableModels()
        log.info('会话已打开:', result.sessionId)
        return { ok: true, models, ...result }
      } catch (error) {
        log.error('打开会话失败:', error)
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  )

  ipcMain.handle('app:removeSession', (_event, _projectId: string, sessionPath: string) => {
    log.info('删除会话:', sessionPath)
    if (getActiveSessionFile() === sessionPath) {
      closeActiveSession()
    }
    removeSessionFile(sessionPath)
    return { ok: true }
  })

  ipcMain.handle('agent:prompt', async (_event, text: string, images?: PromptImage[]) => {
    log.info('收到 prompt，长度:', text.length, '图片数量:', images?.length ?? 0)
    await prompt(text, images)
  })

  ipcMain.handle('agent:setModel', async (_event, modelName: string) => {
    await setModel(modelName)
  })

  ipcMain.handle('agent:abort', async () => {
    log.warn('收到 abort 请求')
    await abort()
  })

  ipcMain.handle('app:openLogs', async () => {
    const dir = dirname(getLogFilePath()) || app.getPath('logs')
    log.info('打开日志目录:', dir)
    const error = await shell.openPath(dir)
    return { ok: error === '', error: error || undefined }
  })
}

app.whenReady().then(() => {
  log.info('Electron 应用就绪')
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  log.info('所有窗口已关闭')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  log.info('应用退出，清理资源')
  dispose()
})
