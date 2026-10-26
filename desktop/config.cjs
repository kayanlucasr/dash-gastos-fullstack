const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
function desktopConfig({
  packaged,
  argv = process.argv,
  resourcesPath = process.resourcesPath,
  sourceRoot = root
} = {}) {
  const development = !packaged && argv.includes('--desktop-dev');
  const icon = path.join(sourceRoot, 'assets', 'icons', 'financeiro.ico');
  return {
    development,
    root: sourceRoot,
    workingDirectory: packaged ? resourcesPath : (sourceRoot.endsWith('.asar') ? path.dirname(sourceRoot) : sourceRoot),
    frontend: path.join(sourceRoot, 'frontend'),
    dist: path.join(sourceRoot, 'frontend/dist'),
    window: {
      width: 1280,
      height: 900,
      minWidth: 720,
      minHeight: 560,
      maximizable: true,
      minimizable: true,
      resizable: true,
      title: development ? 'Financeiro — Desenvolvimento' : 'Financeiro',
      ...(fs.existsSync(icon) ? {
        icon
      } : {})
    }
  };
}
module.exports = {
  desktopConfig
};
