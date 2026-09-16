import { app, BrowserWindow, Menu, screen } from 'electron'
import path from 'node:path'
import { getConfig, updateConfig } from './settings'
import { setLang } from './i18n'
import { registerIpc } from './ipc'

app.setPath('userData', process.env.NEMO_USER_DATA || path.join(app.getPath('appData'), 'nema-launcher'))
setLang(getConfig().language)

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()
else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) { if (win.isMinimized()) win.restore(); win.focus() }
  })
}

let win: BrowserWindow | null = null
export function getMainWindow(): BrowserWindow | null { return win }

function createWindow(): void {
  const cfg = getConfig()
  const light = getConfig().theme?.mode === 'light'
  win = new BrowserWindow({
    width: cfg.windowBounds?.width || 1240,
    height: cfg.windowBounds?.height || 780,
    minWidth: 960, minHeight: 620,
    frame: false, resizable: true,
    backgroundColor: light ? '#eef0f3' : '#000000', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  Menu.setApplicationMenu(null)
  win.once('ready-to-show', () => win?.show())
  const timer = setInterval(() => {
    if (!win || win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return
    const b = win.getBounds()
    updateConfig({ windowBounds: { x: b.x, y: b.y, width: b.width, height: b.height } })
  }, 3000)
  win.on('close', () => clearInterval(timer))
  win.on('closed', () => { win = null })
  win.webContents.on('console-message', (_e, level, message) => console.log(`[renderer:${level}] ${message}`))
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
  const b = cfg.windowBounds
  if (b?.x != null && b?.y != null) {
    const visible = screen.getAllDisplays().some((d) => b.x! >= d.workArea.x - 100 && b.x! < d.workArea.x + d.workArea.width)
    if (visible) win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height })
  }
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => app.quit())
