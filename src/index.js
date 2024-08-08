const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { runAutomation } = require('./automation');

const SESSION_FILE_PATH = path.join(app.getPath('userData'), 'session.json');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  // Maximize the window
  mainWindow.maximize();

  // Load session data
  await loadSessionData();

  // Load the initial URL.
  mainWindow.loadURL('https://pharm.hdmedi.kr/');

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// Function to save session data
const saveSessionData = async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({});
    const cookiesWithUrl = cookies.map(cookie => {
      const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
      const url = `${cookie.secure ? 'https' : 'http'}://${domain}${cookie.path}`;
      return { ...cookie, url };
    });
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(cookiesWithUrl), 'utf-8');
  } catch (error) {
    console.error(`Failed to save session data: ${error.message}`);
  }
};

// Function to load session data
const loadSessionData = async () => {
  if (fs.existsSync(SESSION_FILE_PATH)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, 'utf8'));
      for (const cookie of cookies) {
        await session.defaultSession.cookies.set(cookie);
      }
    } catch (error) {
      console.error(`Failed to load session data: ${error.message}`);
    }
  }
};

// Function to clear cache if there are issues
const clearCache = () => {
  const cachePath = path.join(app.getPath('userData'), 'Cache');
  fs.rm(cachePath, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error(`Failed to clear cache: ${err.message}`);
    } else {
      console.log('Cache cleared');
    }
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Clear cache if there's a disk cache error
app.on('web-contents-created', (event, webContents) => {
  webContents.on('crashed', clearCache);
  webContents.on('did-fail-load', clearCache);
});

// On OS X it's common to re-create a window in the app when the
// dock icon is clicked and there are no other windows open.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  saveSessionData().then(() => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});

// Handle IPC messages from the renderer process.
ipcMain.on('start-playwright', async (event, data) => {
  try {
    await runAutomation(data);
  } catch (error) {
    console.error('Error running automation:', error);
  }
});
