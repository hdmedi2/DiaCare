const path = require('path');
const { execSync } = require('child_process');

const rceditPath = path.resolve(__dirname, '../node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');

module.exports = async function afterPack(context) {
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const manifestPath = path.resolve(__dirname, '../app.manifest');

  console.log(`Adding manifest to ${exePath}`);

  try {
    execSync(`"${rceditPath}" "${exePath}" --application-manifest "${manifestPath}"`);
    console.log('Manifest added successfully!');
  } catch (error) {
    console.error('Failed to add manifest:', error);
  }
};