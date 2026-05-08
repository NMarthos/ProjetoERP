const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');

async function initDb() {
    const db = await open({
        filename: './database/erp.db',
        driver: sqlite3.Database
    });

    // RG02: Multiempresa (Tenants)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            cnpj TEXT UNIQUE,
            config TEXT, -- JSON para RG08
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // RG06: Perfis e Permissões
    await db.exec(`
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            permissions TEXT, -- JSON para RG06
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
    `);

    // RG03: Usuários vinculados a empresa
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            profile_id INTEGER,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (profile_id) REFERENCES profiles(id)
        )
    `);

    // RG07: Log de Auditoria
    await db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            module TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // RG09: Cadastros Básicos - Parceiros
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
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
    `);

    // Rastreabilidade de Indicações
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

    // M1 - Comercial: Orçamentos
    await db.exec(`
        CREATE TABLE IF NOT EXISTS proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            partner_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            value DECIMAL(10, 2) NOT NULL,
            status TEXT DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE', 'APROVADO', 'REJEITADO')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (partner_id) REFERENCES partners(id)
        )
    `);

    // M2 - Fábrica: Ordens de Produção
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

    // Dados Iniciais (Seed)
    const tenantCount = await db.get('SELECT count(*) as count FROM tenants');
    let tenantId = 1;
    if (tenantCount.count === 0) {
        await db.run('INSERT INTO tenants (name, cnpj) VALUES (?, ?)', ['Marcenaria Exemplo', '12.345.678/0001-90']);
    } else {
        const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
        tenantId = tenant.id;
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await db.get('SELECT * FROM users WHERE email = ?', ['admin@exemplo.com.uk']);
    
    if (!adminUser) {
        await db.run('INSERT INTO users (tenant_id, name, email, password) VALUES (?, ?, ?, ?)', 
            [tenantId, 'Admin', 'admin@exemplo.com.uk', hashedPassword]);
        console.log('Usuário admin criado!');
    } else {
        await db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, 'admin@exemplo.com.uk']);
        console.log('Senha do usuário admin atualizada!');
    }

    return db;
}

initDb().catch(console.error);
