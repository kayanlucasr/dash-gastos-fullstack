const fs = require('node:fs');
const path = require('node:path');
let directory;
function configure(folder) { directory = folder; }
function log(event, error) {
  if (!directory) return;
  // Allowlisted metadata only: never serialize errors, requests, SQL or paths.
  const code = value => typeof value === 'string' && /^[A-Z0-9_]{1,80}$/.test(value) ? value : undefined;
  try {
    fs.mkdirSync(directory, {recursive:true});
    const file = path.join(directory, 'application.log');
    if (fs.existsSync(file) && fs.statSync(file).size >= 512 * 1024) {
      fs.rmSync(file + '.1', {force:true}); fs.renameSync(file, file + '.1');
    }
    fs.appendFileSync(file, JSON.stringify({at:new Date().toISOString(),event:code(event) || 'ERROR',code:code(error?.code),cause:code(error?.cause?.code),sqlite:Number.isInteger(error?.errcode) ? error.errcode : undefined}) + '\n');
  } catch { /* Diagnostics must not interrupt data operations. */ }
}
module.exports = {configure,log};
