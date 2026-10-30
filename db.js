// Basit JSON dosya veritabanı. Küçük ölçekli kullanım için yeterli;
// büyüdükçe SQLite/Postgres'e geçilmeli.
const fs = require('fs');
const path = require('path');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'db.json');
const empty = { users: {}, sessions: {}, conversations: {} };

function load() {
  try {
    return { ...empty, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } catch {
    return structuredClone(empty);
  }
}

const db = {
  data: load(),
  save() {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db.data, null, 2));
    fs.renameSync(tmp, DB_FILE);
  },
};

module.exports = db;
