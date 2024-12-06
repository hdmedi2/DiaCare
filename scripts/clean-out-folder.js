const fs = require("fs");
const path = require("path");

// 삭제하려는 폴더 경로 설정
const outFolder = path.join(__dirname, "../out");

// 폴더 삭제
if (fs.existsSync(outFolder)) {
    fs.rmSync(outFolder, { recursive: true, force: true });
    console.log(`step2: Folder and all files deleted: ${outFolder}`);
} else {
    console.log(`step2: Folder does not exist: ${outFolder}`);
}

