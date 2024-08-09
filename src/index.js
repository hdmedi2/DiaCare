const { app, BrowserWindow, ipcMain, session, Menu, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { runAutomation } = require('./automation');

const SESSION_FILE_PATH = path.join(app.getPath('userData'), 'session.json');
const SETTINGS_FILE_PATH = path.join(app.getPath('userData'), 'settings.json');

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
const createSettingWindow = () => {
  const settingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    parent: BrowserWindow.getFocusedWindow(),
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
    autoHideMenuBar: true,
  });

  settingWindow.loadFile(path.join(__dirname, 'setting.html'));

  settingWindow.webContents.on('did-finish-load', () => {
    const settings = loadSettings();
    settingWindow.webContents.send('load-settings', settings);
  });
};

const saveSettings = (settings) => {
  try {
    console.log("Saving settings:", settings);
    const settingsString = JSON.stringify(settings);

    let encryptedSettings;
    if (app.isReady() && safeStorage.isEncryptionAvailable()) {
      encryptedSettings = safeStorage.encryptString(settingsString);
      console.log('Encrypted settings:', encryptedSettings.toString('hex'));  // Log as hex string for inspection
    } else {
      throw new Error('Encryption is not available.');
    }

    fs.writeFileSync(SETTINGS_FILE_PATH, encryptedSettings);
    console.log(`Settings saved to ${SETTINGS_FILE_PATH}`);
  } catch (error) {
    console.error(`Failed to save settings: ${error.message}`);
  }
};

const loadSettings = () => {
  if (fs.existsSync(SETTINGS_FILE_PATH)) {
    try {
      const encryptedSettings = fs.readFileSync(SETTINGS_FILE_PATH);  // Read as a buffer
      console.log('Loaded encrypted settings:', encryptedSettings.toString('hex'));  // Log as hex string

      let decryptedSettings;
      if (app.isReady() && safeStorage.isEncryptionAvailable()) {
        decryptedSettings = safeStorage.decryptString(encryptedSettings);
        console.log('Decrypted settings:', decryptedSettings);  // Log decrypted string for inspection
      } else {
        throw new Error('Decryption is not available.');
      }

      return JSON.parse(decryptedSettings);
    } catch (error) {
      console.error(`Failed to load settings: ${error.message}`);
      return {};
    }
  }
  return {};
};

app.whenReady().then(() => {
  createWindow();

  const menu = Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggledevtools' }, { role: 'resetzoom' }, { role: 'zoomin' }, { role: 'zoomout' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
    { label: 'Help', submenu: [{ label: 'Learn More', click: () => require('electron').shell.openExternal('https://electronjs.org') }] },
    {
      label: 'Setting',
      submenu: [{ label: '인증 정보 관리하기', click: createSettingWindow }]
    }
  ]);

  Menu.setApplicationMenu(menu);
});

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
app.on('window-all-closed', async () => {
  await saveSessionData();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle IPC messages from the renderer process.
ipcMain.on('start-playwright', async (event, data) => {
  try {
    await runAutomation(data);
  } catch (error) {
    console.error('Error running automation:', error);
  }
});

ipcMain.on('save-settings', (event, data) => {
  saveSettings(data);
});

ipcMain.on('load-settings', (event) => {
  const settings = loadSettings();
  event.reply('load-settings', settings);
});
