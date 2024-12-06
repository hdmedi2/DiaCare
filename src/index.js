const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  Menu,
  safeStorage,
    screen
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
// const {create} = require("axios");
const {PHARM_URL, SAVE_LOG_DIR, SAVE_MAIN_DIR } = require("../config/default.json");
const log = require("electron-log");
const today = new Date();
const year = today.getFullYear(); // 2023
const month = (today.getMonth() + 1).toString().padStart(2, '0'); // 06
const day = today.getDate().toString().padStart(2, '0'); // 18
const dateString = year + '-' + month + '-' + day; // 2023-06-18
const { version } = require('../package.json');

// 로그 폴더 없으면 생성
if (!fs.existsSync(SAVE_LOG_DIR)) {
  fs.mkdirSync(SAVE_LOG_DIR, { recursive: true });
}

// 데이터 다운로드 폴더 없으면 생성
if (!fs.existsSync(SAVE_MAIN_DIR+"/"+dateString)) {
  fs.mkdirSync(SAVE_MAIN_DIR+"/"+dateString, { recursive: true });
}

Object.assign(console, log.functions);
log.transports.file.resolvePathFn = () => path.join(SAVE_LOG_DIR, 'main-' + dateString +'.log');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
log.transports.file.maxsize = 500 * 1024 * 1024; // 500MB


// 중복실행 방지 체크
// 다른 인스턴스가 실행 중인지 확인
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 이미 애플리케이션이 실행 중이면 새 인스턴스 종료
  app.quit();
}

const createWindow = async () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  console.log(`Screen resolution: ${width}x${height}`);

  const mainWindow = new BrowserWindow({
    webPreferences: {
      width: width,
      height: height,
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  mainWindow.maximize();
  await loadLocalData("session");
  mainWindow.loadURL(PHARM_URL);
};

const deleteSession = async () => {
  const filePath = SESSION_FILE_PATH;
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (error) => {
      if (error) {
        console.error(`Error deleting file: ${error}`);
      } else {
        console.log(`Session: ${filePath} has been deleted`);
      }
    });
  }
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
    ? path.join(__dirname, "../html/mediCare.html")
    : path.join(__dirname, "../html/setting.html");
  settingWindow.loadFile(htmlFilePath);

  settingWindow.webContents.on("did-finish-load", async () => {
    const settings = await loadLocalData("settings");
    settingWindow.webContents.send("load-settings", settings || {});
  });
};


// 프로그램이 기동되면 새로운 창을 만들고, 메뉴를 붙이고,
app.whenReady().then(() => {
  createWindow();

  //autoUpdater.autoDownload = true;
  /*process.env.NODE_ENV = "development";
  console.log("process.env.NODE_ENV = ", process.env.NODE_ENV);*/

  // 개발 환경에서 강제로 업데이트를 체크
  // if (process.env.NODE_ENV === 'development') {
  //  autoUpdater.updateConfigPath = path.join(__dirname, './dev-app-update.yml');
  // }
  // 자동 업데이트 체크
  /*autoUpdater.checkForUpdatesAndNotify().then(() => {
    console.log("최신 버전이 있는지 확인합니다");
  } );*/

  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
          {  label: "로그아웃",
            click: async () => {
              await deleteSession();
              console.log("로그아웃 되었습니다....")
            }, // 로그아웃
          },
          { label: "종료", role: "quit" }

        ]
    },
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
      label: "버전",
      submenu: [
        {
          label: `Ver.${version}`,
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
          label: "청구 내역 가져오기",
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


// 사용자가 모든 창을 닫을 때 앱 종료_
app.on('window-all-closed', async () => {
  await saveSessionData();
  console.log("정상 종료되었습니다....");
  app.quit();
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

ipcMain.on("start-check-delegation", async (event, data_0) => {
  try {
    const settings = await manageLocalData("settings");

    if (settings) {
      const automationData = {
        ...settings,
        ...data_0,
      };
      //console.log("Automation Data:", automationData); // 확인용 출력
      await checkDelegation(automationData);

    } else {
      console.error("Failed to load settings.");
    }
  } catch (error) {
    console.error("Error Reading:", error);
  }
});

ipcMain.on("start-crawl-delegation", async (event, data_0) => {
  try {
    const settings = await manageLocalData("settings");

    if (settings) {
     const automationData = {
       ...settings,
       ...data_0,
     };

      await crawlDelegation(automationData);
    } else {
      console.error("Failed to load settings.");
    }
  } catch (error) {
    console.error("Error Reading:", error);
  }
});

ipcMain.on("start-check-bill", async () => {
  try {
    const settings = await manageLocalData("settings");

    if (settings) {
      await checkBilling(settings);
    } else {
      console.error("Failed to load settings.");
    }
  } catch (error) {
    console.error("Error Reading:", error);
  }
});

ipcMain.on("upload-delegation-list", async (event, data) => {
  try {
    const settings = await manageLocalData("settings"); //
    if (settings) {
      // Merge the settings with the data received from the renderer process
      const automationData = {
        ...settings,
        ...data,
      };
      //console.log("Automation Data:", automationData); // 확인용 출력
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
      //console.log("Automation Data:", automationData); // 확인용 출력
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

/**
 * 일렉트론에서 웹페이지로 JS 이벤트를 실행시키고 싶을때 쓰는 로직
 * @param processLogic JS 로직
 */
/*
function electronToWebEventRun(processLogic) {
  BrowserWindow.getAllWindows().forEach((window) => {
    let url = window.webContents.getURL();
    if (url.includes(PHARM_URL)) {
      window.webContents.executeJavaScript(processLogic)
          .then((clicked) => {
            if (clicked) {
              console.log('요소를 클릭했습니다.');
            } else {
              console.log('해당 ID를 가진 요소가 존재하지 않습니다.');
            }
          }).catch((error) => {
        console.error('JavaScript 실행 중 오류가 발생했습니다:', error);
      });

    }

  });
}*/

log.info(`=============${dateString}=============================`);

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', () => {
  log.info("업데이트가 가능합니다. 새로운 버전을 설치합니다.");
  console.log('업데이트가 가능합니다. 새로운 버전을 설치합니다.');
  log.info("========= 종료 후 설치 ");
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`다운로드 진행률: ${progress.percent}%`);
  log.info(`다운로드 진행률: ${progress.percent}%`);

});

autoUpdater.on('update-not-available', () => {
  log.info("현재 최신 버전입니다.");
  console.log('현재 최신 버전입니다.');
});

autoUpdater.on('error', (err) => {
  log.info("업데이트 중 오류 발생", err);
  console.error('업데이트 중 오류 발생:', err);
});

autoUpdater.on('update-downloaded', () => {
  console.log('업데이트가 다운로드되었습니다. 애플리케이션을 재시작하여 설치를 완료합니다.');
  log.info('업데이트가 다운로드되었습니다. 애플리케이션을 재시작하여 설치를 완료합니다.');
  autoUpdater.quitAndInstall();
});
