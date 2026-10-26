const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
function copyTree(source, target) {
  if (fs.statSync(source).isDirectory()) {
    fs.mkdirSync(target, {recursive:true});
    for (const name of fs.readdirSync(source)) copyTree(path.join(source,name),path.join(target,name));
  } else fs.copyFileSync(source,target);
}
const root = path.resolve(__dirname, '..');
(async () => {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-asar-'));
  try {
    const source = path.join(staging, 'source');
    fs.mkdirSync(source);
    console.log('Preparando recursos ASAR');
    for (const entry of ['desktop', 'database/sqlite', 'services', 'repositories', 'middlewares', 'routes', 'controllers', 'validators', 'frontend/dist','assets/icons']) {
      copyTree(path.join(root, entry), path.join(source, entry));
    }
    for (const entry of ['package.json', 'server.js', 'db.js']) fs.copyFileSync(path.join(root, entry), path.join(source, entry));
    // Copy only the transitive production dependency tree; no .env, data or dev tools.
    const copied = new Set();
    function dependency(name, from) {
      let parent = from;
      let file;
      while (true) {
        const candidate = path.join(parent, 'node_modules', name, 'package.json');
        if (fs.existsSync(candidate)) {file=candidate;break;}
        const next = path.dirname(parent);
        if (next === parent) throw new Error('Missing dependency: ' + name);
        parent = next;
      }
      const directory = path.dirname(file);
      const relative = path.relative(path.join(root, 'node_modules'), directory);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Dependency outside workspace: ' + name);
      if (copied.has(directory)) return;
      copied.add(directory);
      copyTree(directory, path.join(source, 'node_modules', relative));
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const child of Object.keys(pkg.dependencies || {})) dependency(child, directory);
    }
    // Express/backend dependencies only; React and Chart.js are bundled by Vite.
    for (const name of ['express','cors','dotenv']) dependency(name, root);
    const archive = path.join(staging, 'app.asar');
    const {createPackageFromFiles} = await import('@electron/asar');
    const entries = fs.readdirSync(source, {recursive:true}).map(entry => path.join(source, entry));
    await createPackageFromFiles(source, archive, entries);
    console.log('Arquivo ASAR temporário criado.');
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/desktop-smoke.cjs')], {
      cwd:root, env:{...process.env, DESKTOP_SMOKE_APP:archive}, stdio:'inherit', windowsHide:true, timeout:180000
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('ASAR smoke failed: ' + result.status);
  } finally {
    const resolved = path.resolve(staging);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('dash-asar-')) throw new Error('Invalid staging cleanup');
    fs.rmSync(resolved, {recursive:true, force:true, maxRetries:3, retryDelay:100});
  }
})().catch(error => {console.error(error); process.exitCode=1;});
