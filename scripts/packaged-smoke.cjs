const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const executable=path.resolve(process.argv[2] || path.join(root,'dist-installer/win-unpacked/Financeiro.exe'));
if(!require('node:fs').statSync(executable).isFile()) throw new Error('Financeiro.exe not found');
const result=spawnSync(process.execPath,[path.join(__dirname,'desktop-smoke.cjs')],{
  cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,DESKTOP_SMOKE_EXE:executable}
});
if(result.error) throw result.error;
process.exitCode=result.status===0 ? 0 : 1;
