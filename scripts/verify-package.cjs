const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createRequire}=require('node:module');
const builderRequire=createRequire(require.resolve('app-builder-lib/package.json'));
const ResEdit=builderRequire('resedit');
const pe=createRequire(builderRequire.resolve('resedit'))('pe-library');
const root=path.resolve(__dirname,'..'),output=path.join(root,'dist-installer');
const version=require('../package.json').version;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function verifyIcon(file,source) {
  const bytes=fs.readFileSync(file);
  const resource=pe.NtExecutableResource.from(pe.NtExecutable.from(bytes));
  const groups=ResEdit.Resource.IconGroupEntry.fromEntries(resource.entries);
  const match=groups.find(group=>group.icons.length===6 && group.icons.every((icon,index)=>{
    const entry=resource.entries.find(row=>row.type===3 && row.id===icon.iconID && row.lang===group.lang);
    const sourceEntry=6+index*16;
    const offset=source.readUInt32LE(sourceEntry+12),size=source.readUInt32LE(sourceEntry+8);
    return entry && (icon.width || 256)===[16,32,48,64,128,256][index] && sha(Buffer.from(entry.bin))===sha(source.subarray(offset,offset+size));
  }));
  assert.ok(match,'Custom six-resolution icon not embedded: '+path.basename(file));
  return bytes;
}
(async()=>{
  const asar=await import('@electron/asar');
  const archive=path.join(output,'win-unpacked/resources/app.asar');
  const entries=asar.listPackage(archive);
  const rejected=entries.filter(file=>/(^|[\\/])(\.env(?:\.|$)|backups|tests|postgres|vite|electron-builder)([\\/]|$)|\.(sqlite|db|log|node)$/.test(file));
  assert.deepEqual(rejected,[],'Private/development/native-addon files in package');
  for(const required of ['desktop/main.cjs','desktop/preload.cjs','desktop/backend.cjs','frontend/dist/index.html','database/sqlite/migrations/001_initial.sql','database/sqlite/migrations/002_planning_items.sql','assets/icons/financeiro.ico']) assert.ok(asar.statFile(archive,path.normalize(required)));
  const html=asar.extractFile(archive,path.normalize('frontend/dist/index.html')).toString();
  const assets=entries.filter(file=>/[\\/]frontend[\\/]dist[\\/]assets[\\/]/.test(file));
  assert.ok(assets.every(file=>html.includes(path.basename(file))),'Stale frontend assets in installer');
  const icon=fs.readFileSync(path.join(root,'assets/icons/financeiro.ico'));
  const executable=verifyIcon(path.join(output,'win-unpacked/Financeiro.exe'),icon);
  assert.equal(executable.readUInt16LE(executable.readUInt32LE(0x3c)+4),0x8664,'Executable must be Windows x64');
  assert.equal(executable.readUInt16LE(executable.readUInt32LE(0x3c)+4+20+68),2,'Application must use the GUI subsystem');
  const installerName='Financeiro-Setup-'+version+'.exe';
  const installer=verifyIcon(path.join(output,installerName),icon);
  assert.equal(installer.readUInt16LE(installer.readUInt32LE(0x3c)+4+20+68),2,'Installer must use the GUI subsystem');
  const checksum=sha(installer);
  fs.writeFileSync(path.join(output,installerName+'.sha256'),checksum+' *'+installerName+'\n');
  const report={version,architecture:'x64',guiSubsystem:true,entries:entries.length,privateFiles:rejected,executableIcon:true,installerIcon:true,installer:installerName,bytes:installer.length,sha256:checksum};
  fs.writeFileSync(path.join(output,'package-verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
