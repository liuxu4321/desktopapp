import { app } from 'electron'
import log from 'electron-log/main'

export function configureLogging(): void {
  log.initialize()
  log.transports.file.level = app.isPackaged ? 'info' : 'warn'
  log.transports.console.level = app.isPackaged ? 'warn' : 'debug'
  log.info('Application logging initialized')
}

export { log }
