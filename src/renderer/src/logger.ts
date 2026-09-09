import log from 'electron-log/renderer'

/**
 * 渲染进程日志配置。
 * - 控制台：输出到 DevTools 控制台
 * - IPC：转发到主进程，由主进程统一写入日志文件
 *
 * 使用时：import log from './logger'
 * log.info / log.warn / log.error / log.debug ...
 */

log.transports.console.level = import.meta.env.DEV ? 'debug' : 'info'
log.transports.ipc.level = import.meta.env.DEV ? 'debug' : 'info'

export default log
