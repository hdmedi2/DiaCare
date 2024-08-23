const { chromium } = require('playwright');
const fs = require('fs');
const { parse } = require('json2csv');

async function checkDelegation(data) {
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


  // 요양비청구위임내역등록
  await page.getByRole('link', { name: '요양비', exact: true }).click();
  await page.getByRole('link', { name: '요양비청구위임내역조회', exact: true }).click();

  const today = new Date();
  // const year = today.getFullYear();
  // const month = today.getMonth() + 1;
  const day = today.getDate();
  const frame = page.frameLocator('iframe[name="windowContainer_subWindow1_iframe"]');

  await frame.locator('#cal_s_fr_dt_img').click();
  await frame.getByRole('button', { name: '현재일' }).click();
  await frame.getByRole('button', { name: `${day}` }).click();
  await page.frameLocator('iframe[name="windowContainer_subWindow1_iframe"]').getByRole('link', { name: '조회' }).click();

  // 버튼 클릭 후 발생하는 특정 URL의 네트워크 응답을 기다림
  const [response] = await Promise.all([
    // 특정 URL에 대한 응답을 기다림
    page.waitForResponse(response => response.url() === 'https://medicare.nhis.or.kr/portal/bk/c/193/selectBcbnfDmdMdtResultList.do'),
  ]);

  // 응답 상태와 URL을 콘솔에 출력
  console.log('<<', response.status(), response.url());

  try {
    // 응답 본문 데이터를 JSON 형식으로 가져오기
    const responseBody = await response.json();
    //console.log('Response body:', responseBody);
    

    if (responseBody.dl_tbbibo59) {
      console.log('Number of rows:', responseBody.dl_tbbibo59.length);

      // CSV로 저장
      const fields = Object.keys(responseBody.dl_tbbibo59[0]); // CSV 헤더로 사용될 필드명
      const csv = parse(responseBody.dl_tbbibo59, { fields });

      fs.writeFileSync('output_delegation.csv', csv);
      console.log('Data saved to output.csv');
    } else {
      console.log('No data found in the response');
    }

  } catch (error) {
    console.error('Failed to get response body:', error);
  }
  await browser.close();
}
module.exports = { checkDelegation };