const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const electronVersion=fs.readFileSync(path.join(root,'node_modules/electron/dist/version'),'utf8').trim();
if(electronVersion!==require('../package.json').devDependencies.electron) throw new Error('Installed Electron runtime differs from pinned version');
for(const file of ['frontend/dist/index.html','desktop/main.cjs','desktop/preload.cjs','desktop/backend.cjs','assets/icons/financeiro.ico','database/sqlite/migrations/001_initial.sql','database/sqlite/migrations/002_planning_items.sql']) {
  if(!fs.statSync(path.join(root,file)).isFile()) throw new Error('Missing required build resource: '+file);
}
const icon=fs.readFileSync(path.join(root,'assets/icons/financeiro.ico'));
if(icon.readUInt16LE(0)!==0 || icon.readUInt16LE(2)!==1 || icon.readUInt16LE(4)!==6) throw new Error('Invalid Windows ICO');
for(let i=0;i<6;i++) {
  const size=icon[6+16*i] || 256;
  if(size!==[16,32,48,64,128,256][i]) throw new Error('Missing icon resolution');
}
console.log('Electron main/preload/backend, React, migrations and ICO ready for Windows x64.');
