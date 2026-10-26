const db = require('../db');
(async () => {
  try {
    const target = process.argv[2];
    if (!target) throw new Error('Informe um arquivo de destino absoluto e ainda inexistente.');
    await db.backupTo(target);
    console.log('Backup SQLite concluído.');
  } catch (error) {
    console.error(error.code || error.message);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
