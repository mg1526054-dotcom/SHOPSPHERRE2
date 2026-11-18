// Deletes the database so it is re-created with fresh sample data on next start.
const fs = require('fs'), path = require('path');
for (const f of ['online_shopping.db', 'online_shopping.db-wal', 'online_shopping.db-shm']) {
  try { fs.unlinkSync(path.join(__dirname, f)); } catch {}
}
console.log('Database removed. Run "npm start" to create a fresh one.');
