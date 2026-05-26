const { getDbConnection } = require('./src/config/db');

async function checkGroups() {
    console.log('[TEST] Connecting to database...');
    const db = await getDbConnection();
    try {
        console.log('[TEST] Querying distinct group names from products table...');
        const rows = await db.all("SELECT DISTINCT group_name FROM products ORDER BY group_name ASC");
        console.log('[PASS] Distinct group names found in database:', rows.map(r => r.group_name));

        const invalidGroups = rows.filter(r => !['Mdf', 'Fita', 'Ferragem', 'Quimicos', 'Acabamento', 'Servico', 'Outros'].includes(r.group_name));
        if (invalidGroups.length === 0) {
            console.log('[SUCCESS] All products have valid group names!');
            process.exit(0);
        } else {
            console.error('[FAIL] Found invalid group names in database:', invalidGroups.map(r => r.group_name));
            process.exit(1);
        }
    } catch (err) {
        console.error('[ERROR] Verification failed:', err);
        process.exit(1);
    }
}

checkGroups();
