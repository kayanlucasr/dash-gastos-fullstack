const db = require('../db');
try {
  db.get();
  console.log('SQLite inicializado e migrations verificadas.');
} catch (error) {
  console.error(error.code || error.message);
  process.exitCode = 1;
} finally {
  db.end();
}
