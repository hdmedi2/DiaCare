const { chromium } = require("playwright");
const fs = require("fs");
const { parse } = require("json2csv");
const {XMLHttpRequest} = require("xmlhttprequest");
const {HOMETAX_URL,SAVE_LOG_DIR, SAVE_MAIN_DIR} = require("../config/default.json");
const log = require("electron-log");
const path = require("path");
const os = require("os");
const today = new Date();
const year = today.getFullYear(); // 2023
const month = (today.getMonth() + 1).toString().padStart(2, '0'); // 06
const day = today.getDate().toString().padStart(2, '0'); // 18
const screen = require("electron");
const dateString = year + '-' + month + '-' + day; // 2023-06-18
const window = require("Window");
let logPath = "";
// let userHomeDirectory = "";
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

async function runAutomation_homeTax(data) {
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

    // 홈택스 화면 크기 조절
    const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    const context = await browser.newContext({
        viewport: { width, height}, // Playwright가 뷰포트를 설정하지 않도록 설정
    });
    const page = await context.newPage();
    // 시스템 화면 크기를 가져오는 기능
    await page.goto(HOMETAX_URL);
    // await page.waitForTimeout(6000);
    //const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    // 공인인증서 로그인
    // await page.getByRole("link",{ label: "로그인", exact: true}).click();
    // await page.getByRole('link', { name: '로그인', exact: true })
    await page.click('#mf_wfHeader_group1503');
    await page.click('#mf_txppWframe_anchor22');



    const frame = await page.frameLocator('#dscert');
    await page.waitForTimeout(2000);
    const strSlide = await frame.locator("#wrap_stg_01");

    // 테이블이 존재하는지 확인
    if (await strSlide.count() > 0) {
        console.log('테이블을 찾았습니다.');
    } else {
        console.log('테이블을 찾을 수 없습니다.');
    }

    // MSG_TS703 요소 선택
    // const element = await frame.locator('#MSG_TS703');

    // 요소가 존재하는지 확인
    //if (await element.count() > 0) {
    //    console.log('MSG_TS703 요소를 찾았습니다.');
    //    await element.click(); // 클릭 (필요한 경우)
    //} else {
    //    console.log('MSG_TS703 요소를 찾을 수 없습니다.');
    //}


    // const dynamicButton = await page.locator('#MSG_TS709');

    // const dynamicButton = page.locator('a#stg_financial');
    // await dynamicButton.waitFor();
    // await dynamicButton.click();

    // 팝업 창에서 stgidx="1" 클릭

    // 브라우저 닫기
    // await page.click('#mf_txppWframe_loginboxFrame_anchor22'); // 간편인증
    // await page.getByRole("row", { name: '서정현(Jeong hyeon Seo)0004041H030504492' }).click();
    // await page.getByRole("", { name: "서정현(Jeong hyeon Seo)0004041H030504492", exact: true }).click();
    // await page.getByTitle("서정현()002368820140731123000311", { exact: true }).click();
    // await page.getByTitle("한도 가까운약국", { exact: true }).click();
    // await page.getByRole("radio", { name: data.taxCertificateLocation }).click();
    // 하드디스크의 경우 certificateLocation 값이 비어있기 때문에 오류 메시지가 뜸
    // "한도 가까운약국" 텍스트를 포함하는 row 찾기
    // const row = page.locator('tbody tr', { hasText: '한도 가까운약국' });

    // row 안의 <a> 태그 클릭
    // await row.locator('a').click();
    // row = await page.locator('a:has(span[title="한도 가까운약국"])');

    // 팝업 창 열림 대기

    // 테이블에서 원하는 타이틀과 일치하는 행 찾기
    // const titleToMatch = '한도 가까운약국'; // 원하는 타이틀 값
    // const targetSelector = 'table tbody tr td a span[title="가까운약국"]';
    // const row = page.locator(targetSelector);
    // const row = page.locator('#tabledataTable').first();
    // const table = await frame.locator('#contenttabledataTable'); //tabledataTable
    // let  nButton = await frame.getByRole("row", {name: "한도 가까운약국"});
    //
    // if (await nButton.count()>0) {
    //     console.log("Test");
    //     await nButton.click();
    // }
    // else {
    //     console.log("Fail");
    // }

    //const nButton = await frame.getByRole("row", {name: "서정현()002368820140731123000311"});
    const nButton = await frame.getByRole("row", {name: ""});

    if (await nButton.count()>0) {
        console.log("Test2");
        await nButton.click();
    }
    else {
        console.log("Fail");
    }

    await frame.locator("#input_cert_pw").click();

    // await page.getByText(data.taxCertificateName,{exact:true}).click();
    // await page.getByRole("textbox", { name: "인증서 암호" }).click();
    //await page
    //    .getByRole("textbox", { name: "인증서 암호" })
    //    .fill(data.certificatePassword);

    await frame.locator("#input_cert_pw").fill("");
    await frame.getByRole("button", { name: "확인" }).click();

    // await page.goto("https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTEETBAA01");

    await page.waitForTimeout(2000)
    await page.getByText("계산서·영수증·카드").click();  // mf_wfHeader_wq_uuid_326
    // await page.getByText("전자(세금)계산서 건별발급").click(); // 전자세금계산서 건별발급
    // const tax = await page.locator('span', { hasText: '전자(세금)계산서 건별발급' });
    //const tax = await page.locator('#combineMenuAtag_4601010100');
    //if (tax.count() > 0) {
    //    console.log("클릭");
    //    tax.click();
    //} else {
    //    console.log("못찾음");
    //}

    // await page.getByRole('link', { name: '전자(세금)계산서 건별발급' }).click();
    // 2) <span label="4이너" escape="false">전자(세금)계산서 건별발급</span> aka locator('#menuAtag_4601010100')



    //  await frame.locator("#btn_confirm_iframe").click();


    // 테이블이 존재하는지 확인
    //if (n > 0) {
    //    console.log(`${n}개의 항목을 찾았습니다.`);
    //} else {
    //    console.log('리스트를  찾을 수 없습니다.');
    //}

    // 테이블의 내용 출력 (HTML)
    // const tableContent = await table.innerHTML();
    // console.log('테이블 내용:', tableContent);
    // 해당 항목 클릭
    //if (await row.count() > 0) {
    //    await row.click();
    //    console.log(`"${titleToMatch}" 항목을 클릭했습니다.`);
    //} else {
    //    console.log(`"${titleToMatch}" 항목을 찾을 수 없습니다.`);
    //}
    // await page.goto("https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=search&searchInfo1488165769");


    // try {
    //     const linkElement = await page.getByRole("link", {
    //         name: data.taxCertificatePath,
    //     });
    //     if (linkElement) {
    //         await linkElement.click();
    //         console.log("Element was clicked.");
    //     }
    // } catch (error) {
    //     console.error("An error occurred:", error);
    // }
    // await page.getByText(data.taxCertificateName,{exact:true}).click();
    // await page.getByRole("textbox", { name: "인증서 암호" }).click();
    // await page
    //    .getByRole("textbox", { name: "인증서 암호" })
    //    .fill(data.certificatePassword);
    // await page.getByRole("button", { name: "확인" }).click();

    await page.getByRole("link", { name: "일괄/공동매입분 발급"}).click();
    await page.waitForTimeout(1000);
    const link2 = await page.getByRole("link", { name: "전자(세금)계산서 일괄발급", exact: true });
    //const link2 = await page.locator("#grpMenuAtag_46_4601010500");
    if (await link2.count()>0) {
        console.log("일괄 발급 링크 찾음");
        await link2.click();
    }
    else {
        console.log("일괄 발급 링크 못찾음");
    }
    await page.waitForTimeout(3000);
    // 파일 경로를 설정할 input 태그 선택
    // const fileInput = await page.locator('input[type="file"][name="filename"]');

    const fileInput = await page.locator("#mf_txppWframe_filename");
    if (await fileInput.count()>0) {
        console.log("파일 선택창 찾음");
        // 파일 경로를 강제로 설정
        await page.waitForTimeout(3000);
        try {
            await fileInput.setInputFiles('/Users/m1u/downloads/세금계산서등록양식(일반) (1).xls'); // 파일 경로 지정
        } catch (e) {
            console.error(`업로드할 세금계산서 파일 찾는 중 오류 발생: ${e.message}`);
        }
        // await fileInput.click();

    }
    else {
        console.log("파일 선택창 못찾음");
    }
    // if (true) {
    //     await page.click('#stg_finance');
    // }
    // else {
    //     await page.click('#stg_hdd');
    // }

    console.log("ss");
    //await page('#mf_wfHeader_group1503').click();
    //await page.locator("#grp_loginBtn").click();
    // await page.locator("#btnCorpLogin").click();
    /*
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
*/
    // 요양비청구위임내역 조회
    await page.getByRole("link", { name: "요양비", exact: true }).click();
    await page
        .getByRole("link", { name: "요양비청구내역조회", exact: true })
        .click();

    const frame2 = page.frameLocator(
        'iframe[name="windowContainer_subWindow1_iframe"]'
    );
    await frame2.locator("#wq_uuid_39").click();

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

            const saveDir = "C:\\DiaCare\\billing";
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
                    if (rawFile.status === 200 || rawFile.status === 0) {
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
    await browser.close();
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
        if (value.hasOwnProperty(count) && value.count()>0) {
            return Boolean(false);
        }
        else return Boolean(true);
    }

}

module.exports = { runAutomation_homeTax };
