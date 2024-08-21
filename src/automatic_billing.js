const { page, chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runAutomation_billing(data) {
  const channels = ["chrome", "chrome-beta", "chrome-dev", "chrome-canary", "msedge", "msedge-beta", "msedge-dev", "msedge-canary"];
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
    console.error('No supported browser channels found.');
    return;
  }

  const page = await browser.newPage();
  await page.goto('https://medicare.nhis.or.kr/portal/index.do');
  //const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // 공인인증서 로그인
  await page.locator('#grp_loginBtn').click();
  await page.locator('#btnCorpLogin').click();
  await page.getByRole('radio', { name: data.certificateLocation }).click();
  // 하드디스크의 경우 certificateLocation 값이 비어있기 때문에 오류 메시지가 뜸
  try {
    const linkElement = await page.getByRole('link', { name: data.certificatePath });
    if (linkElement) {
      await linkElement.click();
      console.log('Element was clicked.');
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
  await page.getByText(data.certificateName).click();
  await page.getByRole('textbox', { name: '인증서 암호' }).click();
  await page.getByRole('textbox', { name: '인증서 암호' }).fill(data.certificatePassword);
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByRole('link', { name: data.corporateId }).click();

  // 로그인 된 약국명을 가져옴
  await page.waitForTimeout(2000);
  const fullText = await page.textContent('#txt_yoyangName');
  const match = fullText.match(/^[^\[]+/);
  const extractedText = match ? match[0].trim() : '';
  console.log(extractedText);

  // 요양비 청구
  await page.getByRole('link', { name: '요양비', exact: true }).click();
  await page.getByRole('link', { name: '요양비청구등록', exact: true }).click();
  await page.waitForTimeout(2000);
  const frame = page.frameLocator('iframe[name="windowContainer_subWindow1_iframe"]');

  // 수신자 정보
  await frame.locator('#sel_payClsfcCd').selectOption('당뇨병소모성재료');
  await frame.locator('#inp_sujinjaJuminNo1').fill(data.ssn.split('-')[0]);
  await frame.locator('#inp_sujinjaJuminNo2').fill(data.ssn.split('-')[1]);
  await frame.locator('#inp_sujinjaNm').fill(data.name);
  await frame.locator('#inp_sujinjaNm').press('Enter');

  // 팝업 창(일반적인 요양비 청구가 맞습니까?) 확인 버튼 -> 약국 선택
  // 동적으로 생성되는 태그 값 찾기
  await page.waitForTimeout(3000);
  const frames = page.frames();
  let dynamicFrame;
  let dynamicFrameId;
  for (const frame of frames) {
    const ids = await frame.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.map(iframe => iframe.id);
    });
    for (const id of ids) {
      if (id.startsWith('confirm_') && id.endsWith('_iframe')) {
        dynamicFrame = frame;
        dynamicFrameId = id;
        console.log('Dynamic iframe found with ID:', id);
        break;
      }
    }
    if (dynamicFrame) break;
  }
  if (dynamicFrame && dynamicFrameId) {
    const innerFrame = frame.frameLocator(`iframe[id="${dynamicFrameId}"]`);
    await innerFrame.getByRole('link', { name: '예' }).waitFor();
    await innerFrame.getByRole('link', { name: '예' }).click();
  } else {
    console.error('Dynamic iframe not found.');
  }
  await frame.frameLocator('iframe[title="bipbkz300p01"]').locator(`text=${extractedText}`).waitFor();
  await frame.frameLocator('iframe[title="bipbkz300p01"]').getByText(extractedText).click();
  await frame.frameLocator('iframe[title="bipbkz300p01"]').getByRole('link', { name: '선택' }).click();

  // 처방일자
  await frame.locator('#cal_mprsc_issue_dt_input').click();
  await frame.locator('#cal_mprsc_issue_dt_input').fill(data.issue.replace(/-/g, ''));

  // 당뇨 구분, 인슐린 투여 (나이(19세 미만))
  console.log('Selected Option Value:', data.select);
  const parts = data.select.split('|').map(part => part.trim());
  const firstPart = parts[0].trim();  // 당뇨 유형
  const secondPart = parts[1].trim(); // 인슐린 투여 여부
  const thirdPart = parts[2]?.trim(); // 나이(19세 미만)
  await page.waitForSelector('iframe[name="windowContainer_subWindow1_iframe"]');
  await frame.locator('#wframeDetail').click();
  const button = frame.locator('#sel_bcbnf_recv_cond_type1_label');
  await button.waitFor({ state: 'visible' });
  await button.click();
  // 1형 당뇨
  if (firstPart === '1형') {
    console.log('diabetes 01');
    await frame.locator('#sel_bcbnf_recv_cond_type1_itemTable_1').click();
    if (secondPart === '연속혈당측정용 전극' ||
      secondPart === '연속혈당측정용 전극(기본)' ||
      secondPart === '연속혈당측정용 전극(센서, 복합형)') {
      await frame.locator('label:has-text("연속혈당측정용 전극(센서)")').check();
    }
  }
  // 2형 당뇨
  else if (firstPart === '2형') {
    console.log('diabetes 02');
    await frame.locator('#sel_bcbnf_recv_cond_type1_itemTable_2').click();
    await frame.locator('#sel_bcbnf_recv_cond_type2_button').click();
    if (secondPart === '투여') {
      await frame.locator('#sel_bcbnf_recv_cond_type2_itemTable_1').click();
    }
    else if (secondPart === '미투여') {
      if (thirdPart === '19세 미만') {
        await frame.locator('#sel_bcbnf_recv_cond_type2_itemTable_2').click();
      }
    }
  }
  // 임신중 당뇨
  else if (firstPart === '임신중') {
    console.log('Pregnancy');
    await frame.locator('#sel_bcbnf_recv_cond_type1_itemTable_3').click();
    await frame.locator('#sel_bcbnf_recv_cond_type2_button').click();
    if (secondPart === '투여') {
      await frame.locator('#sel_bcbnf_recv_cond_type2_itemTable_1').click();
    }
    else if (secondPart === '미투여') {
      await frame.locator('#sel_bcbnf_recv_cond_type2_itemTable_2').click();
    }
  }

  // 요양기관, 의사 번호, 전문의 번호
  await frame.locator('#wq_uuid_657').click();
  await frame.locator('#wq_uuid_657').press('Enter');
  try {
    await page.waitForTimeout(2000);
    await frame.frameLocator('iframe[title="bipbkz210p01"]').locator('#inp_ykiho').click();
    await frame.frameLocator('iframe[title="bipbkz210p01"]').locator('#inp_ykiho').fill(data.hospital);
    await frame.frameLocator('iframe[title="bipbkz210p01"]').getByRole('link', { name: '검색' }).click();
    await page.waitForTimeout(2000);
    await frame.frameLocator('iframe[title="bipbkz210p01"]').locator('#inp_drLicNo').click();
    // 전문의 번호 입력
    // await frame.frameLocator('iframe[title="bipbkz210p01"]').locator('#inp_spdrQlfNo').fill(data.doctor);
    await frame.frameLocator('iframe[title="bipbkz210p01"]').locator('#inp_drLicNo').fill(data.doctor);
    await frame.frameLocator('iframe[title="bipbkz210p01"]').getByRole('link', { name: '조회' }).click();
    await page.waitForTimeout(3000);
    // 현재는 "내과" text를 클릭하게 하였지만 변경 예정
    // 과가 2개 나오는 의사 분은 과 선택 Flow가 있지만, 과가 1개인 사람은 바로 넘어가는 Flow라 아래 코드 개발 -> 전문의 번호까지 입력 가능하면 필요 없는 코드
    const linkElement_1 = await frame.frameLocator('iframe[title="bipbkz210p01"]').locator('text="내과"').elementHandles();
    if (linkElement_1.length > 0) {
      await linkElement_1[0].click();
      await frame.frameLocator('iframe[title="bipbkz210p01"]').getByRole('link', { name: '선택' }).click();
      console.log('Element was clicked.');
    }
    else {
      console.log('No element found with the given text.');
    }
  }
  catch (error) {
    console.error('An error occurred:', error.message);
  }

  // 상병 코드
  try {
    await frame.locator('#inp_bcbnf_recv_sick_sym').click();
    await frame.locator('#inp_bcbnf_recv_sick_sym').fill(data.code);
    await frame.locator('#btn_sick_cd').click();
    await page.waitForTimeout(2000);
    try {
      const frameExists = await frame.frameLocator('iframe[title="bipbkz220p01"]').locator('text=' + data.code).elementHandles();
      if (frameExists.length > 0) {
        await frame.frameLocator('iframe[title="bipbkz220p01"]').locator('text=' + data.code).click();
        await frame.frameLocator('iframe[title="bipbkz220p01"]').getByRole('link', { name: '선택' }).click();
        console.log('Element was clicked.');
      }
    }
    catch (innerError) {
      console.log('Frame or element not found:', innerError.message);
    }
  }
  catch (error) {
    console.error('An error occurred:', error.message);
  }

  // 혈당검사횟수, 인슐린투여횟수
  await frame.locator('#inp_data_cnt13').click();
  await frame.locator('#inp_data_cnt13').fill('');
  await frame.locator('#inp_data_cnt13').fill(data.blood);
  await frame.locator('#inp_data_cnt14').click();
  await frame.locator('#inp_data_cnt14').fill('');
  await frame.locator('#inp_data_cnt14').fill(data.insulin);

  // 구매일, 사용개시일, 지급일수
  await frame.locator('#cal_buy_dd_input').click();
  await frame.locator('#cal_buy_dd_input').fill(data.purchase);
  await frame.locator('#cal_buy_dt_input').click();
  await frame.locator('#cal_buy_dt_input').fill(data.purchase);
  await frame.locator('#inp_pay_freq').click();
  await frame.locator('#inp_pay_freq').fill(data.eat);

  // 제품사용내역등록(식별번호등록)
  await frame.locator('#wq_uuid_787').waitFor({ state: 'visible' });
  await frame.locator('#wq_uuid_787').click();
  await frame.locator('#wq_uuid_787').press('Enter');
  // 제품명, 수량, 금액
  for (let i = 0; i < 10; i++) {
    let k = 2 * i + 1;
    if (k < data.product.length) {
      console.log('-------------------');
      console.log(data.product[k], data.p_price[i], data.p_quantity[i]);
      await frame.frameLocator('iframe[title="pop_bipbkc154p01"]').getByRole('link', { name: '행추가' }).click();
      await frame.frameLocator('iframe[title="pop_bipbkc154p01"]').locator(`#grd_tbbibo07_cell_${i}_3`).click();
      await frame.frameLocator('iframe[title="pop_bipbkc154p01"]').locator('#G_grd_tbbibo07__BCBNF_PRDCT_ORG_ID').fill(data.product[k]);
      await frame.frameLocator('iframe[title="pop_bipbkc154p01"]').locator(`#grd_tbbibo07_cell_${i}_10`).click();
      await frame.frameLocator('iframe[title="pop_bipbkc154p01"]').locator('#G_grd_tbbibo07__CASH_PRDCT_USE_QTY').fill(data.p_quantity[i]);
      await frame.frameLocator('iframe[title="pop_bipbkc154p01"]').locator(`#grd_tbbibo07_cell_${i}_13`).click();
      await frame.frameLocator('iframe[title="pop_bipbkc154p01"]').locator('#G_grd_tbbibo07__CASH_PRDCT_PRDCT_AMT').fill(data.p_price[i]);
    }
  }
  await frame.frameLocator('iframe[title="pop_bipbkc154p01"]').getByRole('link', { name: '적용' }).click();

  await frame.getByRole('link', { name: '저장' }).click();
  console.log("Click the Save button");

  // 알림창
  const frames_save = page.frames();
  let dynamicFrame_save;
  let dynamicFrameId_save;
  for (const frame_save of frames_save) {
    await page.waitForTimeout(3000);
    const ids_save = await frame_save.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.map(iframe => iframe.id);
    });
    for (const id_save of ids_save) {
      if (id_save.startsWith('confirm_') && id_save.endsWith('_iframe')) {
        dynamicFrame_save = frame_save;
        dynamicFrameId_save = id_save;
        console.log('Dynamic iframe found with ID:', id_save);
        break;
      }
    }
    if (dynamicFrame_save) break;
  }
  if (dynamicFrame_save && dynamicFrameId_save) {
    const innerFrame_save = frame.frameLocator(`iframe[id="${dynamicFrameId_save}"]`);
    await innerFrame_save.getByRole('link', { name: '예' }).waitFor();
    await innerFrame_save.getByRole('link', { name: '예' }).click();
  }
  else {
    console.error('Dynamic iframe not found.');
  }

  // 알림창
  const frames_save_alert = page.frames();
  let dynamicFrame_save_alert;
  let dynamicFrameId_save_alert;
  for (const frame_save_alert of frames_save_alert) {
    await page.waitForTimeout(3000);
    const ids_save_alert = await frame_save_alert.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.map(iframe => iframe.id);
    });
    for (const id_save_alert of ids_save_alert) {
      if (id_save_alert.startsWith('alert_') && id_save_alert.endsWith('_iframe')) {
        dynamicFrame_save_alert = frame_save_alert;
        dynamicFrameId_save_alert = id_save_alert;
        console.log('Dynamic iframe found with ID:', id_save_alert);
        break;
      }
    }
    if (dynamicFrame_save_alert) break;
  }
  if (dynamicFrame_save_alert && dynamicFrameId_save_alert) {
    const innerFrame_save_alert = frame.frameLocator(`iframe[id="${dynamicFrameId_save_alert}"]`);
    await innerFrame_save_alert.getByRole('link', { name: '확인' }).waitFor();
    await innerFrame_save_alert.getByRole('link', { name: '확인' }).click();
  }
  else {
    console.error('Dynamic iframe not found.');
  }

  await frame.getByRole('link', { name: '제출 서류 첨부' }).click();

  // 파일첨부
  // // 사용자 홈 디렉터리와 다운로드 디렉터리 경로 설정
  // const userHomeDirectory = process.env.HOME || process.env.USERPROFILE;
  // const downloadsDirectory = path.join(userHomeDirectory, 'Downloads');
  // const fileName = 'hello.pdf';
  // const filePath = path.join(downloadsDirectory, fileName);

  // // 파일이 실제로 존재하는지 확인
  // if (!fs.existsSync(filePath)) {
  //   console.error('Error: File does not exist:', filePath);
  //   process.exit(1); // 파일이 없으면 스크립트를 종료합니다.
  // }
  // console.log('File path:', filePath);
  // await frame.getByRole('link', { name: '제출 서류 첨부' }).click();

  // // 숨겨진 요소를 강제로 표시하는 코드 실행
  // await frame.evaluate(() => {
  //   const dropTarget = document.querySelector('#dropStr');
  //   if (dropTarget) {
  //     dropTarget.style.display = 'block'; // 숨겨진 요소를 표시
  //     dropTarget.classList.remove('__web-inspector-hide-shortcut__'); // 숨기는 클래스 제거
  //   } else {
  //     console.error('Error: Drop target not found');
  //   }
  // });

  // // 프레임 내부의 숨겨진 요소가 표시될 때까지 대기
  // await frame.waitForSelector('#dropStr', { timeout: 15000, state: 'visible' }); // 요소가 표시될 때까지 대기

  // // 드래그 앤 드롭 이벤트를 시뮬레이션하는 함수 정의
  // const simulateDragAndDrop = async (page, filePath) => {
  //   await page.evaluate((filePath) => {
  //     const dataTransfer = new DataTransfer();
  //     const file = new File([fs.readFileSync(filePath)], 'hello.pdf', { type: 'application/pdf' });

  //     dataTransfer.items.add(file);

  //     const dropEvent = new DragEvent('drop', {
  //       dataTransfer,
  //       bubbles: true,
  //       cancelable: true
  //     });

  //     const dragOverEvent = new DragEvent('dragover', {
  //       dataTransfer,
  //       bubbles: true,
  //       cancelable: true
  //     });

  //     const dropTarget = document.querySelector('#dropStr');
  //     if (dropTarget) {
  //       dropTarget.dispatchEvent(dragOverEvent);
  //       dropTarget.dispatchEvent(dropEvent);
  //     } else {
  //       console.error('Error: Drop target not found');
  //     }
  //   }, filePath);
  // };

  // // 프레임이 올바르게 로드되었는지 확인하고 접근
  // const dragframe = await page.frameLocator('iframe[title="popup_fileUpload"]').frameLocator('#btrsFrame');

  // if (!dragframe) {
  //   console.error('Error: dragframe not found');
  //   process.exit(1);
  // }

  // // 드래그 앤 드롭 시뮬레이션 실행
  // await simulateDragAndDrop(page, filePath);

  // // 업로드가 완료될 때까지 기다리거나 후속 작업을 수행
  // try {
  //   await page.waitForSelector('text=Upload successful', { timeout: 10000 }); // 10초 타임아웃 추가
  //   console.log('Upload successful');
  // } catch (error) {
  //   console.error('Error: Upload not successful or timed out');
  // }

  // 최종제출
  // <span id="wq_uuid_76" class="w2textbox ">최종제출</span>
  // await frame.getByRole('link', { name: '최종제출' }).click();
  // await browser.close();
}

module.exports = { runAutomation_billing };

// npx playwright codegen https://medicare.nhis.or.kr/portal/index.do --viewport-size=1920,1080