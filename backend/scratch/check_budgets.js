const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function check() {
    const db = await open({
        filename: './backend/database/erp.db',
        driver: sqlite3.Database
    });
    const proposals = await db.all("SELECT id, description, budget_data FROM proposals");
    console.log(JSON.stringify(proposals, null, 2));
    await db.close();
}

check().catch(console.error);
