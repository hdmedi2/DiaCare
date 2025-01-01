const { chromium } = require("playwright");
const fs = require("fs");
const { parse } = require("json2csv");
const {sendDelegationJsonToServer} = require("./sendDelegationToBack");
const {MEDICARE_URL, SAVE_MAIN_DIR, SAVE_LOG_DIR, SAVE_FILE_DIR, SAVE_HOMETAX_DIR } = require("../config/default.json");
const os = require("os");
const path = require("path");
const log = require("electron-log");
const today = new Date();
const year = today.getFullYear(); // 2023
const month = (today.getMonth() + 1).toString().padStart(2, '0'); // 06
const day = today.getDate().toString().padStart(2, '0'); // 18
const dateString = year + '-' + month + '-' + day; // 2023-06-18

let logPath = "";
let userFileDirectory = "";
let userHomeTaxDirectory = "";
/* 2. 운영체제 별로 로그, 첨부파일, 세금계산서 자료 경로 지정 */
const osName = os.platform();
// 2-1. 위치 설정
if (osName === "win32") {
  const systemDrive = process.env.SYSTEMDRIVE; // 일반적으로 'C:' 반환
  // C:\\DiaCare\\logs
  logPath = path.join(systemDrive, SAVE_MAIN_DIR, SAVE_LOG_DIR);
  // C:\\DiaCare\\files\\2024-12-14
  userFileDirectory  = path.join(systemDrive, SAVE_MAIN_DIR, SAVE_FILE_DIR, dateString);
  // C:\\DiaCare\\hometax\\2024-12-14
  userHomeTaxDirectory = path.join(systemDrive, SAVE_MAIN_DIR, SAVE_HOMETAX_DIR, dateString);
}
else {
  // Windows 이와의 운영체제인 경우는 홈 디렉토리 아래에 로그 기록
  const homeDir = os.homedir();
  // ~/DiaCare/logs
  logPath = path.join(homeDir, SAVE_MAIN_DIR, SAVE_LOG_DIR);
  // ~/DiaCare/files/2024-12-14
  userFileDirectory = path.join(homeDir, SAVE_MAIN_DIR, SAVE_FILE_DIR, dateString);
  // ~/DiaCare/hometax/2024-12-14
  userHomeTaxDirectory = path.join(homeDir, SAVE_MAIN_DIR, SAVE_HOMETAX_DIR, dateString);
}

// 2-2. 로그 폴더 없으면 생성
if (!fs.existsSync(logPath)) {
  fs.mkdirSync(logPath, { recursive: true });
}

// 2-3. 사용자 파일 디렉토리 생성
if (!fs.existsSync(userFileDirectory)) {
  fs.mkdirSync(userFileDirectory, { recursive: true });
}

// 2-4. 홈택스 신고 자료 디렉토리 생성
if (!fs.existsSync(userHomeTaxDirectory)) {
  fs.mkdirSync(userHomeTaxDirectory, { recursive: true });
}

Object.assign(console, log.functions);
log.transports.file.resolvePathFn = () => path.join(logPath, 'main-' + dateString +'.log');



async function checkDelegation(data) {
  const channels = [
    "chrome",
    "chrome-beta",
    "chrome-dev",
    "chrome-canary",
    "msedge",
    "msedge-beta",
    "msedge-dev",
    "msedge-canary",
  ];
  let browser;

  for (const channel of channels) {
    try {
      browser = await chromium.launch({ headless: false, channel });
      break;
    } catch (error) {
      console.warn(`Failed to launch ${channel}: ${error.message}`);
    }
  }
  if (!browser) {
    console.error("No supported browser channels found.");
    return;
  }

// 요양마당 화면 크기 조절
const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;
  const context = await browser.newContext({
    viewport: { width, height }, // Playwright가 뷰포트를 설정하지 않도록 설정
  });
  const page = await context.newPage();
  // 시스템 화면 크기를 가져오는 기능
  await page.goto(MEDICARE_URL);

  // 공인인증서 로그인
  await page.locator("#grp_loginBtn").click();
  await page.locator("#btnCorpLogin").click();
  await page.getByRole("radio", { name: data.certificateLocation }).click();
  // 하드디스크의 경우 certificateLocation 값이 비어있기 때문에 오류 메시지가 뜸
  try {
    const linkElement = await page.getByRole("link", {
      name: data.certificatePath,
    });
    if (linkElement) {
      await linkElement.click();
      console.log("Element was clicked.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
  await page.getByText(data.certificateName,{exact:true}).click();
  await page.getByRole("textbox", { name: "인증서 암호" }).click();
  await page
    .getByRole("textbox", { name: "인증서 암호" })
    .fill(data.certificatePassword);
  await page.getByRole("button", { name: "확인" }).click();
  //await page.getByRole('link', { name: data.corporateId }).click();

  // 요양비청구위임내역등록
  await page.getByRole("link", { name: "요양비", exact: true }).click();
  await page
    .getByRole("link", { name: "요양비청구위임내역조회", exact: true })
    .click();

  const today = new Date();
  // const year = today.getFullYear();
  // const month = today.getMonth() + 1;
  const day = today.getDate();
  const frame = page.frameLocator(
    'iframe[name="windowContainer_subWindow1_iframe"]'
  );

  //await frame.locator("#cal_s_fr_dt_img").click();
  //await frame.getByRole("button", { name: "현재일" }).click();

  //await frame.getByRole("button", { name: `${day}` }).click();
  await page
    .frameLocator('iframe[name="windowContainer_subWindow1_iframe"]')
    .getByRole("link", { name: "조회" })
    .click();

  // 버튼 클릭 후 발생하는 특정 URL의 네트워크 응답을 기다림
  const [response] = await Promise.all([
    // 특정 URL에 대한 응답을 기다림
    page.waitForResponse(
      (response) =>
        response.url() ===
        "https://medicare.nhis.or.kr/portal/bk/c/193/selectBcbnfDmdMdtResultList.do"
    ),
  ]);

  // 응답 상태와 URL을 콘솔에 출력
  console.log("<<", response.status(), response.url());
  let count = 0;
  try {
    // 응답 본문 데이터를 JSON 형식으로 가져오기
    const responseBody = await response.json();
    //console.log('Response body:', responseBody);

    if (responseBody.dl_tbbibo59) {
      console.log("Number of rows:", responseBody.dl_tbbibo59.length);
      count = responseBody.dl_tbbibo59.length;
      //let json = JSON.stringify(responseBody.dl_tbbibo59);
      await sendDelegationJsonToServer(responseBody.dl_tbbibo59, data);

      /*const filePos = "C:\\output.json";
      const filePosRead = "file://output.json"

      fs.writeFileSync(
        //path.join(__dirname, "output.json"),
        filePos ,
        JSON.stringify(responseBody.dl_tbbibo59)
      );

      var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

      let rawFile = new XMLHttpRequest();
      rawFile.open("GET", filePosRead, false);
      rawFile.onreadystatechange = function () {
        if (rawFile.readyState === 4) {
          if (rawFile.status === 200 || rawFile.status == 0) {
            var allText = rawFile.responseText;

            console.log(allText);
          }
        }
      };*/

      // CSV로 저장
      //const fields = Object.keys(responseBody.dl_tbbibo59[0]); // CSV 헤더로 사용될 필드명
      //const csv = parse(responseBody.dl_tbbibo59, { fields });

      //fs.writeFileSync("output_delegation.csv", csv);
      //console.log("Data saved to output.csv");
    } else {
      console.log("No data found in the response");
    }
  } catch (error) {
    console.error("Failed to get response body:", error);
  }
  await browser.close();
}
module.exports = { checkDelegation };
