const fs = require('fs');
const path = require('path');

// package.json 파일 경로
const packageJsonPath = path.join(__dirname, 'package.json');
const packageLockJsonPath = path.join(__dirname, 'package-lock.json');
// package.json 읽기
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const packageLockJson = JSON.parse(fs.readFileSync(packageLockJsonPath, 'utf8'));

// version을 0.0.01 증가시키는 함수
function bumpVersion(version) {
    const parts = version.split('.').map(Number);
    parts[2] += 1; // 패치 버전 증가
    if (parts[2] >= 100) {
        parts[2] = 0;
        parts[1] += 1; // 마이너 버전 증가
    }
    if (parts[1] >= 100) {
        parts[1] = 0;
        parts[0] += 1; // 메이저 버전 증가
    }
    return parts.join('.');
}

// version 증가
packageJson.version = bumpVersion(packageJson.version);

// packageLockJson 파일의 버전은 packageJson 과 동일하게 처리
packageLockJson.version = packageJson.version;

// package.json 파일에 쓰기
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
fs.writeFileSync(packageLockJsonPath, JSON.stringify(packageLockJson, null, 2));

console.log(`Version bumped to ${packageJson.version}`);
