import { app } from 'electron'
import log from 'electron-log/main'

/**
 * 主进程日志配置。
 *
 * 输出通道：
 * - 控制台（终端）
 * - 文件：默认写入系统日志目录，macOS 为 ~/Library/Logs/{appName}/main.log
 *
 * 渲染进程日志通过 IPC 转发到主进程，统一写入同一文件，
 * 因此一个日志文件即可同时看到主进程 + 渲染进程的完整日志。
 */

const isDev = !app.isPackaged

log.transports.console.level = isDev ? 'debug' : 'info'
log.transports.file.level = isDev ? 'debug' : 'info'
log.transports.file.maxSize = 5 * 1024 * 1024 // 超过 5MB 自动滚动

// 启用渲染进程日志桥接：自动为 session 注册 electron-log 的 preload，
// 在渲染进程全局暴露 window.__electronLog，供 electron-log/renderer 使用。
log.initialize()

// 捕获未处理异常与 Promise rejection，写入日志（不弹系统错误对话框）
log.errorHandler.startCatching({ showDialog: false })

// 记录关键 Electron 事件（渲染进程崩溃、加载失败等）
log.eventLogger.startLogging()

/** 当前日志文件的绝对路径 */
export function getLogFilePath(): string {
  return log.transports.file.getFile().path
}

export default log
