const {PHARM_URL, MEDICARE_FIND_PHARMCY_BY_BIZNO_URL, SAVE_LOG_DIR} = require("../config/default.json");
const axios = require('axios');
const {BrowserWindow} = require("electron");
const log = require("electron-log");
const fs = require("fs");
const path = require("path");
const today = new Date();
const year = today.getFullYear(); // 2023
const month = (today.getMonth() + 1).toString().padStart(2, '0'); // 06
const day = today.getDate().toString().padStart(2, '0'); // 18

const dateString = year + '-' + month + '-' + day; // 2023-06-18

// 폴더 없으면 생성
if (!fs.existsSync(SAVE_LOG_DIR)) {
  fs.mkdirSync(SAVE_LOG_DIR, { recursive: true });
}

Object.assign(console, log.functions);
log.transports.file.resolvePathFn = () => path.join(SAVE_LOG_DIR, 'main-' + dateString +'.log');

const sendLogToServer = async (docId, status, message, csrfToken, csrfHeader) => {
  try {
    console.log(`Status: ${status}, Message: ${message}, csrfToken: ${csrfToken}, csrfHeader: ${csrfHeader}`);
    
    const { manageLocalData } = require('./index');
    const data = await manageLocalData('session');
    const cookieHeader = data.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const response = await axios.post(PHARM_URL+'pharm/diabetes/calc-detail/claims',
    {
      pharmacyPatientDiabetesTreatId: docId,
      status: status,
      result: message
    }, {
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
        [csrfHeader]: csrfToken
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

const pharmacyListByBizNo = async (cookieData, bizNo) => {
  try {
    let param = {
        'PAY_CLSFC_CD': '3170', //
        'SRCH_TYPE': '3',
        'SRCH_KEY': bizNo
    };

    const cookieHeader = cookieData.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    //const url = 'https://medicare.nhis.or.kr/portal/bk/z/300/selectBcbnfSlEntrUnityMgmtList.do';
    const response = await axios.post(MEDICARE_FIND_PHARMCY_BY_BIZNO_URL,
        {
          param
        }, {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'ko-KR,ko;q=0.9',
            'Connection': 'keep-alive',
            'Content-Type': 'application/json; charset="UTF-8"',
            'Cookie': cookieHeader,
            // 'csrfHeader': csrfToken
          }
        });

    console.log('Response:', response.status);

    return response.data.data.length;

  } catch (error) {
    console.error('Error sending log:', error);
    if (error.response) {
      console.log('Error Response Headers:', error.response.headers);
      console.error('Server responded with:', error.response.data);
    } else {
      console.error('No response from server:', error.message);
    }

    return 0;
  }

};

/**
 * 일렉트론에서 웹페이지로 JS 이벤트를 실행시키고 싶을때 쓰는 로직
 * @param processLogic JS 로직
 */
const electronToWebEventRun = async (processLogic) => {
  BrowserWindow.getAllWindows().forEach((window) => {
    let url = window.webContents.getURL();
    console.log(url);
    if (url.includes(PHARM_URL)) {
      window.webContents.executeJavaScript(processLogic)
          .then(() => {
            console.log("WebContents executed with code:");
          })
          .catch((error) => {
            console.error('JavaScript 실행 중 오류가 발생했습니다:', error);
          });

    }

  });
}

module.exports = { sendLogToServer, pharmacyListByBizNo, electronToWebEventRun };