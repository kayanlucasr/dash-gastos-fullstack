const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const diagnostics=require('../services/diagnostics.cjs');
test('local logs rotate, exclude sensitive fields and logging failures do not affect operations',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dash-logs-test-'));
  try {
    diagnostics.configure(folder);
    diagnostics.log('BACKUP_FAILED',{code:'ENOSPC',message:'secret amount 123.45',sql:'SELECT sensitive',token:'secret',cause:{code:'EIO',message:'private path'}});
    const file=path.join(folder,'application.log');let text=fs.readFileSync(file,'utf8');
    assert.ok(text.includes('ENOSPC'));assert.ok(text.includes('EIO'));
    for(const secret of ['123.45','sensitive','secret','private']) assert.ok(!text.includes(secret));
    fs.writeFileSync(file,'x'.repeat(512*1024));diagnostics.log('TEST');
    assert.equal(fs.statSync(file+'.1').size,512*1024);assert.ok(fs.statSync(file).size<1024);
    diagnostics.configure(file);assert.doesNotThrow(()=>diagnostics.log('TEST'));
  } finally {diagnostics.configure(undefined);assert.equal(path.dirname(folder),os.tmpdir());fs.rmSync(folder,{recursive:true,force:true});}
});
