const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { sendLogToServer } = require("./logUtil");

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
        data.paymentReceiptSignedUrl,
        data.paymentReceiptFileName
      );

      // 연속혈당측정용 전극 고유식별번호 다운로드
      if (data.isCgmSensor) {
        console.log("Start cgm_seq_no_file Download");
        await downloadFile(
          downloadsDirectory,
          data.cgmSeqNoSignedUrl,
          data.cgmSeqNoFileName
        );
      }

      // 위임장 다운로드
      console.log("Start payment_claim_delegation_file Download");
      await downloadFile(
        downloadsDirectory,
        data.paymentClaimDelegationSignedUrl,
        data.paymentClaimDelegationFileName
      );

      // 처방전 다운로드
      console.log("Start prescription_file Download");
      await downloadFile(
        downloadsDirectory,
        data.prescriptionSignedUrl,
        data.prescriptionFileName
      );

      // 출력문서 다운로드
      console.log("Start diabetes_doc_file Download");
      await downloadFile(
        downloadsDirectory,
        data.diabetesDocSignedUrl,
        data.diabetesDocFileName
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

    // 로그인 된 약국명을 가져옴
    await page.waitForTimeout(2000);
    const fullText = await page.textContent("#txt_yoyangName");
    const match = fullText.match(/^[^\[]+/);
    const extractedText = match ? match[0].trim() : "";
    console.log(extractedText);

    // 요양비 청구
    await page.getByRole("link", { name: "요양비", exact: true }).click();
    await page
      .getByRole("link", { name: "요양비청구등록", exact: true })
      .click();
    await page.waitForTimeout(2000);
    const frame = page.frameLocator(
      'iframe[name="windowContainer_subWindow1_iframe"]'
    );

    // 수신자 정보
    await frame.locator("#sel_payClsfcCd").selectOption("당뇨병소모성재료");
    await frame.locator("#inp_sujinjaJuminNo1").fill(data.ssn.split("-")[0]);
    await frame.locator("#inp_sujinjaJuminNo2").fill(data.ssn.split("-")[1]);
    await frame.locator("#inp_sujinjaNm").fill(data.name);
    await frame.locator("#inp_sujinjaNm").press("Enter");

    // 팝업 창(일반적인 요양비 청구가 맞습니까?) 확인 버튼 -> 약국 선택
    // 동적으로 생성되는 태그 값 찾기
    await page.waitForTimeout(3000);

    const dynamicFrameId = await searchIframePopup(page, "confirm_", "_iframe");

    if (dynamicFrameId) {
      const innerFrame = frame.frameLocator(`iframe[id="${dynamicFrameId}"]`);
      await innerFrame.getByRole("link", { name: "예" }).waitFor();
      await innerFrame.getByRole("link", { name: "예" }).click();
    } else {
      console.error("Dynamic iframe not found.");
    }
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

    // 처방전발행일
    await frame.locator("#cal_mprsc_issue_dt_input").click();
    await frame
      .locator("#cal_mprsc_issue_dt_input")
      .fill(data.issue.replace(/-/g, ""));
    await frame.locator("#cal_mprsc_issue_dt_input").press("Enter");
    // 당뇨 구분, 인슐린 투여 (나이(19세 미만))
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
          .getByRole("link", { name: "확인" })
          .waitFor();
        await innerFrame_save_alert.getByRole("link", { name: "확인" }).click();
      } else {
        console.error("Dynamic iframe not found.");
      }
    }

    await page.waitForSelector(
      'iframe[name="windowContainer_subWindow1_iframe"]'
    );
    await frame.locator("#wframeDetail").click();
    const button = frame.locator("#sel_bcbnf_recv_cond_type1_label");
    await button.waitFor({ state: "visible" });
    await button.click();
    // 1형 당뇨
    if (firstPart === "1형") {
      console.log("diabetes 01");
      await frame.locator("#sel_bcbnf_recv_cond_type1_itemTable_1").click();
      if (
        secondPart === "연속혈당측정용 전극" ||
        secondPart === "연속혈당측정용 전극(기본)" ||
        secondPart === "연속혈당측정용 전극(센서, 복합형)"
      ) {
        await frame
          .locator('label:has-text("연속혈당측정용 전극(센서)")')
          .check();
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

    // 요양기관, 의사 번호, 전문의 번호
    await frame.locator("#wq_uuid_673").click();
    await frame.locator("#wq_uuid_673").press("Enter");
    try {
      await page.waitForTimeout(2000);
      await frame
        .frameLocator('iframe[title="bipbkz210p01"]')
        .locator("#inp_ykiho")
        .click();
      await frame
        .frameLocator('iframe[title="bipbkz210p01"]')
        .locator("#inp_ykiho")
        .fill(data.hospital);
      await frame
        .frameLocator('iframe[title="bipbkz210p01"]')
        .getByRole("link", { name: "검색" })
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
        .getByRole("link", { name: "조회" })
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
          .getByRole("link", { name: "선택" })
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
            .getByRole("link", { name: "선택" })
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
              .getByRole("link", { name: "선택" })
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

    // 상병 코드
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
        if (frameExists.length > 0) {
          await frame
            .frameLocator('iframe[title="bipbkz220p01"]')
            .locator("text=" + data.code)
            .click();
          await frame
            .frameLocator('iframe[title="bipbkz220p01"]')
            .getByRole("link", { name: "선택" })
            .click();
          console.log("Element was clicked.");
        }
      } catch (innerError) {
        console.log("Frame or element not found:", innerError.message);
      }
    } catch (error) {
      console.error("An error occurred:", error.message);
    }

    // 혈당검사횟수, 인슐린투여횟수
    await frame.locator("#inp_data_cnt13").click();
    await frame.locator("#inp_data_cnt13").fill("");
    await frame.locator("#inp_data_cnt13").fill(data.blood);
    await frame.locator("#inp_data_cnt14").click();
    await frame.locator("#inp_data_cnt14").fill("");
    await frame.locator("#inp_data_cnt14").fill(data.insulin);

    // 구매일, 사용개시일, 지급일수
    await frame.locator("#cal_buy_dd_input").click();
    await frame.locator("#cal_buy_dd_input").fill(data.purchase);

    await frame.locator("#wq_uuid_797").click(); // 허공을 클릭해야 아래의 confirm_iframe 창이 뜨기 때문에 존재하는 코드

    await page.waitForTimeout(6000);

    const dupIframeId = await searchIframePopup(page, "confirm_", "_iframe");

    if(dupIframeId){
      const innerFrame = frame.frameLocator(`iframe[id="${dupIframeId}"]`);
      await innerFrame.locator('a#btn_Yes').waitFor();
      await innerFrame.locator('a#btn_Yes').click();

      await page.waitForTimeout(6000);

      const dupIframeId2 = await searchIframePopup(page, "alert_", "_iframe");
      if(dupIframeId2){
        const innerFrame = frame.frameLocator(`iframe[id="${dupIframeId2}"]`);
        await innerFrame.locator('a#btn_Confirm').waitFor();
        await innerFrame.locator('a#btn_Confirm').click();

        await page.waitForTimeout(6000);

        const dupIframeId3 = await searchIframePopup(page, "alert_", "_iframe");

        if(dupIframeId3){
          const innerFrame = frame.frameLocator(`iframe[id="${dupIframeId3}"]`);
          await innerFrame.locator('a#btn_Confirm').waitFor();
          await innerFrame.locator('a#btn_Confirm').click();
        }
      }

    }else{
      await frame.locator("#cal_buy_dt_input").click();
      await frame.locator("#cal_buy_dt_input").fill(data.purchase);
    }


    await frame.locator("#inp_pay_freq").click();
    await frame.locator("#inp_pay_freq").fill(data.eat);

    await frame.locator("#wq_uuid_797").click();

    await page.waitForTimeout(3000);

    const dupIframeId4 = await searchIframePopup(page, "alert_", "_iframe");

    if(dupIframeId4){
      const innerFrame = frame.frameLocator(`iframe[id="${dupIframeId4}"]`);
      await innerFrame.locator('a#btn_Confirm').waitFor();
      await innerFrame.locator('a#btn_Confirm').click();
    }

    // 제품사용내역등록(식별번호등록)
    await frame.locator("#wq_uuid_803").waitFor({ state: "visible" });
    await frame.locator("#wq_uuid_803").click();
    await frame.locator("#wq_uuid_803").press("Enter");
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
        await frame
          .frameLocator('iframe[title="pop_bipbkc154p01"]')
          .locator("#G_grd_tbbibo07__CASH_PRDCT_USE_QTY")
          .fill(data.p_quantity[i]);
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

    // 제출 서류 첨부
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

    const fileArr = [
      path.join(downloadsDirectory, data.prescriptionFileName),
      path.join(downloadsDirectory, data.diabetesDocFileName),
      path.join(downloadsDirectory, data.paymentReceiptFileName),
    ];

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

    /*await frame
      .frameLocator('iframe[title="popup_fileUpload"]')
      .frameLocator("#btrsFrame")
      .getByRole("button", { name: "③ 적 용" })
      .click();*/

    // 최종제출
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
  } catch (e) {
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

// npx playwright codegen https://medicare.nhis.or.kr/portal/index.do --viewport-size=1920,1080


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
