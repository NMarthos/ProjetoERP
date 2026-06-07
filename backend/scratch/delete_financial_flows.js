const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function clearFinancialFlows() {
    const db = await open({
        filename: './database/erp.db',
        driver: sqlite3.Database
    });
    console.log("Conectado ao banco de dados.");
    const result = await db.run("DELETE FROM financial_flows");
    console.log("Resultado da deleção:", result);
    await db.close();
}

clearFinancialFlows().catch(console.error);
