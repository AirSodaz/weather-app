import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Store from 'electron-store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('Main process starting...');

let store: any;
try {
    store = new Store();
    console.log('Store initialized successfully');
} catch (err) {
    console.error('Failed to initialize store:', err);
}

// ... (paths)

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'] || 'http://localhost:5173'

function createWindow() {
    console.log('createWindow called');
    try {
        win = new BrowserWindow({
            width: 400,
            height: 600,
            minWidth: 320,
            minHeight: 400,
            autoHideMenuBar: true,
            icon: path.join(process.env.VITE_PUBLIC as string, 'electron-vite.svg'),
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
            },
        })
        console.log('BrowserWindow created');

        // Test active push message to Renderer-process.
        win.webContents.on('did-finish-load', () => {
            console.log('did-finish-load');
            win?.webContents.send('main-process-message', (new Date).toLocaleString())
        })

        // Make all links open with the browser, not with the application
        win.webContents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith('https:')) {
                import('electron').then(({ shell }) => shell.openExternal(url));
            }
            return { action: 'deny' };
        });

        if (VITE_DEV_SERVER_URL) {
            console.log('Loading URL:', VITE_DEV_SERVER_URL);
            win.loadURL(VITE_DEV_SERVER_URL)
        } else {
            console.log('Loading file');
            // win.loadFile('dist/index.html')
            win.loadFile(path.join(process.env.DIST as string, 'index.html'))
        }

        win.on('closed', () => {
            console.log('Window closed');
            win = null;
        });
    } catch (e) {
        console.error('Error in createWindow:', e);
    }
}

// IPC Handlers for Electron Store
ipcMain.handle('store-get', async (_event, key) => {
    if (!store) return null;
    return store.get(key);
});

ipcMain.handle('store-set', async (_event, key, value) => {
    if (!store) return;
    store.set(key, value);
});

ipcMain.handle('store-delete', async (_event, key) => {
    if (!store) return;
    store.delete(key);
});

// IPC Handlers for Window Controls
ipcMain.on('window-minimize', () => {
    win?.minimize();
});

ipcMain.on('window-close', () => {
    win?.close();
});

ipcMain.on('window-maximize', () => {
    if (win?.isMaximized()) {
        win.restore();
    } else {
        win?.maximize();
    }
});

app.on('window-all-closed', () => {
    console.log('window-all-closed event');
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    console.log('activate event');
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

console.log('Waiting for app ready...');
app.whenReady().then(() => {
    console.log('App ready');
    createWindow();
}).catch(e => {
    console.error('App ready failed:', e);
});
