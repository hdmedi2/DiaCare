const { chromium } = require("playwright");
const fs = require("fs");
const { parse } = require("json2csv");
const {XMLHttpRequest} = require("xmlhttprequest");
const {HOMETAX_URL, SAVE_HOMETAX_DIR, SAVE_FILE_DIR, SAVE_LOG_DIR, SAVE_MAIN_DIR} = require("../config/default.json");
const log = require("electron-log");
const path = require("path");
const os = require("os");
const today = new Date();
const year = today.getFullYear(); // 2023
const month = (today.getMonth() + 1).toString().padStart(2, '0'); // 06
const day = today.getDate().toString().padStart(2, '0'); // 18
const dateString = year + '-' + month + '-' + day; // 2023-06-18

let logPath = "";
let userFileDirectory = "";
let userHomeTaxDirectory = "";


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
if (!fs.existsSync(userFileDirectory)) {
    fs.mkdirSync(userFileDirectory, { recursive: true });
}

// 2-4. 홈택스 신고 자료 디렉토리 생성
if (!fs.existsSync(userHomeTaxDirectory)) {
    fs.mkdirSync(userHomeTaxDirectory, { recursive: true });
}

// 2-5. 로그 파일명 설정
Object.assign(console, log.functions);
log.transports.file.resolvePathFn = () => path.join(logPath, 'main-' + dateString +'.log');

/**
 * 3. 홈택스 신고 메인
 * @param data
 * @returns {Promise<void>}
 */
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

    // 3-1. 홈택스 브라우저 화면 크기 조절
    // 시스템 화면 크기를 가져오는 기능
    const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    const context = await browser.newContext({
        viewport: { width, height}, // Playwright가 뷰포트를 설정하지 않도록 설정
    });

    // 3-2. 공인인증서 로그인
    const page = await context.newPage();
    await page.goto(HOMETAX_URL);
    await page.waitForTimeout(2000);
    await page.click('#mf_wfHeader_group1503');
    //
    await page.click('#mf_txppWframe_anchor22');

    // 3-3 인증서 팝업창 선택
    const frame = await page.frameLocator('#dscert');
    await page.waitForTimeout(2000);
    const strSlide = await frame.locator("#wrap_stg_01");

    // 테이블이 존재하는지 확인
    if (await strSlide.count() > 0) {
        console.log('테이블을 찾았습니다.');
    } else {
        console.log('테이블을 찾을 수 없습니다.');
    }
    const nButton = await frame.getByRole("row", {name: data.taxCertificateName, exact:true});

    if (await nButton.count()>0) {
        await nButton.click();
    }
    else {
        log.error(`세금계산서용 인증서의 이름이 정확한지 확인하세요: "${data.certificateName}"`);
        console.log(`세금계산서용 인증서의 이름이 정확한지 확인하세요: "${data.certificateName}"`);
    }

    // await page.getByText(data.taxCertificateName,{exact:true}).click();
    // await page.getByRole("textbox", { name: "인증서 암호" }).click();
    await frame
         .locator("#input_cert_pw") // 인증서 암호란 클릭
         .click();
    await frame
         .locator("#input_cert_pw") //
         .fill(data.certificatePassword); // 인증서 암호 채우기
    // 확인 버튼 눌러서 로그인
    await frame
         .getByRole("button", { name: "확인" }).click();


    // 3-5. 전자세금계산서 발행 메뉴 찾아가기
    await page.waitForTimeout(2000)
    await page.getByText("계산서·영수증·카드").click();
    await page.getByRole("link", { name: "일괄/공동매입분 발급"}).click();
    await page.waitForTimeout(1000);
    const link2 = await page.getByRole("link", { name: "전자(세금)계산서 일괄발급", exact: true });

    if (await link2.count()>0) {
        await link2.click();
    }
    else {
        console.log("일괄 발급 링크 못찾음");
        log.error("일괄 발급 메뉴 링크 못찾음");
    }
    // 전자세금계산서 등록 화면에서 대기 필요함
    await page.waitForLoadState("domcontentloaded", {timeout:2000});

    const fileInput = await page.locator("#mf_txppWframe_filename");
    if (await fileInput.count()>0) {
        console.log("파일 선택창 찾음");
        // 파일 경로를 강제로 설정
        await page.waitForLoadState("domcontentloaded", {timeout:3000});
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


// Chrome Preferences 파일 경로 설정
function getChromePreferencesPath() {
    const platform = os.platform();
    let preferencesPath;

    if (platform === 'win32') {
        preferencesPath = path.join(
            process.env.LOCALAPPDATA,
            'Google',
            'Chrome',
            'User Data',
            'Default',
            'Preferences'
        );
    } else if (platform === 'darwin') {
        preferencesPath = path.join(
            os.homedir(),
            'Library',
            'Application Support',
            'Google',
            'Chrome',
            'Default',
            'Preferences'
        );
    } else if (platform === 'linux') {
        preferencesPath = path.join(
            os.homedir(),
            '.config',
            'google-chrome',
            'Default',
            'Preferences'
        );
    } else {
        throw new Error('Unsupported platform: ' + platform);
    }

    return preferencesPath;
}

// Chrome 다운로드 디렉토리 가져오기
function getChromeDownloadDirectory() {
    const preferencesPath = getChromePreferencesPath();

    try {
        const preferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf-8'));
        const downloadPath = preferences['download']['default_directory'];

        if (downloadPath) {
            console.log('Chrome Download Directory:', downloadPath);
        } else {
            console.log('Default Chrome Download Directory 설정이 없습니다.');
        }
    } catch (err) {
        console.error('Error reading Chrome Preferences:', err.message);
    }
}
module.exports = { runAutomation_homeTax };
