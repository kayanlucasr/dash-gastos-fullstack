const fs=require('node:fs');
const path=require('node:path');
const frontend=path.resolve(__dirname,'../frontend');
const output=path.join(frontend,'dist');
if(fs.existsSync(output)) {
  // Delete only this verified generated directory; never traverse a redirected target.
  if(fs.lstatSync(output).isSymbolicLink() || fs.realpathSync(output)!==path.join(fs.realpathSync(frontend),'dist')) throw new Error('Refusing redirected frontend output');
  const entries=fs.readdirSync(output,{recursive:true});
  if(entries.some(file=>/(^|[\\/])\.git([\\/]|$)|\.(sqlite|db)(-|$)/i.test(file))) throw new Error('Unexpected data or repository in frontend output; preserved');
  // Node 24.13 on this Windows host silently leaves non-ASCII recursive rm
  // targets intact. Individual unlink/rmdir calls work and are checked below.
  function removeGenerated(entry) {
    const stat=fs.lstatSync(entry);
    if(stat.isDirectory() && !stat.isSymbolicLink()) {
      for(const child of fs.readdirSync(entry)) removeGenerated(path.join(entry,child));
      fs.rmdirSync(entry);
    } else fs.unlinkSync(entry);
  }
  removeGenerated(output);
  if(fs.existsSync(output)) throw new Error('Frontend output was not cleaned');
}
