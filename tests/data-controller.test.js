const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createDataController,authorized}=require('../desktop/data-controller.cjs');
test('native dialogs control all paths and restoration requires an explicit confirmation',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dash-controller-test-'));
  try {
    const commands=[];let choice=0,cancelFile=false;
    const controller=createDataController({metadata:path.join(folder,'last.json'),getWindow:()=>({}),dialog:{
      async showOpenDialog(){return {canceled:cancelFile,filePaths:['selected.sqlite']};},
      async showMessageBox(_window,options){assert.equal(options.defaultId,0);assert.equal(options.cancelId,0);return {response:choice};},
      async showSaveDialog(){return {canceled:false,filePath:'selected-destination.sqlite'};}
    },request:async(command,file)=>{commands.push([command,file]);return {at:'2026-10-26T12:00:00.000Z'};}});
    assert.equal((await controller.perform('status')).lastBackup,null);
    assert.equal((await controller.perform('restore')).cancelled,true);
    assert.deepEqual(commands.map(row=>row[0]),['prepare','cancel']);commands.length=0;
    cancelFile=true;await controller.perform('restore');assert.deepEqual(commands,[]);
    cancelFile=false;choice=1;
    assert.equal((await controller.perform('restore')).restored,true);
    assert.deepEqual(commands.map(row=>row[0]),['prepare','restore']);commands.length=0;
    assert.equal((await controller.perform('backup')).ok,true);
    assert.deepEqual(commands,[['backup','selected-destination.sqlite']]);
    assert.equal((await controller.perform('status')).lastBackup,'2026-10-26T12:00:00.000Z');
  } finally {assert.equal(path.dirname(folder),os.tmpdir());fs.rmSync(folder,{recursive:true,force:true});}
});
test('validation errors prevent confirmation, return safe messages and concurrent operations are refused',async()=>{
  let release,confirmations=0;
  const controller=createDataController({metadata:'unused',getWindow:()=>({}),dialog:{
    async showOpenDialog(){return {filePaths:['invalid']};},
    async showMessageBox(){confirmations++;return {response:1};},
    showSaveDialog(){return new Promise(resolve=>{release=()=>resolve({canceled:true});});}
  },request:async()=>{throw Object.assign(new Error('sensitive technical detail'),{code:'BACKUP_INVALID'});}});
  const failure=await controller.perform('restore');assert.equal(failure.ok,false);assert.equal(confirmations,0);assert.ok(!failure.message.includes('sensitive'));
  const first=controller.perform('backup');assert.equal((await controller.perform('restore')).ok,false);release();assert.equal((await first).cancelled,true);
});
test('IPC authorization rejects subframes, other contents and remote origins',()=>{
  const frame={url:'http://127.0.0.1:3210/'};
  const contents={isDestroyed:()=>false,mainFrame:frame};
  const event={sender:contents,senderFrame:frame};
  assert.equal(authorized(event,contents,'http://127.0.0.1:3210'),true);
  assert.equal(authorized({...event,senderFrame:{url:frame.url}},contents,'http://127.0.0.1:3210'),false);
  assert.equal(authorized({...event,sender:{}},contents,'http://127.0.0.1:3210'),false);
  assert.equal(authorized(event,contents,'https://external.example'),false);
});
