const { chromium } = require('playwright');

async function runAutomation(data) {
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

  // Automation steps...
  await page.locator('#grp_loginBtn').click();
  await page.locator('#btnCorpLogin').click();
  await page.getByRole('radio', { name: '이동식디스크' }).click();
  await page.getByRole('link', { name: 'USB드라이브 (E:)' }).click();
  await page.getByText('유킹스파머시 가까운약국').click();
  await page.getByRole('textbox', { name: '인증서 암호' }).fill('korea8575!!');
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByRole('link', { name: 'sunbi8575' }).click();
  await page.getByRole('link', { name: '요양비', exact: true }).click();
  await page.getByRole('link', { name: '요양비청구등록', exact: true }).click();
  await page.frameLocator('iframe[name="windowContainer_subWindow1_iframe"]').locator('#sel_payClsfcCd').selectOption('당뇨병소모성재료');
  await page.frameLocator('iframe[name="windowContainer_subWindow1_iframe"]').locator('#inp_sujinjaJuminNo1').fill(data.ssn.split('-')[0]);
  await page.frameLocator('iframe[name="windowContainer_subWindow1_iframe"]').locator('#inp_sujinjaJuminNo2').fill(data.ssn.split('-')[1]);
  await page.frameLocator('iframe[name="windowContainer_subWindow1_iframe"]').locator('#inp_sujinjaNm').fill(data.name);
  // await browser.close();
}

module.exports = { runAutomation };

// npx playwright codegen https://medicare.nhis.or.kr/portal/index.do --viewport-size=1920,1080
