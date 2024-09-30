const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  Menu,
  safeStorage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { runAutomation_billing } = require("./automatic_billing");
const { runAutomation_delegation } = require("./automatic_delegation");
const { checkBilling } = require("./auto_checkBilling");
const { checkDelegation } = require("./auto_checkDelegation");
const { sendLogToServer } = require("./logUtil");
const { autoUpdater } = require("electron-updater");

const { crawlDelegation } = require("./crawl_delegation");
const { sendDelegationToBack } = require("./sendDelegationToBack");

const SESSION_FILE_PATH = path.join(app.getPath("userData"), "session.json");
const SETTINGS_FILE_PATH = path.join(app.getPath("userData"), "settings.json");

if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  mainWindow.maximize();
  await loadLocalData("session");
  mainWindow.loadURL("https://pharm.hdmedi.kr/");
};

const manageLocalData = async (type, data = null) => {
  const filePath = type === "session" ? SESSION_FILE_PATH : SETTINGS_FILE_PATH;

  if (data) {
    try {
      const serializedData = JSON.stringify(data);
      const encryptedData = safeStorage.encryptString(serializedData);
      fs.writeFileSync(filePath, encryptedData);
    } catch (error) {
      console.error(`Failed to save ${type} data: ${error.message}`);
    }
  } else {
    if (fs.existsSync(filePath)) {
      try {
        const encryptedData = fs.readFileSync(filePath);
        const decryptedData = safeStorage.decryptString(encryptedData);
        const parsedData = JSON.parse(decryptedData);

        // Ensure URL is provided for each cookie if it's session data
        if (type === "session") {
          for (const cookie of parsedData) {
            if (!cookie.url) {
              const domain = cookie.domain.startsWith(".")
                ? cookie.domain.substring(1)
                : cookie.domain;
              cookie.url = `${cookie.secure ? "https" : "http"}://${domain}${
                cookie.path
              }`;
            }
          }
        }

        return parsedData;
      } catch (error) {
        console.error(`Failed to load ${type} data: ${error.message}`);
        return null;
      }
    }
    return null;
  }
};
module.exports = { manageLocalData };
// Open the DevTools.
// mainWindow.webContents.openDevTools();
const loadLocalData = async (type) => {
  const data = await manageLocalData(type);
  if (type === "session" && data) {
    for (const cookie of data) {
      try {
        await session.defaultSession.cookies.set(cookie);
      } catch (error) {
        console.error(`Failed to load cookie: ${error.message}`);
      }
    }
  }
  return data;
};

const saveSessionData = async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({});
    const cookiesWithUrl = cookies.map((cookie) => {
      const domain = cookie.domain.startsWith(".")
        ? cookie.domain.substring(1)
        : cookie.domain;
      const url = `${cookie.secure ? "https" : "http"}://${domain}${
        cookie.path
      }`;
      return { ...cookie, url };
    });
    await manageLocalData("session", cookiesWithUrl);
  } catch (error) {
    console.error(`Failed to save session data: ${error.message}`);
  }
};

const clearCache = () => {
  const cachePath = path.join(app.getPath("userData"), "Cache");
  fs.rm(cachePath, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error(`Failed to clear cache: ${err.message}`);
    }
  });
};

const createSettingWindow = (options = {}) => {
  const settingWindow = new BrowserWindow({
    width: options.width || 630,
    height: options.height || 630,
    parent: BrowserWindow.getFocusedWindow(),
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
    },
    autoHideMenuBar: true,
  });

  // HTML 파일 로드
  const htmlFilePath = options.file
    ? path.join(__dirname, "mediCare.html")
    : path.join(__dirname, "setting.html");
  settingWindow.loadFile(htmlFilePath);

  settingWindow.webContents.on("did-finish-load", async () => {
    const settings = await loadLocalData("settings");
    settingWindow.webContents.send("load-settings", settings || {});
  });
};

app.whenReady().then(() => {
  createWindow();

  const menu = Menu.buildFromTemplate([
    { label: "File", submenu: [{ role: "quit" }] },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggledevtools" },
        { role: "resetzoom" },
        { role: "zoomin" },
        { role: "zoomout" },
        { role: "togglefullscreen" },
      ],
    },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "close" }] },
    {
      label: "Help",
      submenu: [
        {
          label: "Learn More",
          click: () =>
            require("electron").shell.openExternal("https://electronjs.org"),
        },
      ],
    },
    {
      label: "공인인증서",
      submenu: [{ label: "인증서 설정", click: createSettingWindow }],
    },
    {
      label: "요양마당",
      submenu: [
        {
          label: "위임/청구 내역 가져오기",
          click: () =>
            createSettingWindow({
              width: 350,
              height: 250,
              file: "mediCare.html",
            }), // 커스텀 설정 창
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
});

app.on("web-contents-created", (event, webContents) => {
  webContents.on("crashed", clearCache);
  webContents.on("did-fail-load", clearCache);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", async () => {
  await saveSessionData();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on("start-check-delegation", async (event) => {
  try {
    const settings = await manageLocalData("settings");

    if (settings) {
      await checkDelegation(settings);

      const buttonToBack = document.getElementById("triggerBtn");
      buttonToBack.click();


    } else {
      console.error("Failed to load settings.");
    }
  } catch (error) {
    console.error("Error Readung:", error);
  }
});

ipcMain.on("start-crawl-delegation", async (event) => {
  try {
    const settings = await manageLocalData("settings");

    if (settings) {
      await crawlDelegation(settings);
    } else {
      console.error("Failed to load settings.");
    }
  } catch (error) {
    console.error("Error Readung:", error);
  }
});

ipcMain.on("start-check-bill", async (event) => {
  try {
    const settings = await manageLocalData("settings");

    if (settings) {
      await checkBilling(settings);
    } else {
      console.error("Failed to load settings.");
    }
  } catch (error) {
    console.error("Error Readung:", error);
  }
});

ipcMain.on("upload-delegation-list", async (event, data) => {
  try {
    const settings = await manageLocalData("settings");
    if (settings) {
      // Merge the settings with the data received from the renderer process
      const automationData = {
        ...settings,
        ...data,
      };
      console.log("Automation Data:", automationData); // 확인용 출력
      await runAutomation_billing(automationData);
    } else {
      console.error("Failed to load settings.");
    }
  } catch (e) {
    console.error("Error running automation:", e.message);
    await sendDelegationToBack(
      data.docId,
      "fail",
      `Automation task failed: ${e.message}`,
      data.csrfToken,
      data.csrfHeader
    );
  }
});

ipcMain.on("start-playwright", async (event, data) => {
  try {
    const settings = await manageLocalData("settings");
    if (settings) {
      // Merge the settings with the data received from the renderer process
      const automationData = {
        ...settings,
        ...data,
      };
      console.log("Automation Data:", automationData); // 확인용 출력
      await runAutomation_billing(automationData);
    } else {
      console.error("Failed to load settings.");
    }
  } catch (e) {
    console.error("Error running automation:", e.message);
    await sendLogToServer(
      data.docId,
      "fail",
      `Automation task failed: ${e.message}`,
      data.csrfToken,
      data.csrfHeader
    );
  }
});

ipcMain.on("start", async (event, data_1) => {
  try {
    const settings = await manageLocalData("settings");
    if (settings) {
      // Merge the settings with the data_1 received from the renderer process
      const automationData = {
        ...settings,
        ...data_1,
      };
      await runAutomation_delegation(automationData);
    } else {
      console.error("Failed to load settings.");
    }
  } catch (error) {
    console.error("Error running automation:", error);
  }
});

ipcMain.on("save-settings", async (event, data) => {
  await manageLocalData("settings", data);
});

ipcMain.on("load-settings", async (event) => {
  const settings = await loadLocalData("settings");
  event.reply("load-settings", settings || {});
});
