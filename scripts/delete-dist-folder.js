const fs = require("fs");
const path = require("path");

// 삭제하려는 폴더 경로 설정
const distFolderPath =  path.join(__dirname, "../dist");

if (fs.existsSync(distFolderPath)) {
    fs.rmSync(distFolderPath, { recursive: true, force: true });
    console.log(`step1: Folder and all files deleted: ${distFolderPath}`);
} else {
    console.log(`step1: Folder does not exist: ${distFolderPath}`);
}
