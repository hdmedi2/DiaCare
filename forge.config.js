const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { certPfxPassword } = require("./cert/cert_password.json");
const { buildVersion } = require("./build/version.json");

console.log('certPfxPassword:', certPfxPassword);
console.log('buildVersion', buildVersion);


/*
  cert 폴더에 cert_password.json 파일 생성하고, 내용은 { "certPfxPassword": "인증서 비밀번호" } 로 저장할 것.
  cert.pfx 파일과 비밀번호 파일은 git ignore 대상이며, 별도 보관하여 보안 수준을 높이도록 한다.
  2024.10.22 서정현
 */

module.exports = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: 'iyac_diabetes',
        exe: '아이약_당뇨.exe',
        setupExe: '아이약_당뇨_'+ buildVersion +'_setup.exe',
        // setupIcon: './assets/iyac_app_logo.ico',
        // iconUrl: 'assets/iyac_app_logo.ico',
        // loadingGif: './assets/loading.gif',
        noMsi: true,
        setupMsi: '아이약_당뇨.msi',
        // EV 인증서 경로와 비밀번호
        certificateFile: './cert/cert.pfx',
        certificatePassword: certPfxPassword,
        // 관리자 권한 실행을 요구하는 설정
        requestedExecutionLevel: 'requireAdministrator',
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-deb",
      config: {},
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
