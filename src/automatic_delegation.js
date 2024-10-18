const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

async function runAutomation_delegation(data_1) {
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

  const userHomeDirectory = process.env.HOME || process.env.USERPROFILE;
  const downloadsDirectory = path.join(userHomeDirectory, "Downloads");

  try {
    // 구매영수증 다운로드
    console.log("Start payment_receipt_file Download");
    await downloadFile(
      downloadsDirectory,
      data_1.paymentReceiptFileName,
      data_1.paymentReceiptSignedUrl
    );

    // 연속혈당측정용 전극 고유식별번호 다운로드
    console.log("Start cgm_seq_no_file Download");
    if (data_1.isCgmSensor) {
      await downloadFile(
        downloadsDirectory,
        data_1.cgmSeqNoSignedUrl,
        data_1.cgmSeqNoFileName
      );
    }

    // 위임장 다운로드
    console.log("Start payment_claim_delegation_file Download");
    await downloadFile(
      downloadsDirectory,
      data_1.paymentClaimDelegationSignedUrl,
      data_1.paymentClaimDelegationFileName
    );

    // 신분증 다운로드
    console.log("Start id_card_file download");
    await downloadFile(
      downloadsDirectory,
      data_1.idCardSignedUrl,
      data_1.idCardFileName
    )

    // 처방전 다운로드
    console.log("Start prescription_file Download");
    await downloadFile(
      downloadsDirectory,
      data_1.prescriptionSignedUrl,
      data_1.prescriptionFileName
    );

    // 출력문서 다운로드
    console.log("Start diabetes_doc_file Download");
    await downloadFile(
      downloadsDirectory,
      data_1.diabetesDocSignedUrl,
      data_1.diabetesDocFileName
    );
  } catch (error) {
    console.error("CloudfrontUrl download error");
    return;
  }

  const page = await browser.newPage();
  await page.goto("https://medicare.nhis.or.kr/portal/index.do");
  //const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // 공인인증서 로그인
  await page.locator("#grp_loginBtn").click();
  await page.locator("#btnCorpLogin").click();
  await page.getByRole("radio", { name: data_1.certificateLocation }).click();
  // 하드디스크의 경우 certificateLocation 값이 비어있기 때문에 오류 메시지가 뜸
  try {
    const linkElement = await page.getByRole("link", {
      name: data_1.certificatePath,
    });
    if (linkElement) {
      await linkElement.click();
      console.log("Element was clicked.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
  await page.getByText(data_1.certificateName).click();
  await page.getByRole("textbox", { name: "인증서 암호" }).click();
  await page
    .getByRole("textbox", { name: "인증서 암호" })
    .fill(data_1.certificatePassword);
  await page.getByRole("button", { name: "확인" }).click();
  //await page.getByRole('link', { name: data_1.corporateId }).click();

  /*** 요양마당 위임등록 순서 : 1.위임자정보 - 2.위임받는자정보 - 5.위임기간 - 4.위임사항 ***/

  // 요양비청구위임내역등록
  await page.getByRole("link", { name: "요양비", exact: true }).click();
  await page
    .getByRole("link", { name: "요양비청구위임내역등록", exact: true })
    .click();
  await page.waitForTimeout(2000);
  const frame = page.frameLocator(
    'iframe[name="windowContainer_subWindow1_iframe"]'
  );

  // 주민번호
  await page.waitForTimeout(2000);
  await frame.locator("#inp_sujinjaJuminNo").click();
  await frame.locator("#inp_sujinjaJuminNo").fill(data_1.ssn.replace(/-/g, ""));

  // 성함
  await frame.locator("#inp_sujinjaNm").click();
  await frame.locator("#inp_sujinjaNm").fill(data_1.name);
  await frame.locator("#inp_sujinjaNm").press("Enter");

  // 위임자와 수진자 동일인 체크박스
  //console.log("data_1 : {}", data_1);
  if (data_1.isSelfClaim === 'true') {
    // 본인청구인 경우
    await page.waitForTimeout(2000);
    await frame.getByLabel("위임자와 수진자 동일인").check();

    // 전화번호
    await page.waitForTimeout(1500);
    await frame.locator("#inp_apctTelBurNo").click();
    await frame.locator("#inp_apctTelBurNo").fill(data_1.phone.split("-")[1]);
    await frame.locator("#inp_apctTelSeqNo").click();
    await frame.locator("#inp_apctTelSeqNo").fill(data_1.phone.split("-")[2]);

  } else {
    // 대리인청구인 경우
    // 위임자 생년월일
    await page.waitForTimeout(1500);
    await frame.locator("#inp_proxyJuminNo").click();
    await frame.locator("#inp_proxyJuminNo").fill(data_1.deputyBirthDateAbbr);

    // 위임자 성명
    //await page.waitForTimeout(1500);
    await frame.locator("#inp_proxyNm").click();
    await frame.locator("#inp_proxyNm").fill(data_1.deputyName);

    // 수진자와의 관계
    await frame.locator("#sel_proxyRelCd_main_tbody").click();
    let deputyRelationshipIndex = "#sel_proxyRelCd_itemTable_" + data_1.deputyRelationshipIndex;
    await frame.locator(deputyRelationshipIndex).click();

    // 전화번호
    //await page.waitForTimeout(1500);
    await frame.locator("#inp_apctTelBurNo").click();
    await frame.locator("#inp_apctTelBurNo").fill(data_1.receivePhoneNo.split("-")[1]);
    await frame.locator("#inp_apctTelSeqNo").click();
    await frame.locator("#inp_apctTelSeqNo").fill(data_1.receivePhoneNo.split("-")[2]);

  }

  // 5. 위임기간
  await frame.locator('#inp_mdtFrDt_input').dblclick();
  await frame.locator('#inp_mdtFrDt_input').fill('');
  await frame.locator('#inp_mdtFrDt_input').fill(data_1.start.replace(/-/g, ''));

  await frame.locator('#inp_mdtToDt_input').dblclick();
  await frame.locator('#inp_mdtToDt_input').fill('');
  await frame.locator('#inp_mdtToDt_input').fill(data_1.end.replace(/-/g, ''));

  // 4. 위임사항 체크박스
  console.log("Selected Option Value:", data_1.select);
  const parts = data_1.select.split("|").map((part) => part.trim());
  const firstPart = parts[0].trim(); // 당뇨 유형
  const secondPart = parts[1].trim(); // 인슐린 투여 여부
  if (firstPart === "2형") {
    await frame.getByLabel("당뇨병 소모성 재료").check();
  } else if (firstPart === "임신중") {
    await frame.getByLabel("당뇨병 소모성 재료").check();
    console.log("임신중 -- 팝업닫기 시작");
    // 알림창
    await page.waitForTimeout(2000);
    const frames_confirm_alert = page.frames();
    let dynamicFrame_confirm_alert;
    let dynamicFrameId_confirm_alert;
    for (let i = frames_confirm_alert.length - 1; i >= 0; i--) {
      const frame_confirm_alert = frames_confirm_alert[i];
      await page.waitForTimeout(1000);
      const ids_confirm_alert = await frame_confirm_alert.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll("iframe"));
        return iframes.map((iframe) => iframe.id);
      });
      for (const id_confirm_alert of ids_confirm_alert) {
        if (
          id_confirm_alert.startsWith("confirm_") &&
          id_confirm_alert.endsWith("_iframe")
        ) {
          dynamicFrame_confirm_alert = frame_confirm_alert;
          dynamicFrameId_confirm_alert = id_confirm_alert;
          console.log("Dynamic iframe found with ID:", id_confirm_alert);
          break;
        }
      }
      if (dynamicFrame_confirm_alert) break;
    }
    if (dynamicFrame_confirm_alert && dynamicFrameId_confirm_alert) {
      const innerFrame_confirm_alert = dynamicFrame_confirm_alert.frameLocator(
        `iframe[id="${dynamicFrameId_confirm_alert}"]`
      );
      await innerFrame_confirm_alert
        .getByRole("link", { name: "예" })
        .waitFor();
      await innerFrame_confirm_alert.getByRole("link", { name: "예" }).click();
    } else {
      console.error("Dynamic iframe not found.");
    }
  } else if (firstPart === "1형") {
    if (
      secondPart === "연속혈당측정용 전극" ||
      secondPart === "연속혈당측정용 전극(기본)" ||
      secondPart === "연속혈당측정용 전극(센서, 복합형)"
    ) {
      await frame.getByLabel("연속혈당측정용 전극(센서)").check();
    } else if (secondPart === "투여") {
      await frame.getByLabel("당뇨병 소모성 재료").check();
    }
  }

  // 저장 버튼
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
    await innerFrame_save_alert.getByRole("link", { name: "확인" }).waitFor();
    await innerFrame_save_alert.getByRole("link", { name: "확인" }).click();
  } else {
    console.error("Dynamic iframe not found.");
  }

  // 제출 서류 첨부
  console.log("Start 제출 서류 첨부 click");
  await frame.getByRole("link", { name: "제출 서류 첨부" }).click();
  console.log("End 제출 서류 첨부 click");

  // 파일 첨부
  console.log("Start 파일 첨부 click");
  const fileChooserPromise = page.waitForEvent("filechooser");

  const parentDiv = frame
  .frameLocator('iframe[title="popup_fileUpload"]')
  .frameLocator("#btrsFrame")
  .locator("#btnsNormal");

  /*await frame
    .frameLocator('iframe[title="popup_fileUpload"]')
    .frameLocator("#btrsFrame")
    .getByRole("button", { name: "① 파일추가" })
    .click();
  console.log("End 파일 첨부 click");*/

  const button1 = parentDiv.locator("button").first();
  await button1.click();

  const fileArr = [path.join(downloadsDirectory, data_1.paymentClaimDelegationFileName),
    path.join(downloadsDirectory, data_1.idCardFileName   ) 
  ];

  // 컴퓨터에서 파일 찾기
  const fileChooser = await fileChooserPromise;
  // 위임장 선택
  await fileChooser.setFiles(
    fileArr
  );

  // 파일 전송
  console.log("Start 파일 전송 click");
  /*await frame
    .frameLocator('iframe[title="popup_fileUpload"]')
    .frameLocator("#btrsFrame")
    .getByRole("button", { name: "② 파일전송" })
    .click();*/

  const button2 = parentDiv.locator("button").nth(1);
  await button2.click();

  while(true){
    const elements = frame
      .frameLocator('iframe[title="popup_fileUpload"]')
      .frameLocator("#btrsFrame")
      .locator("text=저장완료");

    if( (await elements.count()) >= fileArr.length  ){
      break;
    }

  }

  /*await frame
    .frameLocator('iframe[title="popup_fileUpload"]')
    .frameLocator("#btrsFrame")
    .locator("text=저장완료")
    .waitFor({ timeout: 0 }); // 저장완료 text가 나타날때까지 무한 대기*/
  console.log('"저장완료" 텍스트가 프레임 내에 나타났습니다.');
  console.log("End 파일 전송 click");

  const button3 = parentDiv.locator("button").nth(2);
  await button3.click();

  // 파일 저장
  console.log("Start 파일 저장 click");
  /*await frame
    .frameLocator('iframe[title="popup_fileUpload"]')
    .frameLocator("#btrsFrame")
    .getByRole("button", { name: "③ 적 용" })
    .click();*/
  console.log("End 파일 저장 click");

  // 최종제출
  await frame.getByRole("link", { name: "최종제출" }).click();

  // 최종 제출 하시겠습니까? 예 아니요 버튼 (confirm_ _iframe)
  // await browser.close();
}
module.exports = { runAutomation_delegation };

// npx playwright codegen https://medicare.nhis.or.kr/portal/index.do --viewport-size=1920,1080

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
