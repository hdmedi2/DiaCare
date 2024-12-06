const axios = require("axios");
const {PHARM_URL, SAVE_LOG_DIR} = require("../config/default.json");
const log = require("electron-log");
const fs = require("fs");
const path = require("path");
const os = require("os");
const today = new Date();
const year = today.getFullYear(); // 2023
const month = (today.getMonth() + 1).toString().padStart(2, '0'); // 06
const day = today.getDate().toString().padStart(2, '0'); // 18

const dateString = year + '-' + month + '-' + day; // 2023-06-18

let logPath = "";
// let userHomeDirectory = "";
const osName = os.platform();

if (osName === "win32") {
  const systemDrive = process.env.SYSTEMDRIVE; // 일반적으로 'C:' 반환
  logPath = path.join(systemDrive, SAVE_MAIN_DIR, SAVE_LOG_DIR);
  // userHomeDirectory = path.join(systemDrive, SAVE_MAIN_DIR, dateString);
}
else {
  // Windows 이와의 운영체제인 경우는 홈 디렉토리 아래에 로그 기록
  // ~/DiaCare/logs
  const homeDir = os.homedir();
  logPath = path.join(homeDir, SAVE_MAIN_DIR, SAVE_LOG_DIR);
  // userHomeDirectory = path.join(homeDir, SAVE_MAIN_DIR, dateString);
}

// 로그 폴더 없으면 생성
if (!fs.existsSync(logPath)) {
  fs.mkdirSync(logPath, { recursive: true });
}

Object.assign(console, log.functions);
log.transports.file.resolvePathFn = () => path.join(logPath, 'main-' + dateString +'.log');

const sendDelegationToBack = async (
  pharmacyId,
  status,
  message,
  csrfToken,
  csrfHeader
) => {
  try {
    console.log(
      `Status: ${status}, Message: ${message}, csrfToken: ${csrfToken}, csrfHeader: ${csrfHeader}`
    );

    const { manageLocalData } = require("./index");
    const data = await manageLocalData("session");
    const cookieHeader = data
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const response = await axios.post(
        PHARM_URL+"pharm/diabetes/renew/delegation-list",
      {
        pharmacyId,
        status: status,
        result: message,
      },
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
          [csrfHeader]: csrfToken,
        },
      }
    );
    console.log("Response Status:", response.status);
  } catch (error) {
    console.error("Error sending log:", error);
    if (error.response) {
      console.log("Error Response Headers:", error.response.headers);
      console.error("Server responded with:", error.response.data);
    } else {
      console.error("No response from server:", error.message);
    }
  }
};

const sendDelegationJsonToServer = async (json, data) => {
  try {
    const { manageLocalData } = require('./index');
    const sessionData = await manageLocalData('session');
    const cookieHeader = sessionData.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const response = await axios.post(PHARM_URL + 'pharm/diabetes/json-delegation-save',
        {
          json
        }, {
          headers: {
            'Cookie': cookieHeader,
            // 'Content-Type': 'application/json',
            'Content-Type': 'text/plain',
            [data.csrfHeader]: data.csrfToken
          }
        });
    console.log('Response Status:', response.status);
  } catch (error) {
    console.error('Error sending log:', error);
    if(error.response){
      console.log('Error Response Headers:', error.response.headers);
      console.error('Server responded with:', error.response.data);
    } else {
      console.error('No response from server:', error.message);
    }
  }
};

module.exports = { sendDelegationToBack, sendDelegationJsonToServer };
