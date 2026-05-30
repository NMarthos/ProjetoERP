const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function getDbConnection() {
    const db = await open({
        filename: './database/erp.db',
        driver: sqlite3.Database
    });
    // Otimização de performance: modo WAL
    await db.exec('PRAGMA journal_mode = WAL');
    await db.exec('PRAGMA synchronous = NORMAL');
    return db;
}

async function initializeDatabase(db) {
    console.log('[DB] Iniciando inicialização/migração do banco de dados...');
    // Tenants (RG02)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            cnpj TEXT UNIQUE,
            logo_url TEXT,
            website TEXT,
            instagram TEXT,
            phone TEXT,
            address_cep TEXT,
            address TEXT,
            address_num TEXT,
            address_complement TEXT,
            address_neighborhood TEXT,
            address_city TEXT,
            address_state TEXT,
            config TEXT,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Migração: Adicionar logo_url se não existir
    try {
        const columns = await db.all("PRAGMA table_info(tenants)");
        if (!columns.find(c => c.name === 'logo_url')) {
            await db.run("ALTER TABLE tenants ADD COLUMN logo_url TEXT");
            console.log('[MIGRAÇÃO] Coluna logo_url adicionada à tabela tenants.');
        }
    } catch(e) {}

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
            phone TEXT,
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
            unit TEXT CHECK(unit IN ('CHP', 'UN', 'M', 'M2', 'L', 'CXA', 'PAR', 'H', 'DIA', 'PC', 'DF', 'DM')),
            value DECIMAL(10, 2) DEFAULT 0,
            photo TEXT,
            status INTEGER DEFAULT 1, -- 1: Ativo, 0: Desativado
            group_name TEXT DEFAULT 'Outros',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id)
        )
    `);

    // Migração removida para evitar lock no banco de dados.

    // Migração: Atualizar CHECK constraint da tabela products para incluir 'PC'
    try {
        const tableSqlRow = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'");
        const needsPcMigration = tableSqlRow && !tableSqlRow.sql.includes("'PC'");
        if (needsPcMigration) {
            console.log('[MIGRAÇÃO] Executando migração de unidade PC na tabela products...');
            await db.exec(`
                BEGIN TRANSACTION;
                CREATE TABLE products_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tenant_id INTEGER NOT NULL,
                    manufacturer_id INTEGER,
                    name TEXT NOT NULL,
                    unit TEXT CHECK(unit IN ('CHP', 'UN', 'M', 'M2', 'L', 'CXA', 'PAR', 'H', 'DIA', 'PC', 'DF', 'DM')),
                    value DECIMAL(10, 2) DEFAULT 0,
                    photo TEXT,
                    status INTEGER DEFAULT 1,
                    group_name TEXT DEFAULT 'Outros',
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
                    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id)
                );
                
                INSERT INTO products_new (id, tenant_id, manufacturer_id, name, unit, value, photo, status, group_name, updated_at, created_at)
                SELECT id, tenant_id, manufacturer_id, name, unit, value, photo, status, group_name, updated_at, created_at FROM products;
                
                DROP TABLE products;
                ALTER TABLE products_new RENAME TO products;
                COMMIT;
            `);
            console.log('[MIGRAÇÃO] Tabela products atualizada com sucesso (unidade PC).');
        }
    } catch (e) {
        try { await db.exec('ROLLBACK;'); } catch(err) {}
        console.error('[MIGRAÇÃO] Erro ao migrar tabela products:', e.message);
    }

    // Migração: Atualizar CHECK constraint da tabela proposals
    try {
        const columns = await db.all("PRAGMA table_info(proposals)");
        const hasBudgetData = columns.find(c => c.name === 'budget_data');
        const hasFullStatus = true; // Placeholder para checar constraint se fosse possível facilmente

        // Só executa se a tabela ainda não tiver sido atualizada com as novas colunas
        // Se já tem 'budget_data', assumimos que já passou por aqui ou pelo loop de migrações
        if (!hasBudgetData) {
            await db.exec(`
                BEGIN TRANSACTION;
                CREATE TABLE proposals_temp (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tenant_id INTEGER NOT NULL,
                    partner_id INTEGER NOT NULL,
                    user_id INTEGER,
                    description TEXT NOT NULL,
                    value DECIMAL(10, 2) DEFAULT 0,
                    status TEXT DEFAULT 'ABERTO' CHECK(status IN ('ABERTO', 'APROVADO', 'REJEITADO', 'PENDENTE', 'EM PRODUÇÃO', 'FINALIZADO', 'CANCELADO', 'REVISAR')),
                    phase TEXT DEFAULT 'Comercial',
                    phase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    budget_data TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
                    FOREIGN KEY (partner_id) REFERENCES partners(id)
                );
                
                INSERT INTO proposals_temp (id, tenant_id, partner_id, description, value, status, created_at)
                SELECT id, tenant_id, partner_id, description, value, status, created_at FROM proposals;
                
                DROP TABLE proposals;
                ALTER TABLE proposals_temp RENAME TO proposals;
                COMMIT;
            `);
            console.log('[MIGRAÇÃO] Tabela proposals estruturada com novas colunas.');
        }
    } catch (e) {
        try { await db.exec('ROLLBACK;'); } catch(err) {}
    }

    const migrations = [
        { table: 'partners', column: 'address_num', type: 'TEXT' },
        { table: 'partners', column: 'address_complement', type: 'TEXT' },
        { table: 'partners', column: 'address_cep', type: 'TEXT' },
        { table: 'partners', column: 'address_city', type: 'TEXT' },
        { table: 'partners', column: 'address_neighborhood', type: 'TEXT' },
        { table: 'partners', column: 'notes', type: 'TEXT' },
        { table: 'partners', column: 'commission_percentage', type: 'DECIMAL(5, 2) DEFAULT 0' },
        { table: 'proposals', column: 'value', type: 'DECIMAL(10, 2) DEFAULT 0' },
        { table: 'proposals', column: 'status', type: 'TEXT DEFAULT "ABERTO"' },
        { table: 'proposals', column: 'user_id', type: 'INTEGER' },
        { table: 'proposals', column: 'phase', type: 'TEXT DEFAULT "Comercial"' },
        { table: 'proposals', column: 'phase_date', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { table: 'proposals', column: 'budget_data', type: 'TEXT' },
        { table: 'production_orders', column: 'priority', type: 'TEXT DEFAULT "MEDIA"' },
        { table: 'production_orders', column: 'start_date', type: 'DATETIME' },
        { table: 'production_orders', column: 'end_date', type: 'DATETIME' },
        { table: 'users', column: 'role', type: 'TEXT DEFAULT "USER"' },
        { table: 'users', column: 'phone', type: 'TEXT' },
        { table: 'proposals', column: 'fabrication_days', type: 'INTEGER DEFAULT 0' },
        { table: 'proposals', column: 'assembly_days', type: 'INTEGER DEFAULT 0' },
        { table: 'proposals', column: 'payment_methods', type: 'TEXT' },
        { table: 'proposals', column: 'payment_notes', type: 'TEXT' },
        { table: 'proposals', column: 'pricing_snapshot', type: 'TEXT' },
        { table: 'payment_conditions', column: 'finance_cost_percentage', type: 'REAL DEFAULT 0' },
        { table: 'proposal_events', column: 'title', type: 'TEXT' },
        { table: 'proposal_events', column: 'type', type: 'TEXT DEFAULT "Anotacao"' },
        { table: 'proposal_events', column: 'event_status', type: 'TEXT DEFAULT "ABERTO"' },
        { table: 'proposals', column: 'drive_folder_id', type: 'TEXT' },
        { table: 'proposals', column: 'drive_folder_url', type: 'TEXT' },
        { table: 'proposals', column: 'presentation_token', type: 'TEXT' },
        { table: 'proposals', column: 'presentation_token_expires', type: 'DATETIME' },
        { table: 'products', column: 'group_name', type: 'TEXT DEFAULT "Outros"' },
        { table: 'tenants', column: 'website', type: 'TEXT' },
        { table: 'tenants', column: 'instagram', type: 'TEXT' },
        { table: 'tenants', column: 'phone', type: 'TEXT' },
        { table: 'tenants', column: 'address_cep', type: 'TEXT' },
        { table: 'tenants', column: 'address', type: 'TEXT' },
        { table: 'tenants', column: 'address_num', type: 'TEXT' },
        { table: 'tenants', column: 'address_complement', type: 'TEXT' },
        { table: 'tenants', column: 'address_neighborhood', type: 'TEXT' },
        { table: 'tenants', column: 'address_city', type: 'TEXT' },
        { table: 'tenants', column: 'address_state', type: 'TEXT' }
    ];

    for (const m of migrations) {
        try {
            const columns = await db.all(`PRAGMA table_info(${m.table})`);
            const exists = columns.find(c => c.name === m.column);
            if (!exists) {
                await db.run(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type}`);
                console.log(`[MIGRAÇÃO] Coluna ${m.column} adicionada à tabela ${m.table}.`);
            }
        } catch (e) {
            console.error(`[MIGRAÇÃO] Erro ao adicionar coluna ${m.column} à tabela ${m.table}:`, e.message);
        }
    }

    // Migração de dados: Ajustar os grupos de produtos antigos para os novos grupos
    try {
        await db.run("UPDATE products SET group_name = 'Fita' WHERE group_name = 'Fita de borda'");
        await db.run("UPDATE products SET group_name = 'Servico' WHERE group_name = 'Serviço'");
        await db.run("UPDATE products SET group_name = 'Ferragem' WHERE group_name IN ('Componente de montagem', 'Ferragens')");
        await db.run("UPDATE products SET group_name = 'Quimicos' WHERE group_name = 'Colas'");
        await db.run("UPDATE products SET group_name = 'Outros' WHERE group_name = 'Vidros'");
        console.log('[MIGRAÇÃO] Grupos de produtos atualizados para os novos nomes com sucesso.');
    } catch (e) {
        console.error('[MIGRAÇÃO] Erro ao migrar grupos de produtos:', e.message);
    }

    // Event Attachments Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS event_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            event_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            type TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
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

    // Attachments Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS proposal_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            proposal_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            type TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (proposal_id) REFERENCES proposals(id)
        )
    `);
    
    // Migração: Atualizar CHECK constraint da tabela tenant_parameters para incluir 'PERCENTAGE'
    try {
        const columns = await db.all("PRAGMA table_info(tenant_parameters)");
        if (columns.length > 0) {
            await db.exec(`
                BEGIN TRANSACTION;
                CREATE TABLE tenant_parameters_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tenant_id INTEGER NOT NULL,
                    key TEXT NOT NULL,
                    type TEXT NOT NULL CHECK(type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'PERCENTAGE')),
                    value TEXT NOT NULL,
                    description TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
                    UNIQUE(tenant_id, key)
                );
                
                INSERT INTO tenant_parameters_new (id, tenant_id, key, type, value, description, updated_at)
                SELECT id, tenant_id, key, type, value, description, updated_at FROM tenant_parameters;
                
                DROP TABLE tenant_parameters;
                ALTER TABLE tenant_parameters_new RENAME TO tenant_parameters;
                COMMIT;
            `);
            console.log('[MIGRAÇÃO] Tabela tenant_parameters atualizada com sucesso (tipo PERCENTAGE).');
        }
    } catch (e) {
        try { await db.exec('ROLLBACK;'); } catch(err) {}
    }

    // Tenant Parameters Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS tenant_parameters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'PERCENTAGE')),
            value TEXT NOT NULL,
            description TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            UNIQUE(tenant_id, key)
        )
    `);

    // Tabela de Formas de Pagamento
    await db.exec(`
        CREATE TABLE IF NOT EXISTS payment_methods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
    `);

    // Tabela de Condições de Pagamento (Subordinada)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS payment_conditions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            payment_method_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            discount_percentage REAL DEFAULT 0,
            finance_cost_percentage REAL DEFAULT 0,
            installments INTEGER DEFAULT 1,
            down_payment_percentage REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE CASCADE
        )
    `);

    // Tabela de Fluxo Financeiro (Débito e Crédito)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS financial_flows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            proposal_id INTEGER,                          -- NULL = lançamento manual
            type TEXT NOT NULL DEFAULT 'CREDITO' CHECK(type IN ('CREDITO', 'DEBITO')),
            category TEXT,                                -- Ex: Receita de Projeto, Fornecedor, Aluguel
            title TEXT NOT NULL,
            description TEXT,
            value DECIMAL(10, 2) DEFAULT 0,
            due_date DATE NOT NULL,
            payment_date DATE,                            -- Data efetiva de liquidação
            note TEXT,
            status TEXT DEFAULT 'EM_ABERTO' CHECK(status IN ('EM_ABERTO', 'LIQUIDADO', 'CANCELADO')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL
        )
    `);

    // Migrações: evolução da tabela financial_flows
    const ffMigrations = [
        { column: 'type',         type: 'TEXT NOT NULL DEFAULT "CREDITO"' },
        { column: 'category',     type: 'TEXT' },
        { column: 'description',  type: 'TEXT' },
        { column: 'payment_date', type: 'DATE' },
    ];
    for (const m of ffMigrations) {
        try {
            const cols = await db.all('PRAGMA table_info(financial_flows)');
            if (!cols.find(c => c.name === m.column)) {
                await db.run(`ALTER TABLE financial_flows ADD COLUMN ${m.column} ${m.type}`);
                console.log(`[MIGRAÇÃO] Coluna ${m.column} adicionada à tabela financial_flows.`);
            }
        } catch(e) {}
    }

    // Migração crítica: tornar proposal_id nullable (recriação da tabela)
    try {
        const cols = await db.all('PRAGMA table_info(financial_flows)');
        const proposalIdCol = cols.find(c => c.name === 'proposal_id');
        if (proposalIdCol && proposalIdCol.notnull === 1) {
            console.log('[MIGRAÇÃO] Recriando financial_flows para tornar proposal_id nullable...');
            await db.exec(`
                BEGIN TRANSACTION;

                CREATE TABLE financial_flows_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tenant_id INTEGER NOT NULL,
                    proposal_id INTEGER,
                    type TEXT NOT NULL DEFAULT 'CREDITO',
                    category TEXT,
                    title TEXT NOT NULL,
                    description TEXT,
                    value DECIMAL(10, 2) DEFAULT 0,
                    due_date DATE NOT NULL,
                    payment_date DATE,
                    note TEXT,
                    status TEXT DEFAULT 'EM_ABERTO',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
                    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL
                );

                INSERT INTO financial_flows_new
                    (id, tenant_id, proposal_id, type, category, title, description, value, due_date, payment_date, note, status, created_at)
                SELECT
                    id, tenant_id, proposal_id,
                    COALESCE(type, 'CREDITO'), category, title, description, value, due_date,
                    payment_date, note,
                    CASE status WHEN 'PAGO' THEN 'LIQUIDADO' ELSE COALESCE(status, 'EM_ABERTO') END,
                    created_at
                FROM financial_flows;

                DROP TABLE financial_flows;
                ALTER TABLE financial_flows_new RENAME TO financial_flows;

                COMMIT;
            `);
            console.log('[MIGRAÇÃO] financial_flows recriada com proposal_id nullable.');
        }
    } catch(e) {
        try { await db.exec('ROLLBACK;'); } catch(_) {}
        console.error('[MIGRAÇÃO] Erro ao recriar financial_flows:', e.message);
    }

    // Migrar status antigo PAGO → LIQUIDADO se existir
    try { await db.run(`UPDATE financial_flows SET status='LIQUIDADO' WHERE status='PAGO'`); } catch(e) {}

    // Atualiza usuários antigos para admin por segurança
    try { await db.run('UPDATE users SET role = "ADMIN" WHERE role = "USER" OR role IS NULL'); } catch(e) {}
    console.log("Banco de dados inicializado com sucesso.");
}

module.exports = { getDbConnection, initializeDatabase };
