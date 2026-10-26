const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const id=randomUUID(),root=path.resolve(__dirname,'..');
const folder=path.join(root,'dist-installer','validation-'+id);
for(const version of ['0.9.9','1.0.0']) {
  const result=spawnSync(process.execPath,[require.resolve('electron-builder/out/cli/cli.js'),'--config',path.join(__dirname,'validation-builder.cjs'),'--win','nsis','--x64','--publish','never'],{
    cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,FINANCEIRO_VALIDATION_ID:id,FINANCEIRO_VALIDATION_VERSION:version}
  });
  if(result.error) throw result.error;
  if(result.status!==0) throw new Error('Validation installer build failed: '+version);
}
const manifest={id,name:'Financeiro Validacao '+id.slice(0,8),folder,versions:['0.9.9','1.0.0'],baseline:'Controlled pre-release version of the same source/schema; not a historical published release'};
fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
fs.mkdirSync(path.join(root,'backups/phase8'),{recursive:true});
fs.writeFileSync(path.join(root,'backups/phase8/validation-manifest.json'),JSON.stringify(manifest,null,2));
console.log('Isolated validation installers: '+folder);
