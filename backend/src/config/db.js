const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function getDbConnection() {
    return open({
        filename: './database/erp.db',
        driver: sqlite3.Database
    });
}

async function initializeDatabase(db) {
    // Tenants (RG02)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            cnpj TEXT UNIQUE,
            config TEXT,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Partners (M0)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS partners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT CHECK(type IN ('CLIENTE', 'ARQUITETO', 'CORRETOR', 'FORNECEDOR', 'OUTROS')),
            document TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            address_num TEXT,
            address_complement TEXT,
            address_cep TEXT,
            address_city TEXT,
            address_neighborhood TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
    `);

    // Migration for address_neighborhood
    try {
        await db.exec('ALTER TABLE partners ADD COLUMN address_neighborhood TEXT');
    } catch (e) { /* Column probably exists */ }

    // Proposals (M1)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            partner_id INTEGER NOT NULL,
            user_id INTEGER,
            description TEXT NOT NULL,
            value DECIMAL(10, 2) DEFAULT 0,
            status TEXT DEFAULT 'ABERTO' CHECK(status IN ('ABERTO', 'APROVADO', 'REJEITADO', 'PENDENTE')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (partner_id) REFERENCES partners(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Production Orders (M2)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS production_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            proposal_id INTEGER NOT NULL,
            status TEXT DEFAULT 'AGUARDANDO' CHECK(status IN ('AGUARDANDO', 'EM_PRODUCAO', 'FINALIZADO', 'ENTREGUE')),
            priority TEXT DEFAULT 'MEDIA' CHECK(priority IN ('BAIXA', 'MEDIA', 'ALTA')),
            start_date DATETIME,
            end_date DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (proposal_id) REFERENCES proposals(id)
        )
    `);

    // Audit Logs (RG07)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            module TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
    `);

    // Referrals
    await db.exec(`
        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            client_id INTEGER NOT NULL,
            referrer_id INTEGER NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (client_id) REFERENCES partners(id),
            FOREIGN KEY (referrer_id) REFERENCES partners(id)
        )
    `);

    // Users (RG03)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
    `);

    // Manufacturers (Fabricantes)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS manufacturers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            contact TEXT,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
    `);

    // Products (Produtos e Serviços)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            manufacturer_id INTEGER,
            name TEXT NOT NULL,
            unit TEXT CHECK(unit IN ('CHP', 'UN', 'M', 'M2', 'L', 'CXA', 'PAR', 'H', 'DIA', 'PC')),
            value DECIMAL(10, 2) DEFAULT 0,
            photo TEXT,
            status INTEGER DEFAULT 1, -- 1: Ativo, 0: Desativado
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id)
        )
    `);

    // Migração removida para evitar lock no banco de dados.

    // Migração: Atualizar CHECK constraint da tabela products para incluir 'PC'
    try {
        await db.exec(`
            BEGIN TRANSACTION;
            CREATE TABLE products_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                manufacturer_id INTEGER,
                name TEXT NOT NULL,
                unit TEXT CHECK(unit IN ('CHP', 'UN', 'M', 'M2', 'L', 'CXA', 'PAR', 'H', 'DIA', 'PC')),
                value DECIMAL(10, 2) DEFAULT 0,
                photo TEXT,
                status INTEGER DEFAULT 1,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id),
                FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id)
            );
            
            INSERT INTO products_new (id, tenant_id, manufacturer_id, name, unit, value, photo, status, updated_at, created_at)
            SELECT id, tenant_id, manufacturer_id, name, unit, value, photo, status, updated_at, created_at FROM products;
            
            DROP TABLE products;
            ALTER TABLE products_new RENAME TO products;
            COMMIT;
        `);
        console.log('[MIGRAÇÃO] Tabela products atualizada com sucesso (unidade PC).');
    } catch (e) {
        try { await db.exec('ROLLBACK;'); } catch(err) {}
    }

    // Migração: Atualizar CHECK constraint da tabela proposals
    try {
        await db.exec(`
            BEGIN TRANSACTION;
            CREATE TABLE proposals_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                partner_id INTEGER NOT NULL,
                description TEXT NOT NULL,
                value DECIMAL(10, 2) DEFAULT 0,
                status TEXT DEFAULT 'ABERTO' CHECK(status IN ('ABERTO', 'APROVADO', 'REJEITADO', 'PENDENTE')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id),
                FOREIGN KEY (partner_id) REFERENCES partners(id)
            );
            
            INSERT INTO proposals_new (id, tenant_id, partner_id, description, value, status, created_at)
            SELECT id, tenant_id, partner_id, description, value, status, created_at FROM proposals;
            
            DROP TABLE proposals;
            ALTER TABLE proposals_new RENAME TO proposals;
            COMMIT;
        `);
        console.log('[MIGRAÇÃO] Tabela proposals atualizada com sucesso.');
    } catch (e) {
        try { await db.exec('ROLLBACK;'); } catch(err) {}
    }

    const migrations = [
        'ALTER TABLE partners ADD COLUMN address_num TEXT',
        'ALTER TABLE partners ADD COLUMN address_complement TEXT',
        'ALTER TABLE partners ADD COLUMN address_cep TEXT',
        'ALTER TABLE partners ADD COLUMN address_city TEXT',
        'ALTER TABLE partners ADD COLUMN address_neighborhood TEXT',
        'ALTER TABLE partners ADD COLUMN notes TEXT',
        'ALTER TABLE proposals ADD COLUMN value DECIMAL(10, 2) DEFAULT 0',
        'ALTER TABLE proposals ADD COLUMN status TEXT DEFAULT "ABERTO"',
        'ALTER TABLE proposals ADD COLUMN user_id INTEGER',
        'ALTER TABLE proposals ADD COLUMN phase TEXT DEFAULT "1-Comercial"',
        'ALTER TABLE proposals ADD COLUMN phase_date DATETIME DEFAULT CURRENT_TIMESTAMP',
        'ALTER TABLE proposals ADD COLUMN budget_data TEXT',
        'ALTER TABLE production_orders ADD COLUMN priority TEXT DEFAULT "MEDIA"',
        'ALTER TABLE production_orders ADD COLUMN start_date DATETIME',
        'ALTER TABLE production_orders ADD COLUMN end_date DATETIME',
        'ALTER TABLE users ADD COLUMN role TEXT DEFAULT "USER"'
    ];

    for (const m of migrations) {
        try { await db.run(m); } catch (e) { /* Coluna já existe */ }
    }
    
    // History Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS proposal_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            proposal_id INTEGER NOT NULL,
            old_phase TEXT,
            new_phase TEXT NOT NULL,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (proposal_id) REFERENCES proposals(id)
        )
    `);

    // Events Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS proposal_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            proposal_id INTEGER NOT NULL,
            event_date TEXT NOT NULL,
            event_time TEXT NOT NULL,
            description TEXT NOT NULL,
            monitor INTEGER DEFAULT 0,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (proposal_id) REFERENCES proposals(id)
        )
    `);
    
    // Atualiza usuários antigos para admin por segurança
    try { await db.run('UPDATE users SET role = "ADMIN" WHERE role = "USER" OR role IS NULL'); } catch(e) {}
}

module.exports = { getDbConnection, initializeDatabase };
