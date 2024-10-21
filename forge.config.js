const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

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
        setupExe: '아이약_당뇨_setup.exe',
        setupIcon: './assets/icon.ico',
        // 권리자 권한으로 실행하도록 설정
        iconUrl: './assets/icon.ico',
        loadingGif: './assets/loading.gif',
        noMsi: true,
        setupMsi: '아이약_당뇨.msi',
        // EV 인증서 경로와 비밀번호
        // certificateFile: './path-to-your-cert.pfx',
        // certificatePassword: 'dlwjddml@hdmedi',
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
