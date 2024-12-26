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
/*
// 2-6.엑셀 일괄파일 다운로드
try {
    console.log("Start hometax_file Download");
    log.info("Start hometax_file Download");
        downloadFile(
            userHomeTaxDirectory,
        data.hometaxFileSignedUrl,
        data.hometaxFileName
    );

    log.info("Start payment_receipt_file Downloaded");
}
catch(e) {
    console.error(e.message);
    log.error(e.message);
}
*/


/**
 * 3. 홈택스 신고 메인
 * @param data
 * @returns {Promise<void>}
 */
async function runAutomation_homeTax(data) {
    // 3-6.전자세금계산서 체크박스 선택 분 다운로드
    try {
        if (!isEmpty(data.hometaxFileName) && !isEmpty(data.hometaxFileSignedUrl)) {
            console.log("Start hometax file Download");
            await downloadFile(
                userHomeTaxDirectory,
                data.hometaxFileSignedUrl,
                data.hometaxFileName
            );
            console.log("Start hometax excel Downloaded");
            log.info("Start hometax excel Downloaded");
        }
    }
    catch(e) {
        log.error("no hometax file error", e.message);
        console.log("no hometax file error", e.message);
    }


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

    // 서정현()002368820140731123000311

    const nButton = await frame.getByRole("row").getByTitle(data.taxCertificateName,{exact:true});
    const btnCnt = await nButton.count();
    if (btnCnt > 0) {
        await nButton.click();
    }
    else {
        log.error(`세금계산서용 인증서의 이름이 정확한지 확인하세요: "${data.taxCertificateName}"`);
        console.log(`세금계산서용 인증서의 이름이 정확한지 확인하세요: "${data.taxCertificateName}"`);
    }

    // await page.getByText(data.taxCertificateName,{exact:true}).click();
    // await page.getByRole("textbox", { name: "인증서 암호" }).click();
    await frame
         .locator("#input_cert_pw") // 인증서 암호란 클릭
         .click();
    await frame
         .locator("#input_cert_pw") //
         .fill(data.taxCertificatePassword); // 인증서 암호 채우기
    // 확인 버튼 눌러서 로그인
    await frame
         .getByRole("button", { name: "확인" }).click();


    // 3-5. 전자세금계산서 발행 메뉴 찾아가기
    await page.waitForTimeout(2000)
    await page.getByText("계산서·영수증·카드").click();
    await page.getByRole("link", { name: "일괄/공동매입분 발급"}).click();
    await page.waitForTimeout(1000);
    const link2 = await page.getByRole("link", { name: "전자(세금)계산서 일괄발급", exact: true });

    if (await link2.count() > 0) {
        await link2.click();
    }
    else {
        console.log("홈택스에서 일괄 발급 링크 못찾음");
        log.error("홈택스에서 일괄 발급 메뉴 링크 못찾음");
    }



    await page.waitForLoadState("domcontentloaded", {timeout:8000});
    await page.waitForTimeout(2000);
    const fileInput = await page.locator("#mf_txppWframe_filename");
    if (await fileInput.count()>0) {
        console.log("파일 선택창 찾음");
        // 파일 경로를 강제로 설정
        try {
            await fileInput.setInputFiles(path.join(userHomeTaxDirectory, data.hometaxFileName)); // 파일 경로 지정
        } catch (e) {
            console.error(`업로드할 세금계산서 파일 찾는 중 오류 발생: ${e.message}`);
        }
        await fileInput.click();

        // 엑셀 전환버튼 클릭
        const convertBtn = await page.locator("#mf_txppWframe_trigger37");
        await page.waitForTimeout(10000);
        await convertBtn.click(); // 엑셀 변환버튼 클릭
        console.log("excel convert button clicked");
    }
    else {
        console.log("파일 선택창 못찾음");
    }

    // 일괄신고 버튼 클릭
    const btnBndlEtxivIsnAll = await page.locator("#mf_txppWframe_btnBndlEtxivIsnAll");
    await page.waitForTimeout(2000);
    await btnBndlEtxivIsnAll.click();

    // dialog 이벤트 핸들러
    const dialogHandler = async (dialog) => {
        console.log(`Dialog message: ${dialog.message()}`); // dialog 창 메시지 출력
        if (dialog.type() === 'confirm') {
            await dialog.accept(); // '확인' 버튼 누르기
            console.log('Confirmed!');
        } else {
            await dialog.dismiss(); // 다른 종류의 dialog는 닫기
            console.log('Dialog dismissed!');
        }

        // 이벤트 리스너 제거
        page.off('dialog', dialogHandler);
        console.log('Dialog handler removed!');
    };

    // dialog 이벤트를 핸들링
    page.on('dialog', dialogHandler);




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
            return downloadPath;
        } else {
            console.log('Default Chrome Download Directory 설정이 없습니다.');
            return '';
        }

    } catch (err) {
        console.error('Error reading Chrome Preferences:', err.message);
        return '';
    }
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
    if (isEmpty(data.taxCertificateLocation)) return true;
    if (data.taxCertificateLocation !== '하드디스크' && isEmpty(data.taxCertificatePath)) return true;
    if (isEmpty(data.taxCertificateName)) return true;
    if (isEmpty(data.taxCertificateLocation)) return true;

}

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
module.exports = { runAutomation_homeTax };
