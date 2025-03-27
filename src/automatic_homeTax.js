const { chromium } = require("playwright");
const fs = require("fs");
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
let userFileDirectory;
let userHomeTaxDirectory = "";
let result = "";

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
            console.log("file1",userHomeTaxDirectory)
            console.log("file2",data.hometaxFileSignedUrl)
            console.log("file3",data.hometaxFileName)

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

    await page.addInitScript(() => {
        window.open = () => {
            console.log('pop close');
            return null;
        };
    });
    await page.goto(HOMETAX_URL);


    await page.waitForLoadState("domcontentloaded");

    await page.locator('#mf_wfHeader_group1503').waitFor({state: 'visible'});

    // 3-5. 전자세금계산서 발행 메뉴 찾아가기
    await page.waitForTimeout(2000)
    await page.click('#mf_wfHeader_group1503');
    //

    await page.waitForTimeout(2000)
    await page.click('#mf_txppWframe_anchor22');
    await page.waitForLoadState("domcontentloaded");

    let r = false;

    // 인증서 로그인 시도
    r = await certSign(page, data.taxCertificateName, data.taxCertificatePassword);
    await page.goto("https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=46&tm2lIdx=4601010000&tm3lIdx=4601010500")
    await page.waitForLoadState("domcontentloaded", {timeout:8000});

    await page.waitForSelector('#mf_txppWframe_filename');
    const fileInput = await page.locator("#mf_txppWframe_filename");

    if (await fileInput.count() > 0) {
        console.log("파일 선택창 찾음");
        // 파일 경로를 강제로 설정
        try {
            let isXlsFound = fs.existsSync(path.join(userHomeTaxDirectory, data.hometaxFileName));
            if (isXlsFound) {
                await fileInput.setInputFiles(path.join(userHomeTaxDirectory, data.hometaxFileName)); // data.hometaxFileName
                // await fileInput.setInputFiles(path.join(userHomeTaxDirectory, "hometax_1341579686_20250107233835.xlsx"));
                await page.waitForTimeout(8000);
                // 파일 경로 지정
                console.log(`${path.join(userHomeTaxDirectory, data.hometaxFileName)} file loaded `);
            } // data.hometaxFileName
            else {
                console.log(`${path.join(userHomeTaxDirectory, data.hometaxFileName)} not found...`)
            }
        } catch (e) {
            console.error(`업로드할 세금계산서 파일 찾는 중 오류 발생: ${e.message}`);

        }

        // 엑셀 전환버튼 클릭
        const convertBtn = await page.locator("#mf_txppWframe_trigger37");
        await convertBtn.click(); // 엑셀 변환버튼 클릭
        console.log("excel convert button clicked");
    } else {
        console.log("파일 선택창 못찾음");
    }

    // mf_txppWframe_UTEETBAA77 오류 레이어팝업 뜨는 div
    // mf_txppWframe_UTEETBAA77_wframe_trigger20 [확인]

        const btnBndlEtxivIsnAllTop = await page.locator("#mf_txppWframe_group3219");
        if (await btnBndlEtxivIsnAllTop.count()>0) {
            // dialog 이벤트 핸들러
            const dialogHandler = async (dialog) => {
                console.debug(`Dialog message: ${dialog.message()}`); // dialog 창 메시지 출력
                const msg = dialog.message();
                if (dialog.type() === 'confirm'
                    && msg.startsWith('전자세금계산서를 일괄발급하시겠습니까?') === true) {
                    await page.waitForTimeout(5000);
                    await dialog.accept(); // '확인' 버튼 누르기
                    console.log("일괄발급 확인 확인창 제대로 닫힘");
                    result = "ok";
                } else {
                    await page.waitForTimeout(5000);
                    await dialog.dismiss(); // 다른 종류의 dialog는 닫기
                    console.log('그 외의 Dialog! 닫음');
                    result = "stop";
                }

                // 이벤트 리스너 제거
                page.off('dialog', dialogHandler);
                console.log('Dialog handler removed!');
            };

            // dialog 이벤트를 핸들링
            page.on('dialog', dialogHandler);
            // 일괄발급(50건) 버튼 클릭
            await btnBndlEtxivIsnAllTop.click();
            console.log("일괄신고 버튼 클릭");

            // 패스워드 전송까지 하면 완료
            await certSign(page, data.taxCertificateName, data.taxCertificatePassword);

            log.info("전자세금계산서 일괄발급 완료");
        }
        else {
            console.log("일괄 신고 버튼 찾지 못함");
        }

    // 최종적으로 확인을 위해서 브라우저는 닫지 않는다.
    // await browser.close();
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
        if (value.trim() === "") return Boolean(true);
        else return Boolean(false);
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
/*
function isEmptyCertificationInfo(data) {
    if (isEmpty(data.taxCertificateLocation)) return true;
    if (data.taxCertificateLocation !== '하드디스크' && isEmpty(data.taxCertificatePath)) return true;
    if (isEmpty(data.taxCertificateName)) return true;
    if (isEmpty(data.taxCertificateLocation)) return true;

}
*/

async  function certSign(page, certName, certPassword) {
    // 3-3 인증서 팝업창 선택
    const frame = await page.frameLocator('#dscert');
    try {
        await page.waitForTimeout(3000);
        await frame.locator("#wrap_stg_01");
    }
    catch(e){
        console.error(e.message);
    }
    const strSlide = await frame.locator("#wrap_stg_01");
    
    // 테이블이 존재하는지 확인
    if (await strSlide.count() > 0) {
        console.log('certificate list found...');
    } else {
        console.log('certificate list not found...');
    }

    if (certName!=="" && certName!==undefined) {
        try {
            const nButton = await frame
                .getByRole("row", {name: certName})
                .getByText(certName)
                .dblclick();
        } catch (e) {
            console.log(`세금계산서용 인증서의 이름이 정확한지 확인하세요: "${certName}"`);
            return false;
        }
    }

    await frame.locator("#input_cert_pw").click(); // 인증서 암호란 클릭
    // await page.keyboard.type(certPassword, {delay:30}); // 인증서 암호 채우기 //

    // 확인 버튼 눌러서 로그인ㄹㄹ
    if (certName!=="" && certName!==undefined) {
        await page.keyboard.type(certPassword, {delay:30}); // 인증서 암호 채우기 //
        await frame
            .getByRole("button", {name: "확인"}).click();
    }
    await page.waitForTimeout(2000)

}

module.exports = { runAutomation_homeTax };
