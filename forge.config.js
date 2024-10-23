const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { certPfxPassword } = require("./cert/cert_password.json");
const { buildVersion } = require("./build/version.json");
const path = require('path');
const { GITHUB_DIST_URL } = require("./cert/gh_tokens.json");
const { GH_TOKEN } = require("./cert/gh_tokens.json");
const { GITHUB_TOKEN } = require("./cert/gh_tokens.json");
const { GITHUB_USER } = require("./cert/gh_tokens.json");
// console.log('certPfxPassword:', certPfxPassword);

console.log('buildVersion =', buildVersion);
console.log('icon file path =',path.resolve(__dirname, './assets/iyac_app_logo.ico'));
console.log('GH_TOKEN =', GH_TOKEN);
console.log('GH_TOKEN =', GH_TOKEN);

// 환경 변수에 GH_TOKEN 설정
process.env.GH_TOKEN = GH_TOKEN;
process.env.GITHUB_TOKEN = GITHUB_TOKEN;
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
        setupExe: '아이약_당뇨_' + buildVersion + '_setup.exe',
        //setupIcon: path.resolve(__dirname, './assets/iyac_app_logo.ico'),
        //iconUrl: path.resolve(__dirname, './assets/iyac_app_logo.ico'),
        // loadingGif: './assets/loading.gif',
        noMsi: true,
        setupMsi: '아이약_당뇨.msi',
        // EV 인증서 경로와 비밀번호
        certificateFile: path.resolve(__dirname, './cert/cert.pfx'),
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
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: GITHUB_USER,
          name: GITHUB_DIST_URL,
        },
        prerelease: false,
        draft: false,
      },
    },
  ],
  // postMake hook
  hooks: {
    postMake: async (forgeConfig, options) => {
      const { Octokit } = await import("@octokit/rest"); // 동적 import
      // console.log(`Octokit = ${Octokit}`);
      const tag = `v${buildVersion}`;
      const owner = GITHUB_USER;
      const repo = GITHUB_DIST_URL;

      try {
        const octokit = new Octokit({auth: process.env.GH_TOKEN,})
        // GitHub 릴리스 정보를 가져옴
        const release = await octokit.repos.getReleaseByTag({
          owner,
          repo,
          tag,
        });
        console.log(release.url);
        const releaseUrl = release.data.html_url;
        console.log(`Release available at: ${releaseUrl}`);

        // 릴리스의 다운로드 가능한 파일 목록 출력
        release.data.assets.forEach(asset => {
          console.log(`Download link: ${asset.browser_download_url}`);
        });
      } catch (error) {
        console.error("Failed to fetch release information:", error);
      }
    },


  // postPublish: async (forgeConfig, options) => {
  //   const tag = options.tag || `v${options.packageJSON.version}`;
  //   const releaseUrl = `https://github.com/sjh-hdmedi/DiaCareDist/releases/tag/${tag}`;
  //
  //   // 로그 출력
  //   console.log(`Release available at: ${releaseUrl}`);
  //
  //   // 파일 다운로드 링크 (업로드된 파일이 .exe라고 가정)
  //   options.artifacts.forEach(artifact => {
  //     const fileName = path.basename(artifact);
  //     console.log(`Download link: https://github.com/sjh-hdmedi/DiaCareDist/releases/download/${tag}/${fileName}`);
  //   });
  // },
},
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
