import { join } from 'node:path'
import { BrowserWindow, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { getSavedWindowBounds, saveWindowBounds } from '@main/services/config'
import { ensureVisibleWindowBounds } from '@main/window-bounds'
import { log } from '@main/logging'

export function createMainWindow(): BrowserWindow {
  const savedBounds = ensureVisibleWindowBounds(getSavedWindowBounds(), screen.getAllDisplays())
  const position =
    savedBounds.x === undefined || savedBounds.y === undefined
      ? {}
      : { x: savedBounds.x, y: savedBounds.y }

  const mainWindow = new BrowserWindow({
    ...position,
    width: savedBounds.width,
    height: savedBounds.height,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: 'Desktop App',
    backgroundColor: '#101418',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: is.dev,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    log.info('Main window shown')
  })

  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds()
    saveWindowBounds(bounds)
    log.info('Main window bounds saved')
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalNavigation(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL()
    if (url !== currentUrl) {
      event.preventDefault()
      if (isAllowedExternalNavigation(url)) {
        void shell.openExternal(url)
      }
    }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function isAllowedExternalNavigation(url: string): boolean {
  try {
    return ['https:', 'mailto:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}
