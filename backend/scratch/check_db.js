const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function check() {
    const db = await open({
        filename: './database/erp.db',
        driver: sqlite3.Database
    });
    const info = await db.all("PRAGMA table_info(partners)");
    console.log(JSON.stringify(info, null, 2));
    await db.close();
}
check();
