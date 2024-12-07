const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { parse } = require("json2csv");

const {SAVE_LOG_DIR, SAVE_MAIN_DIR } = require("../config/default.json");
const log = require("electron-log");
const os = require("os");
const today = new Date();
const year = today.getFullYear(); // 2023
const month = (today.getMonth() + 1).toString().padStart(2, '0'); // 06
const day = today.getDate().toString().padStart(2, '0'); // 18

const dateString = year + '-' + month + '-' + day; // 2023-06-18

let logPath = "";
let userHomeDirectory = "";
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

async function crawlDelegation(data) {
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
  //await page.getByRole("link", { name: data.corporateId }).click();

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

  try {
    // 응답 본문 데이터를 JSON 형식으로 가져오기
    const responseBody = await response.json();
    //console.log("Response body:", responseBody);

    if (responseBody.dl_tbbibo59) {
      console.log("Number of rows:", responseBody.dl_tbbibo59.length);

      //console.log(responseBody.dl_tbbibo59[0]);
      //console.log(responseBody.dl_tbbibo59[1]);

      //const position = path.join(__dirname, "output.json");

      //console.log(position);

      fs.writeFileSync(
        //path.join(__dirname, "output.json"),
        "/Users/west/output.json",
        JSON.stringify(responseBody.dl_tbbibo59)
      );

      // CSV로 저장
      const fields = Object.keys(responseBody.dl_tbbibo59[0]); // CSV 헤더로 사용될 필드명
      const csv = parse(responseBody.dl_tbbibo59, { fields });

      fs.writeFileSync("output_delegation.csv", csv);
      console.log("Data saved to output.csv");
    } else {
      console.log("No data found in the response");
    }
  } catch (error) {
    console.error("Failed to get response body:", error);
  }
  await browser.close();
}
module.exports = { crawlDelegation };
