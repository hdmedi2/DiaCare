const { chromium } = require("playwright");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { sendLogToServer, pharmacyListByBizNo, electronToWebEventRun } = require("./logUtil");
const {MEDICARE_URL, SAVE_LOG_DIR, SAVE_FILE_DIR, SAVE_MAIN_DIR} = require("../config/default.json");
const log = require("electron-log");
const today = new Date();
const year = today.getFullYear(); // 2023
const month = (today.getMonth() + 1).toString().padStart(2, '0'); // 06
const day = today.getDate().toString().padStart(2, '0'); // 18
const dateString = year + '-' + month + '-' + day; // 2023-06-18

let logPath = "";
let userHomeDirectory = "";
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
  // userHomeTaxDirectory = path.join(systemDrive, SAVE_MAIN_DIR, SAVE_HOMETAX_DIR, dateString);
}
else {
  // Windows 이와의 운영체제인 경우는 홈 디렉토리 아래에 로그 기록
  // ~/DiaCare/logs
  const homeDir = os.homedir();
  // ~/DiaCare/logs
  logPath = path.join(homeDir, SAVE_MAIN_DIR, SAVE_LOG_DIR);
  // ~/DiaCare/files/2024-12-14
  userFileDirectory = path.join(homeDir, SAVE_MAIN_DIR, SAVE_FILE_DIR, dateString);
  // ~/DiaCare/hometax/2024-12-14
  // userHomeTaxDirectory = path.join(homeDir, SAVE_MAIN_DIR, SAVE_HOMETAX_DIR, dateString);
}

// 2-2. 로그 폴더 없으면 생성
if (!fs.existsSync(logPath)) {
  fs.mkdirSync(logPath, { recursive: true });
}

// 2-3. 사용자 파일 디렉토리 생성
if (!fs.existsSync(userFileDirectory)) {
  fs.mkdirSync(userFileDirectory, { recursive: true });
}
// 2-4. 로그파일 저장명 설정
Object.assign(console, log.functions);
log.transports.file.resolvePathFn = () => path.join(logPath, 'main-' + dateString +'.log');

/* 요양비 청구하기 */
async function runAutomation_billing(data) {

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
  try {
    for (const channel of channels) {
      try {
        browser = await chromium.launch({headless: false, channel});
        break;
      } catch (error) {
        console.warn(`Failed to launch ${channel}: ${error.message}`);
        log.warn(`Failed to launch ${channel}: ${error.message}`);
      }
    }
    if (!browser) {
      console.error("No supported browser channels found.");
      log.error("No supported browser channels found.");
      return;
    }

    // directory: C:\DiaCare\yyyy-mm-dd\환자명
    const downloadsDirectory = path.join(userFileDirectory, data.name);  //path.join(userHomeDirectory, "Downloads");
    // 날짜/환자명 폴더 없으면 생성
    if (!fs.existsSync(downloadsDirectory)) {
      fs.mkdirSync(downloadsDirectory, {recursive: true});
    }

    log.info(`download Directory: ${downloadsDirectory}`);


    // A-1.구매영수증 다운로드
    try {
      console.log("Start payment_receipt_file Download");
      log.info("Start payment_receipt_file Download");
      await downloadFile(
          downloadsDirectory,
          data.paymentReceiptSignedUrl,
          data.paymentReceiptFileName
      );
      log.info("Start payment_receipt_file Downloaded");
    } catch (e) {
      console.error(e.message);
      log.error(e.message);
    }

    // A-2.연속혈당측정용 전극 고유식별번호 다운로드
    try {
      if (data.isCgmSensor) {
        console.log("Start cgm_seq_no_file Download");
        await downloadFile(
            downloadsDirectory,
            data.cgmSeqNoSignedUrl,
            data.cgmSeqNoFileName
        );
        console.log("Start cgm_seq_no_file Downloaded");
        log.info("Start cgm_seq_no_file Downloaded");
      }
    } catch (e) {
      log.error("cgm_seq_no_file error", e.message);
      console.log("cgm_seq_no_file error", e.message);
    }

    try {
      // A-3.위임장 다운로드
      console.log("Start payment_claim_delegation_file Download");
      await downloadFile(
          downloadsDirectory,
          data.paymentClaimDelegationSignedUrl,
          data.paymentClaimDelegationFileName
      );
      console.log("위임장: payment_claim_delegation_file Downloaded");
      log.info("위임장: payment_claim_delegation_file Downloaded");
    } catch (e) {
      console.log(`위임장: ${e.message}`);
      log.info(`위임장: ${e.message}`);
    }

    try {
      // A-4.처방전 다운로드
      console.log("Start prescription_file Download");
      await downloadFile(
          downloadsDirectory,
          data.prescriptionSignedUrl,
          data.prescriptionFileName
      );
      log.info("처방전 prescription_file Downloaded");
      console.log("처방전 prescription_file Downloaded");

    } catch (e) {
      console.log(`처방전 다운로드: ${e.message}`);
      log.error(`처방전 다운로드: ${e.message}`);
    }

    try {
      // A-5.출력문서 다운로드
      console.log("Start diabetes_doc_file Download");
      await downloadFile(
          downloadsDirectory,
          data.diabetesDocSignedUrl,
          data.diabetesDocFileName
      );
    } catch (e) {
      console.error(`CloudfrontUrl download error: ${e.message}`);
      return;
    }

    try {
      // 공인인증서 vaildation
      if (isEmptyCertificationInfo(data)) {
        let processLogic = `makeSwal('공인인증서 정보가 없습니다.\\n상단 메뉴 중 [공인인증서] > [인증서 설정]\\n으로 정보를 입력해 주세요.')`;
        await electronToWebEventRun(processLogic);
        return;
      }

    } catch (error) {
      console.error("electronToWebEventRun error");
      return
    }

    // 요양마당 화면 크기 조절
    const {width, height} = require('electron').screen.getPrimaryDisplay().workAreaSize;
    const context = await browser.newContext({
      viewport: {width, height}, // Playwright가 뷰포트를 설정하지 않도록 설정
    });
    const page = await context.newPage();
    // 시스템 화면 크기를 가져오는 기능
    await page.goto(MEDICARE_URL);

    // 공인인증서 로그인
    await page.locator("#grp_loginBtn").click();
    await page.locator("#btnCorpLogin").click();
    await page.getByRole("radio", {name: data.certificateLocation}).click();
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
    await page.getByText(data.certificateName, {exact: true}).click();
    await page.getByRole("textbox", {name: "인증서 암호"}).click();
    await page
        .getByRole("textbox", {name: "인증서 암호"})
        .fill(data.certificatePassword);
    await page.getByRole("button", {name: "확인"}).click();
    //await page.getByRole('link', { name: data.corporateId }).click();

    // 로그인 된 약국명을 가져옴
    await page.waitForTimeout(2000);
    const fullText = await page.textContent("#txt_yoyangName");
    const match = fullText.match(/^[^\[]+/);
    const extractedText = match ? match[0].trim() : "";
    console.log(extractedText);

    // 요양비 청구
    await page.getByRole("link", {name: "요양비", exact: true}).click();
    await page
        .getByRole("link", {name: "요양비청구등록", exact: true})
        .click();
    await page.waitForTimeout(2000);
    const frame = page.frameLocator(
        'iframe[name="windowContainer_subWindow1_iframe"]'
    );

    // 수진자 정보
    console.log("start sujinja info");
    await frame.locator("#sel_payClsfcCd").selectOption("당뇨병소모성재료");
    await frame.locator("#inp_sujinjaJuminNo1").fill(data.ssn.split("-")[0]);
    await frame.locator("#inp_sujinjaJuminNo2").fill(data.ssn.split("-")[1]);
    await frame.locator("#inp_sujinjaNm").fill(data.name);
    await frame.locator("#inp_sujinjaNm").press("Enter");
    console.log("end sujinja info");

    // 팝업 창(일반적인 요양비 청구가 맞습니까?) 확인 버튼 -> 약국 선택
    // 동적으로 생성되는 태그 값 찾기
    console.log("start general care expenses alert");
    await page.waitForTimeout(3000);

    const dynamicFrameId = await searchIframePopup(page, "confirm_", "_iframe");

    if (dynamicFrameId) {
      const innerFrame = frame.frameLocator(`iframe[id="${dynamicFrameId}"]`);
      await innerFrame.getByRole("link", {name: "예"}).waitFor();
      await innerFrame.getByRole("link", {name: "예"}).click();
    } else {
      console.error("Dynamic iframe not found.");
    }
    console.log("end general care expenses alert");

    // 페이지의 모든 쿠키 가져오기
    console.log("start pharmacyListByBizNo");
    const cookieData = await page.context().cookies();
    /*
    let pharmacyDataNum = await pharmacyListByBizNo(cookieData, data.pharmacyBizNo);
    console.log("end pharmacyListByBizNo");

    if (pharmacyDataNum > 1) {
      // 업체목록이 2건 이상이면 선택
      await page.waitForTimeout(3000);
      await frame
          .frameLocator('iframe[title="bipbkz300p01"]')
          .locator(`text=${extractedText}`)
          .waitFor();
      await frame
          .frameLocator('iframe[title="bipbkz300p01"]')
          .getByText(extractedText)
          .click();
      await frame
          .frameLocator('iframe[title="bipbkz300p01"]')
          .getByRole("link", { name: "선택" })
          .click();
    }
    */
    const bipbkz300p01 = await searchIframePopup(page, "bipbkz300p01", "_iframe");

    if (bipbkz300p01) {
      const pharmacyCnt = await frame.frameLocator('iframe[title="bipbkz300p01"]')
          .locator(`text=${extractedText}`).waitFor();
      await frame
          .frameLocator('iframe[title="bipbkz300p01"]')
          .getByText(extractedText)
          .click();
      await frame
          .frameLocator('iframe[title="bipbkz300p01"]')
          .getByRole("link", {name: "선택"})
          .click();
    }

    // 처방전발행일
    console.log("start prescription date");
    await frame.locator("#cal_mprsc_issue_dt_input").click();
    await frame
        .locator("#cal_mprsc_issue_dt_input")
        .fill(data.issue.replace(/-/g, ""));
    await frame.locator("#cal_mprsc_issue_dt_input").press("Enter");
    console.log("end prescription date");

    // 당뇨 구분, 인슐린 투여 (나이(19세 미만))
    console.log("start diabetes type, taking insulin, under age 19");
    console.log("Selected Option Value:", data.select);
    const parts = data.select.split("|").map((part) => part.trim());
    const firstPart = parts[0].trim(); // 당뇨 유형
    const secondPart = parts[1].trim(); // 인슐린 투여 여부
    const thirdPart = parts[2]?.trim(); // 나이(19세 미만)

    if (firstPart === "임신중") {
      console.log("임신중 -- 팝업닫기 시작");
      // 알림창
      await page.waitForTimeout(2000);
      const frames_save_alert = page.frames();
      let dynamicFrame_save_alert;
      let dynamicFrameId_save_alert;
      for (let i = frames_save_alert.length - 1; i >= 0; i--) {
        const frame_save_alert = frames_save_alert[i];
        await page.waitForTimeout(1000);
        const ids_save_alert = await frame_save_alert.evaluate(() => {
          const iframes = Array.from(document.querySelectorAll("iframe"));
          return iframes.map((iframe) => iframe.id);
        });
        for (const id_save_alert of ids_save_alert) {
          if (
              id_save_alert.startsWith("alert_") &&
              id_save_alert.endsWith("_iframe")
          ) {
            dynamicFrame_save_alert = frame_save_alert;
            dynamicFrameId_save_alert = id_save_alert;
            console.log("Dynamic iframe found with ID:", id_save_alert);
            break;
          }
        }
        if (dynamicFrame_save_alert) break;
      }
      if (dynamicFrame_save_alert && dynamicFrameId_save_alert) {
        const innerFrame_save_alert = dynamicFrame_save_alert.frameLocator(
            `iframe[id="${dynamicFrameId_save_alert}"]`
        );
        await innerFrame_save_alert
            .getByRole("link", {name: "확인"})
            .waitFor();
        await innerFrame_save_alert.getByRole("link", {name: "확인"}).click();
      } else {
        console.error("Dynamic iframe not found.");
      }
    }

    await page.waitForSelector(
        'iframe[name="windowContainer_subWindow1_iframe"]'
    );
    await frame.locator("#wframeDetail").click();
    const button = frame.locator("#sel_bcbnf_recv_cond_type1_label");
    await button.waitFor({state: "visible"});
    await button.click();

    /* 1형|임신중 당뇨병 환자 처리를 위함. 요양마당 시나리오와 맞지않아서 급히 수정처리함 (서정현, 2025.1.1) */
    if (firstPart === "1형"
        && secondPart.startsWith("임신중")
        /* 여자만 2,4 내국인 6,8 외국인 */
        && (data.ssn.split("-")[1].startsWith("2") ||
            data.ssn.split("-")[1].startsWith("4") ||
            data.ssn.split("-")[1].startsWith("6") ||
            data.ssn.split("-")[1].startsWith("8"))
    ) {


      await frame.locator("#sel_bcbnf_recv_cond_type1_itemTable_3").click();
      await frame.locator("#sel_bcbnf_recv_cond_type2_button").click();

      // 2025.1.1 추가 (서정현)
      // 연속혈당측정용 전극(센서) 체크된 경우
      if (data.isCgmSensor) {
        await frame
            .locator('label:has-text("연속혈당측정용 전극(센서)")')
            .check();
      }
      console.log("Pregnancy 임신중 당뇨 | 1형");
      if (secondPart === "투여") {
        await frame.locator("#sel_bcbnf_recv_cond_type2_itemTable_1").click();
      } else if (secondPart === "미투여") {
        await frame.locator("#sel_bcbnf_recv_cond_type2_itemTable_2").click();
      }
    }
    else if (firstPart === "1형") {
      // 1형 당뇨
      console.log("diabetes 01");
      await frame.locator("#sel_bcbnf_recv_cond_type1_itemTable_1").click();
      if (
          secondPart === "연속혈당측정용 전극" ||
          secondPart === "연속혈당측정용 전극(기본)" ||
          secondPart === "연속혈당측정용 전극(센서, 복합형)" ||
          data.isCgmSensor === true  /* 전극센서 체크박스 체크된 경우 */
      ) {
        await frame
            .locator('label:has-text("연속혈당측정용 전극(센서)")')
            .check();
      }
      else {
        await frame
            .locator('label:has-text("연속혈당측정용 전극(센서)")')
            .uncheck();
      }
    }
    // 2형 당뇨
    else if (firstPart === "2형") {

      console.log("diabetes 02");
      await frame.locator("#sel_bcbnf_recv_cond_type1_itemTable_2").click();
      await frame.locator("#sel_bcbnf_recv_cond_type2_button").click();
      if (secondPart === "투여") {
        await frame.locator("#sel_bcbnf_recv_cond_type2_itemTable_1").click();
      } else if (secondPart === "미투여") {
        if (thirdPart === "19세 미만") {
          await frame.locator("#sel_bcbnf_recv_cond_type2_itemTable_2").click();
        }
      }
    }
    // 임신중 당뇨
    else if (firstPart === "임신중") {
      console.log("Pregnancy");
      await frame.locator("#sel_bcbnf_recv_cond_type1_itemTable_3").click();
      await frame.locator("#sel_bcbnf_recv_cond_type2_button").click();
      if (secondPart === "투여") {
        await frame.locator("#sel_bcbnf_recv_cond_type2_itemTable_1").click();
      } else if (secondPart === "미투여") {
        await frame.locator("#sel_bcbnf_recv_cond_type2_itemTable_2").click();
      }
    }
    console.log("end diabetes type, taking insulin, under age 19");

    // 요양기관, 의사 번호, 전문의 번호
    console.log("start hospitalCareOrgNo, doctorLicenseNo, qualificationNo");
    await frame.locator("#btn_pi_dr").click();
    // await frame.locator("#wq_uuid_673").click();
    // await frame.locator("#wq_uuid_673").press("Enter");
    try {
      await page.waitForTimeout(2000);
      await frame
          .frameLocator('iframe[title="bipbkz210p01"]')
          .locator("#inp_ykiho")
          .click();
      await frame
          .frameLocator('iframe[title="bipbkz210p01"]')
          .locator("#inp_ykiho")
          .fill(data.hospitalCareOrgNo);
      await frame
          .frameLocator('iframe[title="bipbkz210p01"]')
          .getByRole("link", {name: "검색"})
          .click();
      await page.waitForTimeout(2000);
      await frame
          .frameLocator('iframe[title="bipbkz210p01"]')
          .locator("#inp_drLicNo")
          .click();
      // 전문의 번호 입력
      // await frame.frameLocator('iframe[title="bipbkz210p01"]').locator('#inp_spdrQlfNo').fill(data.doctor);
      await frame
          .frameLocator('iframe[title="bipbkz210p01"]')
          .locator("#inp_drLicNo")
          .fill(data.doctor);
      await frame
          .frameLocator('iframe[title="bipbkz210p01"]')
          .getByRole("link", {name: "조회"})
          .click();
      await page.waitForTimeout(3000);
      // 현재는 "내과" text를 클릭하게 하였지만 변경 예정
      // 과가 2개 나오는 의사 분은 과 선택 Flow가 있지만, 과가 1개인 사람은 바로 넘어가는 Flow라 아래 코드 개발 -> 전문의 번호까지 입력 가능하면 필요 없는 코드
      const linkElement_1 = await frame
          .frameLocator('iframe[title="bipbkz210p01"]')
          .locator('text="내과"')
          .elementHandles();
      if (linkElement_1.length > 0) {
        await linkElement_1[0].click();
        await frame
            .frameLocator('iframe[title="bipbkz210p01"]')
            .getByRole("link", {name: "선택"})
            .click();
        console.log('Element with "내과" was clicked.');
      } else {
        const linkElement_2 = await frame
            .frameLocator('iframe[title="bipbkz210p01"]')
            .locator('text="소아청소년과"')
            .elementHandles();
        if (linkElement_2.length > 0) {
          await linkElement_2[0].click();
          await frame
              .frameLocator('iframe[title="bipbkz210p01"]')
              .getByRole("link", {name: "선택"})
              .click();
          console.log('Element with "소아청소년과" was clicked.');
        } else {
          const linkElement_3 = await frame
              .frameLocator('iframe[title="bipbkz210p01"]')
              .locator("text=소아내분비과")
              .elementHandles();
          if (linkElement_3.length > 0) {
            await linkElement_3[0].click();
            await frame
                .frameLocator('iframe[title="bipbkz210p01"]')
                .getByRole("link", {name: "선택"})
                .click();
            console.log('Element with "소아내분비과" was clicked.');
          } else {
            console.log(
                'No element found with "내과", "청소년과", or containing "소아내분비과".'
            );
          }
        }
      }
    } catch (error) {
      console.error("An error occurred:", error.message);
    }
    console.log("end hospitalCareOrgNo, doctorLicenseNo, qualificationNo");

    // 상병 코드
    console.log("start diseaseCodeName");
    try {
      await frame.locator("#inp_bcbnf_recv_sick_sym").click();
      await frame.locator("#inp_bcbnf_recv_sick_sym").fill(data.code);
      await frame.locator("#btn_sick_cd").click();
      await page.waitForTimeout(2000);
      try {
        const frameExists = await frame
            .frameLocator('iframe[title="bipbkz220p01"]')
            .locator("text=" + data.code)
            .elementHandles();

        // 상병코드 조회결과가 1개 이상일때
        if (frameExists.length > 1) {
          await frame
              .frameLocator('iframe[title="bipbkz220p01"]')
              .locator("#grv_list_cell_0_0")
              .click();
          await frame
              .frameLocator('iframe[title="bipbkz220p01"]')
              .getByRole("link", {name: "선택"})
              .click();
          console.log("Element was clicked.");

        }

      } catch (innerError) {
        console.log("Frame or element not found:", innerError.message);
      }
    } catch (error) {
      console.error("An error occurred:", error.message);
    }
    console.log("end diseaseCodeName");

    // 1형 연속혈당측정, 임신성 당뇨 연속혈당측정 전극센서 체크 유무 확인
    const isCgm = data.isCgmSensor;
    log.info(`isCGm = ${isCgm}, 연속혈당측정시작일:${data.cgmStartDate}, 연속혈당측정 체크박스: ${data.isCgmSensor}`);
    // 연속혈당측정전극센서 체크시 사라지는 항목들
    if (!data.isCgmSensor) {
      // 혈당검사횟수, 인슐린투여횟수
      console.log("start bloodGlucoseTestNumber, insulinInjectionNumber");
      await frame.locator("#inp_data_cnt13").click();
      await frame.locator("#inp_data_cnt13").fill("");
      await frame.locator("#inp_data_cnt13").fill(data.blood);
      await frame.locator("#inp_data_cnt14").click();
      await frame.locator("#inp_data_cnt14").fill("");
      await frame.locator("#inp_data_cnt14").fill(data.insulin);
      console.log("end bloodGlucoseTestNumber, insulinInjectionNumber");
    }


    // 구매일, 사용개시일, 지급일수
    console.log("start purchaseDate, eatDays");

    await frame.locator("#cal_buy_dd_input").click();
    await frame.locator("#cal_buy_dd_input").fill(data.purchase);

    //await frame.locator("#wq_uuid_797").click(); // 허공을 클릭해야 아래의 confirm_iframe 창이 뜨기 때문에 존재하는 코드
    await frame.locator("#wframeDetail").click(); // 허공을 클릭해야 아래의 confirm_iframe 창이 뜨기 때문에 존재하는 코드
    await frame
        .frameLocator('iframe[title="bipbkz110p01"]')
        .locator(`text="${data.name}"`)
        .last()
        .waitFor({timeout: 1000});

    const bipbkz110p01 = await frame
        .frameLocator('iframe[title="bipbkz110p01"]')
        .locator("#grv_list_body_tbody")
        .getByRole("row")
        .elementHandles();

    // 조회결과가 2개 이상일때
    if (bipbkz110p01.length > 1) {
      await bipbkz110p01[1].click();
      await frame
          .frameLocator('iframe[title="bipbkz110p01"]')
          .getByRole("link", {name: "선택"})
          .click();
      console.log(`Element ${data.name} patient clicked.`);
    }


    //이전 품목의 금여종료일이 2020.11.23입니다. 사용개시일을 2024.11.24로 자동세팅됩니다.
    // alert_1735689446376_iframe
    const useStartDateAutoSetAlert = await searchIframePopup(page, "alert_", "_iframe");
    const isUseStartDateAutoSetAlert = !isEmpty(useStartDateAutoSetAlert);

    await page.waitForTimeout(3000);

    if (isUseStartDateAutoSetAlert) {
      const innerFrame = frame.frameLocator(`iframe[id="${useStartDateAutoSetAlert}"]`);
      await innerFrame.locator('a#btn_Confirm').waitFor();
      await innerFrame.locator('a#btn_Confirm').click();
    }


    await page.waitForTimeout(4000);
    const dupIframeId = await searchIframePopup(page, "confirm_", "_iframe");

    if (dupIframeId) {
      console.log("start dupIframeId");
      /*
          직전 동일 준요양기관의 청구내역이 있습니다. 동일한 내역으로 청구하시겠습니까? Yes / No
      */
      const innerFrame = frame.frameLocator(`iframe[id="${dupIframeId}"]`);
      // const innerFrame = frame.frameLocator('iframe[id="confirm_1735550451070_iframe"]');
      await innerFrame.locator('a#btn_No').waitFor();
      await innerFrame.locator('a#btn_No').click();

      await page.waitForTimeout(6000);

      const dupIframeId2 = await searchIframePopup(page, "alert_", "_iframe");
      if (dupIframeId2) {
        const innerFrame = frame.frameLocator(`iframe[id="${dupIframeId2}"]`);
        await innerFrame.locator('a#btn_Confirm').waitFor();
        await innerFrame.locator('a#btn_Confirm').click();
        /*
            // 이부분은 Yes 를 눌렀을 때 수행되는 확인 팝업처리 부분
            await page.waitForTimeout(6000);

            const dupIframeId3 = await searchIframePopup(page, "alert_", "_iframe");

            if(dupIframeId3){
              const innerFrame = frame.frameLocator(`iframe[id="${dupIframeId3}"]`);
              await innerFrame.locator('a#btn_Confirm').waitFor();
              await innerFrame.locator('a#btn_Confirm').click();
            }
        */
      }
    }
    // iframe 내 input box 선택
    const inputValue = await frame.locator("#cal_buy_dt_input").inputValue();


    // 빈 문자열인지 확인
    if (inputValue === '') {
      console.log(`* purchaseDate is blank ==> fill(${data.purchase})`);
      await frame.locator("#cal_buy_dt_input").click();
      await frame.locator("#cal_buy_dt_input").fill(data.purchase);
    } else {
      console.log('purchaseDate value:', inputValue);
    }

    // 지급일수(청구일수)
    await frame.locator("#inp_pay_freq").click();
    await frame.locator("#inp_pay_freq").clear();
    await frame.locator("#inp_pay_freq").fill(data.eat);


    if (data.isCgmSensor) {
      // 화면에서 가져온 1형 정보들
      // [6.변동계수 cgmCovBloodGlucosePercent 또는 7.표준편차 cgmCovBloodGlucoseMgdl 입력 필수입니다]
      // [3.착용일수 cgmWearDays 또는 4.착용비율 입력 cgmWearPercent  필수입니다]

      if (isEmpty(data.cgmWearDays) && isEmpty(data.cgmWearPercent)) {
        log.error(`환자명: ${data.name}(${data.ssn.split("-")[0]})/1형/연속혈당측정전극`);
        log.error(`착용일수 ${data.cgmWearDays} 또는 착용비율 ${data.cgmWearPercent}는 입력 필수입니다.`);
      }

      if (isEmpty(data.cgmCovBloodGlucosePercent) && isEmpty(data.cgmCovBloodGlucoseMgdl)) {
        log.error(`환자명: ${data.name}(${data.ssn.split("-")[0]})/1형/연속혈당측정전극`);
        log.error(`변동계수 ${data.cgmCovBloodGlucosePercent} 또는 표준편차 ${data.cgmCovBloodGlucoseMgdl}는 입력 필수입니다.`);
      }

      // 1.연속혈당측정기간 시작일 cgmStartDate
      await frame.locator("#cal_util_term_fr_dt_input").click();
      await frame.locator("#cal_util_term_fr_dt_input").clear();
      await frame.locator("#cal_util_term_fr_dt_input").fill(data.cgmStartDate.replaceAll("-",""));

      // 2.연속혈당측정기간 종료일 cgmEndDate
      await frame.locator("#cal_util_term_to_dt_input").click();
      await frame.locator("#cal_util_term_to_dt_input").clear();
      await frame.locator("#cal_util_term_to_dt_input").fill(data.cgmEndDate.replaceAll("-",""));

      // 3.착용일수 cgmWearDays
      await frame.locator("#inp_data_cnt03").click(); //
      await frame.locator("#inp_data_cnt03").clear(); //
      await frame.locator("#inp_data_cnt03").fill(data.cgmWearDays);

      // 4.착용비율
      await frame.locator("#inp_wear_rat").click();
      await frame.locator("#inp_wear_rat").clear();
      await frame.locator("#inp_wear_rat").fill(data.cgmWearPercent);  // 착용비율

      // 5.당평균값  cgmAvgBloodGlucose
      await frame.locator("#inp_bdsg_avg_vl").click();
      await frame.locator("#inp_bdsg_avg_vl").clear();
      await frame.locator("#inp_bdsg_avg_vl").fill(data.cgmAvgBloodGlucose); // 당평균값

      // 6.변동계수 cgmCovBloodGlucosePercent
      await frame.locator("#inp_cnslt_cor_cd").click();
      await frame.locator("#inp_cnslt_cor_cd").clear();
      await frame.locator("#inp_cnslt_cor_cd").fill(data.cgmCovBloodGlucosePercent);

      // 7.표준편차  cgmCovBloodGlucoseMgdl
      await frame.locator("#inp_stnd_dvtn").click();
      await frame.locator("#inp_stnd_dvtn").clear();
      await frame.locator("#inp_stnd_dvtn").fill(data.cgmCovBloodGlucoseMgdl); // 표준편차 cgmCovBloodGlucoseMgdl

      // 8. 당화혈색소 검사시행일 cgmGlycatedHemoglobinDate
      await frame.locator("#cal_enfo_dt_input").click();
      await frame.locator("#cal_enfo_dt_input").clear();
      await frame.locator("#cal_enfo_dt_input").fill(data.cgmGlycatedHemoglobinDate);

      // 9.  당화혈색소 검사수치 cgmGlycatedHemoglobinPercent
      await frame.locator("#inp_ispt_rslt_vl").click();
      await frame.locator("#inp_ispt_rslt_vl").clear();
      await frame.locator("#inp_ispt_rslt_vl").fill(data.cgmGlycatedHemoglobinPercent);
      // 10. 제품일련번호 리스트 cgmSeqNoList

    }

    //await frame.locator("#wq_uuid_797").click(); // 허공을 클릭해야 아래의 confirm_iframe 창이 뜨기 때문에 존재하는 코드
    await frame.locator("#wframeDetail").click(); // 허공을 클릭해야 아래의 confirm_iframe 창이 뜨기 때문에 존재하는 코드

    await page.waitForTimeout(3000);

    const dupIframeId4 = await searchIframePopup(page, "alert_", "_iframe");

    if(dupIframeId4){
      const innerFrame = frame.frameLocator(`iframe[id="${dupIframeId4}"]`);
      await innerFrame.locator('a#btn_Confirm').waitFor();
      await innerFrame.locator('a#btn_Confirm').click();
    }

    console.log("end purchaseDate, eatDays");

    // 연속혈당측정전극(센서) 체크 된 경우
    const cgmSeqNoList = [];
    if (data.isCgmSensor === true && !isEmpty(data.cgmSeqNoList))
    {
      console.log("start split cgmSeqNoList Array...");
      // data.cgmSeqList 분리
      // 콤마로 분리된 항목들이 있으면 분리 후 배열로 만들고, 단일 원소이면 하나만 입력함
      if(data.cgmSeqNoList.indexOf(",")>0) {
        const items = data.cgmSeqNoList.split(",");
        cgmSeqNoList.push(...items);
      }
      else {
        cgmSeqNoList.push(data.cgmSeqNoList);
      }
      console.log(`** cgmSeqNoList = [${cgmSeqNoList}]`);

      console.log("end split cgmSeqNoList Array...");
    }
    else {
      console.log(`*** there is no cgmSeqNoList ${data.cgmSeqNoList}...`);
    }

    // 제품사용내역등록(식별번호등록)
    console.log("start taking diabetes supplies info");
    await frame.locator("#btn_sub").waitFor({ state: "visible" });
    await frame.locator("#btn_sub").click();

    //await frame.locator("#btn_sub").press("Enter");
    // 제품명, 수량, 금액
    for (let i = 0; i < 10; i++) {
      let k = 2 * i + 1;
      if (k < data.product.length) {
        console.log("-------------------");
        console.log(data.product[k], data.p_price[i], data.p_quantity[i]);
        await frame
            .frameLocator('iframe[title="pop_bipbkc154p01"]')
            .getByRole("link", { name: "행추가" })
            .click();
        await frame
            .frameLocator('iframe[title="pop_bipbkc154p01"]')
            .locator(`#grd_tbbibo07_cell_${i}_3`)
            .click();
        await frame
            .frameLocator('iframe[title="pop_bipbkc154p01"]')
            .locator("#G_grd_tbbibo07__BCBNF_PRDCT_ORG_ID")
            .fill(data.product[k]);
        await frame
            .frameLocator('iframe[title="pop_bipbkc154p01"]')
            .locator(`#grd_tbbibo07_cell_${i}_10`)
            .click();

        // 연속혈당측정용 전극센서
        if (!data.isCgmSensor) {
          await frame
              .frameLocator('iframe[title="pop_bipbkc154p01"]')
              .locator("#G_grd_tbbibo07__CASH_PRDCT_USE_QTY")
              .fill(data.p_quantity[i]);
        }
        // 연속혈당측정용 전극(센서) 체크된 경우
        else
        {
          await frame
              .frameLocator('iframe[title="pop_bipbkc154p01"]')
              .locator(`#grd_tbbibo07_cell_${i}_11`)
              .click();
          await page.waitForTimeout(2000);

                const innerIframe155p01 =
                    await frame
                         .frameLocator('iframe[title="pop_bipbkc154p01"]')
                         .frameLocator('iframe[title="pop_bipbkc155p01"]');
                if (innerIframe155p01) {
                  console.log("------innter Iframe155p01 found---------");
                }
                else {
                  console.log("------No innter Iframe155p01 found---------");
                }
                if (cgmSeqNoList && cgmSeqNoList.length > 0) {
                  for (let y = 0; y < cgmSeqNoList.length; y++) {
                    await innerIframe155p01
                        //.locator("#btn_addRow")
                        .getByRole("link",{name: "행추가"})
                        .waitFor();
                    await innerIframe155p01
                        .getByRole("link",{name: "행추가"})
                        .click(); // click
                    // 새로운 행이 즉시 만들어지지는 않으므로 보일 때까지 대기 필요
                    await innerIframe155p01
                            .locator(`#grd_tbbibo12_cell_${y}_3`)
                            .click();
                    // cgmSeqNoList 찍어보기
                    console.log(`cgmSeqNoList[${y}] - 일련번호:${cgmSeqNoList[y]}`)
                    log.info(`cgmSeqNoList[${y}] - 일련번호:${cgmSeqNoList[y]}`)

                    await innerIframe155p01
                        .locator("#G_grd_tbbibo12__EQPMT_ORGNLY_NO")
                        .fill(cgmSeqNoList[y]);
                  }
                  innerIframe155p01.getByRole("link",{name: "닫기"});
                }
                await page.waitForTimeout(2000);
                await innerIframe155p01
                    .getByRole('link', {name: "닫기"})
                    .click();
        }

        await frame
            .frameLocator('iframe[title="pop_bipbkc154p01"]')
            .locator(`#grd_tbbibo07_cell_${i}_13`)
            .click();
        await frame
            .frameLocator('iframe[title="pop_bipbkc154p01"]')
            .locator("#G_grd_tbbibo07__CASH_PRDCT_PRDCT_AMT")
            .fill(data.p_price[i]);
      }
    }
    await frame
        .frameLocator('iframe[title="pop_bipbkc154p01"]')
        .getByRole("link", { name: "적용" })
        .click();

    await frame.getByRole("link", { name: "저장" }).click();
    console.log("Click the Save button");

    // 알림창
    const frames_save = page.frames();
    let dynamicFrame_save;
    let dynamicFrameId_save;
    for (let i = frames_save.length - 1; i >= 0; i--) {
      const frame_save = frames_save[i];
      await page.waitForTimeout(1000);
      const ids_save = await frame_save.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll("iframe"));
        return iframes.map((iframe) => iframe.id);
      });
      for (const id_save of ids_save) {
        if (id_save.startsWith("confirm_") && id_save.endsWith("_iframe")) {
          dynamicFrame_save = frame_save;
          dynamicFrameId_save = id_save;
          console.log("Dynamic iframe found with ID:", id_save);
          break;
        }
      }
      if (dynamicFrame_save) break;
    }
    if (dynamicFrame_save && dynamicFrameId_save) {
      const innerFrame_save = dynamicFrame_save.frameLocator(
          `iframe[id="${dynamicFrameId_save}"]`
      );
      await innerFrame_save.getByRole("link", { name: "예" }).waitFor();
      await innerFrame_save.getByRole("link", { name: "예" }).click();
    } else {
      console.error("Dynamic iframe not found.");
    }

    // 알림창
    await page.waitForTimeout(2000);
    const frames_save_alert = page.frames();
    let dynamicFrame_save_alert;
    let dynamicFrameId_save_alert;
    for (let i = frames_save_alert.length - 1; i >= 0; i--) {
      const frame_save_alert = frames_save_alert[i];
      await page.waitForTimeout(1000);
      const ids_save_alert = await frame_save_alert.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll("iframe"));
        return iframes.map((iframe) => iframe.id);
      });
      for (const id_save_alert of ids_save_alert) {
        if (
            id_save_alert.startsWith("alert_") &&
            id_save_alert.endsWith("_iframe")
        ) {
          dynamicFrame_save_alert = frame_save_alert;
          dynamicFrameId_save_alert = id_save_alert;
          console.log("Dynamic iframe found with ID:", id_save_alert);
          break;
        }
      }
      if (dynamicFrame_save_alert) break;
    }
    if (dynamicFrame_save_alert && dynamicFrameId_save_alert) {
      const innerFrame_save_alert = dynamicFrame_save_alert.frameLocator(
          `iframe[id="${dynamicFrameId_save_alert}"]`
      );
      const exampleText = await innerFrame_save_alert
          .locator("p#tbx_Message")
          .textContent();

      // 콘솔에 exampleText 로깅합니다.
      console.log("exampleText: ", exampleText);

      await innerFrame_save_alert.getByRole("link", { name: "확인" }).waitFor();
      await innerFrame_save_alert.getByRole("link", { name: "확인" }).click();
    } else {
      console.error("Dynamic iframe not found.");
    }
    console.log("end taking diabetes supplies info");

    // 제출 서류 첨부
    console.log("start attach pdf document");
    await frame.getByRole("link", { name: "제출 서류 첨부" }).click();
    // 파일 첨부
    const fileChooserPromise = page.waitForEvent("filechooser");

    const parentDiv = frame
        .frameLocator('iframe[title="popup_fileUpload"]')
        .frameLocator("#btrsFrame")
        .locator("#btnsNormal");

    //console.log("btnsNormal " + (await parentDiv.textContent()));

    const button1 = parentDiv.locator("button").first();
    await button1.click();

    //await frame
    //  .frameLocator('iframe[title="popup_fileUpload"]')
    //  .frameLocator("#btrsFrame")
    //  .getByRole("div", { id })
    //  .getByRole("button", { name: "① 파일추가" }) // ①&nbsp;파일추가   // ① 파일추가
    //  .click();
    // 컴퓨터에서 파일 찾기
    const fileChooser = await fileChooserPromise;
    // 출력문서 파일 선택

    const fileArr = [];
    if (!isEmpty(data.prescriptionFileName)) {
      fileArr.push(path.join(downloadsDirectory, data.prescriptionFileName));
    }
    if (!isEmpty(data.diabetesDocFileName)) {
      fileArr.push(path.join(downloadsDirectory, data.diabetesDocFileName));
    }
    if (!isEmpty(data.paymentReceiptFileName)) {
      fileArr.push(path.join(downloadsDirectory, data.paymentReceiptFileName));
    }

    fileArr.forEach(file => {
      console.log(file + " File exists: " + fs.existsSync(file));
    });

    await fileChooser.setFiles(fileArr);

    // 파일 전송
    const button2 = parentDiv.locator("button").nth(1);
    await button2.click();

    /*await frame
      .frameLocator('iframe[title="popup_fileUpload"]')
      .frameLocator("#btrsFrame")
      .getByRole("button", { name: "② 파일전송" })
      .click();*/

    while (true) {
      const elements = frame
          .frameLocator('iframe[title="popup_fileUpload"]')
          .frameLocator("#btrsFrame")
          .locator("text=저장완료");

      if ((await elements.count()) >= fileArr.length) {
        break;
      }

      await page.waitForTimeout(500);
    }

    console.log('"저장완료" 텍스트가 프레임 내에 나타났습니다.');
    // 파일 저장

    const button3 = parentDiv.locator("button").nth(2);
    await button3.click();
    console.log("end attach pdf document");

    /*await frame
      .frameLocator('iframe[title="popup_fileUpload"]')
      .frameLocator("#btrsFrame")
      .getByRole("button", { name: "③ 적 용" })
      .click();*/

    // 최종제출하시겠습니까?
    await frame.getByRole("link", { name: "최종제출" }).click();

    // 최종 제출 하시겠습니까? 예 아니요 버튼 (confirm_ _iframe)
    // await browser.close();   await sendLogToServer(data.docId, 'success', 'Automation task completed', data.csrfToken, data.csrfHeader);
    await sendLogToServer(
        data.docId,
        "success",
        "Automation task completed",
        data.csrfToken,
        data.csrfHeader
    );
  }
  catch (e) {
    console.error("Automation failed: ", e.message);
    await sendLogToServer(
        data.docId,
        "fail",
        `Automation task failed: ${e.message}`,
        data.csrfToken,
        data.csrfHeader
    );
  }
}
module.exports = { runAutomation_billing };

/*--------------------- 유틸리티 함수 ------------------------------------*/
async function searchIframePopup( page, startWord, endWord ) {
  const frames = page.frames();
  let dynamicFrame;
  let dynamicFrameId;
  for (const frame of frames) {
    const ids = await frame.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll("iframe"));
      return iframes.map((iframe) => iframe.id);
    });
    for (const id of ids) {
      if (id.startsWith(startWord) && id.endsWith(endWord)) {
        dynamicFrame = frame;
        dynamicFrameId = id;
        console.log("Dynamic iframe found with ID:", id);
        break;
      }
    }
    if (dynamicFrame) break;
  }
  return dynamicFrameId;
}

async function downloadFile(downloadsDirectory, url, filename) {
  console.log("downloadFile start");
  fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => {
        const filePath = path.join(downloadsDirectory, filename);
        fs.writeFile(filePath, Buffer.from(data), (err) => {
          if (err) {
            console.error("Download failed:", err);
          } else {
            console.log("Download completed!");
          }
        });
      })
      .catch((err) => console.error("Fetch failed:", err));
}

function isEmptyCertificationInfo(data) {
  if (isEmpty(data.certificateLocation)) return true;
  if (data.certificateLocation !== '하드디스크' && isEmpty(data.certificatePath)) return true;
  if (isEmpty(data.certificateName)) return true;
  if (isEmpty(data.certificatePassword)) return true;

}

/**
 * 빈값 체크
 * @param value 체크하려는 값
 * @returns {boolean}
 */
function isEmpty(value) {
  if (typeof value === "undefined" || value === null || value === "" || value === "null") {
    return Boolean(true);
  } else {
    return Boolean(false);
  }
}



