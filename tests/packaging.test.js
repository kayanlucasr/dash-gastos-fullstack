const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const config=require('../electron-builder.cjs');
test('Windows installer preserves user data, targets x64 and includes only application resources',()=>{
  assert.equal(config.productName,'Financeiro');assert.equal(config.executableName,'Financeiro');
  assert.deepEqual(config.win.target,[{target:'nsis',arch:['x64']}]);
  assert.equal(config.nsis.deleteAppDataOnUninstall,false);
  assert.equal(config.nsis.perMachine,false);assert.equal(config.nsis.allowElevation,false);
  assert.equal(config.nsis.createDesktopShortcut,true);assert.equal(config.nsis.createStartMenuShortcut,true);
  assert.equal(config.asar,true);assert.equal(config.npmRebuild,false);assert.equal(config.publish,null);
  for(const entry of ['!**/.env','!**/*.sqlite','!**/backups/**']) assert.ok(config.files.includes(entry));
});
test('Windows ICO contains six complete PNG-backed images with correct dimensions',()=>{
  const bytes=fs.readFileSync(path.resolve(__dirname,'../assets/icons/financeiro.ico'));
  assert.equal(bytes.readUInt16LE(0),0);assert.equal(bytes.readUInt16LE(2),1);assert.equal(bytes.readUInt16LE(4),6);
  let end=6+6*16;
  for(const [i,size] of [16,32,48,64,128,256].entries()) {
    const entry=6+i*16;assert.equal(bytes[entry] || 256,size);assert.equal(bytes[entry+1] || 256,size);
    assert.equal(bytes.readUInt16LE(entry+4),1);assert.equal(bytes.readUInt16LE(entry+6),32);
    const length=bytes.readUInt32LE(entry+8),offset=bytes.readUInt32LE(entry+12);
    assert.equal(offset,end);assert.ok(length>0 && offset+length<=bytes.length);
    assert.equal(bytes.subarray(offset,offset+8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(offset+16),size);assert.equal(bytes.readUInt32BE(offset+20),size);
    end=offset+length;
  }
  assert.equal(end,bytes.length);
});
