const path = require("path");

// 환경에 따라 엔트리 파일 결정
const isDev = process.env.NODE_ENV === "development";
const entryFile = isDev
  ? path.join(__dirname, "src/index.js")
  : path.join(__dirname, "dist/index.js");

require("electron").app.on("ready", () => {
  require(entryFile);
});