import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { SessionManager, type SessionInfo } from '@earendil-works/pi-coding-agent'
import log from './logger'
import type { Project } from '../shared/types'

/** 项目注册表：userData/projects.json */
function registryPath(): string {
  return join(app.getPath('userData'), 'projects.json')
}

/** 每个项目的会话存储目录（app 自管，独立于 pi CLI 的 ~/.pi） */
export function getProjectSessionDir(projectId: string): string {
  return join(app.getPath('userData'), 'projects', projectId, 'sessions')
}

function readRegistry(): Project[] {
  try {
    const raw = readFileSync(registryPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRegistry(projects: Project[]): void {
  mkdirSync(dirname(registryPath()), { recursive: true })
  writeFileSync(registryPath(), JSON.stringify(projects, null, 2), 'utf8')
}

export function listProjects(): Project[] {
  return readRegistry()
}

export function addProject(directory: string): Project {
  const normalized = directory.replace(/\/+$/, '')
  if (!existsSync(normalized)) {
    throw new Error(`目录不存在: ${normalized}`)
  }
  const existing = readRegistry().find((p) => p.directory === normalized)
  if (existing) return existing

  const project: Project = {
    id: randomUUID(),
    name: basename(normalized),
    directory: normalized,
    createdAt: Date.now(),
  }
  mkdirSync(getProjectSessionDir(project.id), { recursive: true })
  writeRegistry([...readRegistry(), project])
  log.info('已添加项目:', project.name, project.directory)
  return project
}

export function removeProject(projectId: string): void {
  writeRegistry(readRegistry().filter((p) => p.id !== projectId))
  rmSync(join(app.getPath('userData'), 'projects', projectId), {
    recursive: true,
    force: true,
  })
  log.info('已删除项目:', projectId)
}

export function listProjectSessions(project: Project): Promise<SessionInfo[]> {
  return SessionManager.list(project.directory, getProjectSessionDir(project.id))
}

export function removeSessionFile(sessionPath: string): void {
  rmSync(sessionPath, { force: true })
  log.info('已删除会话文件:', sessionPath)
}
