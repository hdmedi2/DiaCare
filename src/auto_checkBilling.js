const { chromium } = require("playwright");
const fs = require("fs");
const { parse } = require("json2csv");
const {XMLHttpRequest} = require("xmlhttprequest");
const {MEDICARE_URL} = require("../config/default.json");

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

  const page = await browser.newPage();
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
    if (linkElement) {
      await linkElement.click();
      console.log("Element was clicked.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
  await page.getByText(data.certificateName).click();
  await page.getByRole("textbox", { name: "인증서 암호" }).click();
  await page
    .getByRole("textbox", { name: "인증서 암호" })
    .fill(data.certificatePassword);
  await page.getByRole("button", { name: "확인" }).click();
  //await page.getByRole('link', { name: data.corporateId }).click();

  // 요양비청구위임내역 조회
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

      const filePos = "C:\\bill"+Date.now()+".json";
      const filePosRead = "file://"+Date.now()+"output.json"

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
      };

      //rawFile.send(null);

      // CSV로 저장
      // const fields = Object.keys(responseBody.dl_tbbibo05[0]); // CSV 헤더로 사용될 필드명
      // const csv = parse(responseBody.dl_tbbibo05, { fields });

      //fs.writeFileSync("output_bill.csv", csv);
      //console.log("Data saved to output.csv");
    } else {
      console.log("No data found in the response");
    }
  } catch (error) {
    console.error("Failed to get response body:", error);
  }
  //await browser.close();
}
module.exports = { checkBilling };
