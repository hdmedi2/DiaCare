const fs = require("fs");
const path = require("path");

// 삭제하려는 폴더 경로 설정
const relaseFolderPath = path.join(__dirname, "../release");

// 폴더 삭제
if (fs.existsSync(relaseFolderPath)) {
    fs.rmSync(relaseFolderPath, { recursive: true, force: true });
    console.log(`step2: Folder and all files deleted: ${relaseFolderPath}`);
} else {
    console.log(`step2: Folder does not exist: ${relaseFolderPath}`);
}

