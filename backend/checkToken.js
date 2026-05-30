const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'erp.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all('SELECT * FROM proposal_events ORDER BY id DESC LIMIT 5', (err, rows) => {
        if (err) console.error(err);
        else console.log('Latest Events:', rows);
    });
});
