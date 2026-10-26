const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const {
  desktopConfig
} = require('../desktop/config.cjs');
test('development uses Vite only when explicitly requested outside packaged builds', () => {
  assert.equal(desktopConfig({
    packaged: false,
    argv: ['--desktop-dev']
  }).development, true);
  assert.equal(desktopConfig({
    packaged: false,
    argv: []
  }).development, false);
  assert.equal(desktopConfig({
    packaged: true,
    argv: ['--desktop-dev']
  }).development, false);
});
test('desktop window supports resizing and does not require a custom icon', () => {
  const config = desktopConfig({
    packaged: false,
    argv: []
  });
  assert.equal(config.window.maximizable, true);
  assert.equal(config.window.minimizable, true);
  assert.equal(config.window.resizable, true);
  assert.ok(config.window.width >= config.window.minWidth);
  assert.ok(config.window.height >= config.window.minHeight);
  assert.ok(config.dist.endsWith('dist'));
});

test('packaged backend uses a physical resource directory outside ASAR', () => {
  const config = desktopConfig({packaged:true, resourcesPath:'C:/app/resources', sourceRoot:'C:/app/resources/app.asar'});
  assert.equal(config.workingDirectory, 'C:/app/resources');
  assert.equal(config.root, 'C:/app/resources/app.asar');
  assert.ok(config.dist.includes('app.asar'));
});
