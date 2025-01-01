const { chromium } = require("playwright");
const fs = require("fs");
const { parse } = require("json2csv");
const {XMLHttpRequest} = require("xmlhttprequest");
const {sendMedicareClaimJsonToServer} = require("./sendDelegationToBack");
const {MEDICARE_URL,SAVE_LOG_DIR, SAVE_FILE_DIR, SAVE_HOMETAX_DIR, SAVE_MAIN_DIR} = require("../config/default.json");
const log = require("electron-log");
const path = require("path");
const os = require("os");
const today = new Date();
const year = today.getFullYear(); // 2023
const month = (today.getMonth() + 1).toString().padStart(2, '0'); // 06
const day = today.getDate().toString().padStart(2, '0'); // 18
const dateString = year + '-' + month + '-' + day; // 2023-06-18

let logPath = "";
let userHomeTaxDirectory = "";
let userFileDirectory = "";
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
/*
if (!fs.existsSync(userFileDirectory)) {
  fs.mkdirSync(userFileDirectory, { recursive: true });
}
*/

// 2-4. 홈택스 신고 자료 디렉토리 생성
/*
if (!fs.existsSync(userHomeTaxDirectory)) {
  fs.mkdirSync(userHomeTaxDirectory, { recursive: true });
}
*/

Object.assign(console, log.functions);
log.transports.file.resolvePathFn = () => path.join(logPath, 'main-' + dateString +'.log');

async function checkBilling(data) {
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
    viewport: { width, height}, // Playwright가 뷰포트를 설정하지 않도록 설정
  });
  const page = await context.newPage();
  // 시스템 화면 크기를 가져오는 기능
  await page.goto(MEDICARE_URL);

  //const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // 공인인증서 로그인
  await page.locator("#grp_loginBtn").click();
  await page.locator("#btnCorpLogin").click();
  await page.getByRole("radio", { name: data.certificateLocation }).click();
  // 하드디스크의 경우 certificateLocation 값이 비어있기 때문에 오류 메시지가 뜸
  try {
    const linkElement = await page.getByRole("link", {
      name: data.certificatePath,
    });
    await page.waitForTimeout(1000);
    if (linkElement) {
      await linkElement.click();
      console.log("Element was clicked.");
    }
    await page.waitForTimeout(2000);
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

  // 요양비청구위임내역 조회
  await page.waitForTimeout(2000);
  await page.getByRole("link", { name: "요양비", exact: true }).click();
  await page
    .getByRole("link", { name: "요양비청구내역조회", exact: true })
    .click();

  const frame = page.frameLocator(
    'iframe[name="windowContainer_subWindow1_iframe"]'
  );
  await frame.locator("#wq_uuid_39").click();

  // 버튼 클릭 후 발생하는 특정 URL의 네트워크 응답을 기다림
  const [response] = await Promise.all([
    // 특정 URL에 대한 응답을 기다림
    page.waitForResponse(
      (response) =>
        response.url() ===
        "https://medicare.nhis.or.kr/portal/bk/c/230/selectBcbnfDmdResultList.do"
    ),
    // 특정 버튼 클릭 (이 클릭에 의해 네트워크 요청이 발생한다고 가정)
  ]);

  // 응답 상태와 URL을 콘솔에 출력
  console.log("<<", response.status(), response.url());
  try {
    // 응답 본문 데이터를 JSON 형식으로 가져오기
    const responseBody = await response.json();
    //console.log('Response body:', responseBody);

    if (responseBody.dl_tbbibo05) {
      console.log("Number of rows:", responseBody.dl_tbbibo05.length);

      await sendMedicareClaimJsonToServer(responseBody.dl_tbbibo05, data);

      /***** Start 파일로 저장 *****/
      /*const saveDir = "C:\\DiaCare\\billing";
      const filePos = path.join(saveDir, "bill-"+dateString+".json");
      console.log("file save dir : ", filePos);

      const filePosRead = "file://"+Date.now()+"output.json"

      // 폴더 없으면 생성
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }

      fs.writeFileSync(
          //path.join(__dirname, "output.json"),
          filePos ,
          JSON.stringify(responseBody.dl_tbbibo05)
      );

      var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

      let rawFile = new XMLHttpRequest();
      rawFile.open("GET", filePosRead, false);
      rawFile.onreadystatechange = function () {

        console.log(rawFile.readyState, " ", rawFile.status );
        if (rawFile.readyState === 4) {
          if (rawFile.status === 200 || rawFile.status == 0) {
            var allText = rawFile.responseText;

            console.log(allText);
          }
        }
      };*/

      //rawFile.send(null);

      // CSV로 저장
      // const fields = Object.keys(responseBody.dl_tbbibo05[0]); // CSV 헤더로 사용될 필드명
      // const csv = parse(responseBody.dl_tbbibo05, { fields });

      //fs.writeFileSync("output_bill.csv", csv);
      //console.log("Data saved to output.csv");
      /***** End 파일로 저장 *****/
    } else {
      console.log("No data found in the response");
    }
  } catch (error) {
    console.error("Failed to get response body:", error);
  }
  await browser.close();
}
module.exports = { checkBilling };
