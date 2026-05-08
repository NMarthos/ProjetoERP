require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getDbConnection, initializeDatabase } = require('./config/db');
const authMiddleware = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração de Pastas Estáticas (para fotos)
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';
const PORT = process.env.PORT || 3001;

// Configuração do Multer (Upload)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

let db;

async function start() {
    try {
        db = await getDbConnection();
        await initializeDatabase(db);
        console.log('[SERVER] Banco de dados pronto.');

        // --- UPLOAD ROUTE ---
        app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
            if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
            res.json({ url: fileUrl });
        });

        // --- AUTH ROUTES ---
        app.get('/api/schema', async (req, res) => {
            const info = await db.all("PRAGMA table_info(proposals)");
            res.json(info);
        });
        
        app.post('/api/login', async (req, res) => {
            const { email, password } = req.body;
            try {
                const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
                if (!user || !(await bcrypt.compare(password, user.password))) {
                    return res.status(401).json({ error: 'Credenciais inválidas' });
                }
                const token = jwt.sign(
                    { id: user.id, tenantId: user.tenant_id, name: user.name, role: user.role || 'ADMIN' },
                    JWT_SECRET,
                    { expiresIn: '8h' }
                );
                await db.run('INSERT INTO audit_logs (tenant_id, user_id, action, module) VALUES (?, ?, ?, ?)',
                    [user.tenant_id, user.id, 'LOGIN', 'AUTH']);
                res.json({ token, user: { name: user.name, email: user.email, tenantId: user.tenant_id, role: user.role || 'ADMIN' } });
            } catch (err) {
                res.status(500).json({ error: 'Erro interno no servidor' });
            }
        });

        // --- PARTNERS ROUTES (M0) ---
        app.get('/api/partners', authMiddleware, async (req, res) => {
            try {
                const partners = await db.all(`
                    SELECT p.*, r.referrer_id, ref_p.name as referrer_name 
                    FROM partners p
                    LEFT JOIN referrals r ON p.id = r.client_id
                    LEFT JOIN partners ref_p ON r.referrer_id = ref_p.id
                    WHERE p.tenant_id = ? ORDER BY p.name ASC
                `, [req.tenantId]);
                res.json(partners);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar parceiros' });
            }
        });

        app.post('/api/partners', authMiddleware, async (req, res) => {
            const { name, type, document, email, phone, address, address_num, address_complement, address_neighborhood, address_cep, address_city, notes } = req.body;
            try {
                const result = await db.run(
                    `INSERT INTO partners (tenant_id, name, type, document, email, phone, address, address_num, address_complement, address_neighborhood, address_cep, address_city, notes) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [req.tenantId, name || null, type || 'CLIENTE', document || null, email || null, phone || null, address || null, address_num || null, address_complement || null, address_neighborhood || null, address_cep || null, address_city || null, notes || null]
                );
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                console.error("Erro no POST /api/partners:", err);
                res.status(500).json({ error: 'Erro ao criar parceiro' });
            }
        });

        app.put('/api/partners/:id', authMiddleware, async (req, res) => {
            const { name, type, document, email, phone, address, address_num, address_complement, address_neighborhood, address_cep, address_city, notes } = req.body;
            try {
                await db.run(
                    `UPDATE partners SET name=?, type=?, document=?, email=?, phone=?, address=?, address_num=?, address_complement=?, address_neighborhood=?, address_cep=?, address_city=?, notes=?
                    WHERE id=? AND tenant_id=?`,
                    [name || null, type || 'CLIENTE', document || null, email || null, phone || null, address || null, address_num || null, address_complement || null, address_neighborhood || null, address_cep || null, address_city || null, notes || null, req.params.id, req.tenantId]
                );
                res.json({ ok: true });
            } catch (err) {
                console.error("Erro no PUT /api/partners/:id:", err);
                res.status(500).json({ error: 'Erro ao atualizar parceiro' });
            }
        });

        app.delete('/api/partners/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM partners WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao excluir parceiro' });
            }
        });

        // --- MANUFACTURERS ---
        app.get('/api/manufacturers', authMiddleware, async (req, res) => {
            try {
                const manufacturers = await db.all('SELECT * FROM manufacturers WHERE tenant_id = ? ORDER BY name ASC', [req.tenantId]);
                res.json(manufacturers);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar fabricantes' });
            }
        });

        app.post('/api/manufacturers', authMiddleware, async (req, res) => {
            const { name, contact, phone } = req.body;
            try {
                const result = await db.run('INSERT INTO manufacturers (tenant_id, name, contact, phone) VALUES (?, ?, ?, ?)',
                    [req.tenantId, name, contact, phone]);
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao criar fabricante' });
            }
        });

        app.put('/api/manufacturers/:id', authMiddleware, async (req, res) => {
            const { name, contact, phone } = req.body;
            try {
                await db.run('UPDATE manufacturers SET name=?, contact=?, phone=? WHERE id=? AND tenant_id=?',
                    [name, contact, phone, req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao atualizar fabricante' });
            }
        });

        app.delete('/api/manufacturers/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM manufacturers WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao excluir fabricante' });
            }
        });

        // --- PRODUCTS ---
        app.get('/api/products', authMiddleware, async (req, res) => {
            try {
                const products = await db.all(`
                    SELECT p.*, m.name as manufacturer_name 
                    FROM products p 
                    LEFT JOIN manufacturers m ON p.manufacturer_id = m.id 
                    WHERE p.tenant_id = ? ORDER BY p.name ASC`, [req.tenantId]);
                res.json(products);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar produtos' });
            }
        });

        app.post('/api/products', authMiddleware, async (req, res) => {
            const { name, unit, value, manufacturer_id, photo, status } = req.body;
            try {
                const result = await db.run(
                    `INSERT INTO products (tenant_id, name, unit, value, manufacturer_id, photo, status, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [req.tenantId, name, unit, value || 0, manufacturer_id, photo, status ?? 1]
                );

                // Regra Automática: MDF + Chapa -> Cria fitas de borda
                if (unit === 'CHP' && name.toUpperCase().startsWith('MDF')) {
                    // Remove "MDF" do início e qualquer espessura (ex: 15mm, 18mm) do final
                    let baseName = name.substring(3).trim();
                    baseName = baseName.replace(/\s*\d+mm$/i, '').trim();
                    
                    const edgeBands = ['22mm', '35mm', '64mm'];
                    
                    for (const width of edgeBands) {
                        const fbName = `Fb ${baseName} ${width}`;
                        
                        // Verifica se esta fita já existe para evitar duplicidade
                        const existing = await db.get(
                            'SELECT id FROM products WHERE tenant_id = ? AND name = ?', 
                            [req.tenantId, fbName]
                        );

                        if (!existing) {
                            await db.run(
                                `INSERT INTO products (tenant_id, name, unit, value, manufacturer_id, status, updated_at) 
                                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                                [req.tenantId, fbName, 'M', 0, null, 1]
                            );
                        }
                    }
                }

                res.status(201).json({ id: result.lastID });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao criar produto' });
            }
        });

        app.put('/api/products/:id', authMiddleware, async (req, res) => {
            const { name, unit, value, manufacturer_id, photo, status } = req.body;
            try {
                const old = await db.get('SELECT value FROM products WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                const shouldUpdateDate = old && Number(old.value) !== Number(value);

                await db.run(
                    `UPDATE products SET name=?, unit=?, value=?, manufacturer_id=?, photo=?, status=?, 
                    updated_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE updated_at END
                    WHERE id=? AND tenant_id=?`,
                    [name, unit, value, manufacturer_id, photo, status, shouldUpdateDate ? 1 : 0, req.params.id, req.tenantId]
                );
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao atualizar produto' });
            }
        });

        app.delete('/api/products/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM products WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao excluir produto' });
            }
        });

        // --- REFERRALS ---
        app.get('/api/referrals', authMiddleware, async (req, res) => {
            try {
                const referrals = await db.all(`
                    SELECT r.*, p.name as referrer_name, p.type as referrer_type FROM referrals r
                    JOIN partners p ON r.referrer_id = p.id WHERE r.tenant_id = ? AND r.client_id = ?`,
                    [req.tenantId, req.query.clientId]);
                res.json(referrals);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar indicações' });
            }
        });

        app.post('/api/referrals', authMiddleware, async (req, res) => {
            const { client_id, referrer_id, notes } = req.body;
            try {
                await db.run('INSERT INTO referrals (tenant_id, client_id, referrer_id, notes) VALUES (?, ?, ?, ?)',
                    [req.tenantId, client_id, referrer_id, notes]);
                res.status(201).json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao registrar indicação' });
            }
        });

        app.delete('/api/referrals/client/:clientId', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM referrals WHERE tenant_id = ? AND client_id = ?', [req.tenantId, req.params.clientId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao remover indicação' });
            }
        });

        // --- PROPOSALS ---
        app.get('/api/proposals', authMiddleware, async (req, res) => {
            try {
                const proposals = await db.all(`
                    SELECT p.*, pt.name as partner_name, u.name as creator_name,
                    (SELECT COUNT(*) FROM proposal_events e WHERE e.proposal_id = p.id AND e.monitor = 1) as has_monitored_event 
                    FROM proposals p 
                    JOIN partners pt ON p.partner_id = pt.id 
                    LEFT JOIN users u ON p.user_id = u.id
                    WHERE p.tenant_id = ?`, [req.tenantId]);
                res.json(proposals);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar orçamentos' });
            }
        });

        app.post('/api/proposals', authMiddleware, async (req, res) => {
            const { partner_id, description, value, status, phase } = req.body;
            const newPhase = phase || '1-Comercial';
            try {
                const result = await db.run('INSERT INTO proposals (tenant_id, partner_id, user_id, description, value, status, phase, phase_date) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [req.tenantId, partner_id, req.user.id, description, value || 0, status || 'ABERTO', newPhase]);
                
                await db.run('INSERT INTO proposal_history (tenant_id, proposal_id, old_phase, new_phase, user_id) VALUES (?, ?, ?, ?, ?)',
                    [req.tenantId, result.lastID, null, newPhase, req.user.id]);
                    
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                console.error("POST proposals error:", err);
                res.status(500).json({ error: 'Erro ao criar orçamento: ' + err.message });
            }
        });

        app.put('/api/proposals/:id', authMiddleware, async (req, res) => {
            const { description, value, status, partner_id, phase } = req.body;
            try {
                const old = await db.get('SELECT phase FROM proposals WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                const currentPhase = old ? old.phase : '1-Comercial';
                
                let query = 'UPDATE proposals SET description=?, value=?, status=?, partner_id=?';
                let params = [description, value, status, partner_id];
                
                if (phase && phase !== currentPhase) {
                    query += ', phase=?, phase_date=CURRENT_TIMESTAMP';
                    params.push(phase);
                    await db.run('INSERT INTO proposal_history (tenant_id, proposal_id, old_phase, new_phase, user_id) VALUES (?, ?, ?, ?, ?)',
                        [req.tenantId, req.params.id, currentPhase, phase, req.user.id]);
                }
                query += ' WHERE id=? AND tenant_id=?';
                params.push(req.params.id, req.tenantId);
                
                await db.run(query, params);
                res.json({ ok: true });
            } catch (err) {
                console.error("PUT proposals error:", err);
                res.status(500).json({ error: 'Erro ao atualizar orçamento: ' + err.message });
            }
        });

        app.get('/api/proposals/:id/history', authMiddleware, async (req, res) => {
            try {
                const history = await db.all(`
                    SELECT h.*, u.name as user_name 
                    FROM proposal_history h
                    LEFT JOIN users u ON h.user_id = u.id
                    WHERE h.proposal_id=? AND h.tenant_id=?
                    ORDER BY h.created_at DESC`, [req.params.id, req.tenantId]);
                res.json(history);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar histórico' });
            }
        });

        // --- PROPOSAL EVENTS ---
        app.get('/api/proposals/:id/events', authMiddleware, async (req, res) => {
            try {
                const events = await db.all(`
                    SELECT e.*, u.name as user_name 
                    FROM proposal_events e
                    LEFT JOIN users u ON e.user_id = u.id
                    WHERE e.proposal_id=? AND e.tenant_id=?
                    ORDER BY e.event_date ASC, e.event_time ASC`, [req.params.id, req.tenantId]);
                res.json(events);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar eventos' });
            }
        });

        app.post('/api/proposals/:id/events', authMiddleware, async (req, res) => {
            const { event_date, event_time, description, monitor } = req.body;
            try {
                await db.run(
                    'INSERT INTO proposal_events (tenant_id, proposal_id, event_date, event_time, description, monitor, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [req.tenantId, req.params.id, event_date, event_time, description, monitor ? 1 : 0, req.user.id]
                );
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao criar evento' });
            }
        });

        app.put('/api/events/:id', authMiddleware, async (req, res) => {
            const { event_date, event_time, description, monitor } = req.body;
            try {
                await db.run(
                    'UPDATE proposal_events SET event_date=?, event_time=?, description=?, monitor=? WHERE id=? AND tenant_id=?',
                    [event_date, event_time, description, monitor ? 1 : 0, req.params.id, req.tenantId]
                );
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao atualizar evento' });
            }
        });

        app.delete('/api/proposals/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM proposals WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao excluir orçamento' });
            }
        });

        // --- PRODUCTION ORDERS ---
        app.get('/api/production-orders', authMiddleware, async (req, res) => {
            try {
                const orders = await db.all(`
                    SELECT po.*, p.description as proposal_description, pt.name as partner_name FROM production_orders po
                    JOIN proposals p ON po.proposal_id = p.id JOIN partners pt ON p.partner_id = pt.id WHERE po.tenant_id = ?`, [req.tenantId]);
                res.json(orders);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar ordens de produção' });
            }
        });

        app.post('/api/production-orders', authMiddleware, async (req, res) => {
            const { proposal_id, priority } = req.body;
            try {
                const proposal = await db.get('SELECT status FROM proposals WHERE id = ?', [proposal_id]);
                if (!proposal || proposal.status !== 'APROVADO') {
                    return res.status(400).json({ error: 'Apenas orçamentos aprovados podem gerar ordens de produção' });
                }
                const result = await db.run('INSERT INTO production_orders (tenant_id, proposal_id, priority) VALUES (?, ?, ?)',
                    [req.tenantId, proposal_id, priority || 'MEDIA']);
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao criar ordem de produção' });
            }
        });

        app.put('/api/production-orders/:id', authMiddleware, async (req, res) => {
            const { status, priority, start_date, end_date } = req.body;
            try {
                await db.run('UPDATE production_orders SET status=?, priority=?, start_date=?, end_date=? WHERE id=? AND tenant_id=?',
                    [status, priority, start_date, end_date, req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao atualizar ordem de produção' });
            }
        });

        app.delete('/api/production-orders/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM production_orders WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao excluir ordem de produção' });
            }
        });

        // --- SECURITY (TENANTS & USERS) ---
        app.get('/api/security/tenants', authMiddleware, async (req, res) => {
            if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
            try {
                const tenants = await db.all('SELECT id, name, cnpj as document, active, created_at FROM tenants ORDER BY id ASC');
                res.json(tenants);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar contas' });
            }
        });

        app.post('/api/security/tenants', authMiddleware, async (req, res) => {
            if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
            const { name, document } = req.body;
            try {
                const result = await db.run('INSERT INTO tenants (name, cnpj) VALUES (?, ?)', [name, document]);
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                console.error("Erro no POST /api/security/tenants:", err);
                res.status(500).json({ error: 'Erro ao criar conta' });
            }
        });

        app.put('/api/security/tenants/:id', authMiddleware, async (req, res) => {
            if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
            const { name, document, active } = req.body;
            try {
                await db.run('UPDATE tenants SET name=?, cnpj=?, active=? WHERE id=?', [name, document, active, req.params.id]);
                res.json({ ok: true });
            } catch (err) {
                console.error("Erro no PUT /api/security/tenants/:id:", err);
                res.status(500).json({ error: 'Erro ao atualizar conta' });
            }
        });

        app.get('/api/security/users', authMiddleware, async (req, res) => {
            if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
            try {
                const users = await db.all(`
                    SELECT u.id, u.tenant_id, u.name, u.email, u.active, u.role, t.name as tenant_name 
                    FROM users u
                    LEFT JOIN tenants t ON u.tenant_id = t.id
                    ORDER BY u.name ASC
                `);
                res.json(users);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar usuários' });
            }
        });

        app.post('/api/security/users', authMiddleware, async (req, res) => {
            if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
            const { tenant_id, name, email, password, role } = req.body;
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                const result = await db.run(
                    'INSERT INTO users (tenant_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
                    [tenant_id, name, email, hashedPassword, role || 'USER']
                );
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao criar usuário' });
            }
        });

        app.put('/api/security/users/:id', authMiddleware, async (req, res) => {
            if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
            const { tenant_id, name, email, password, role, active } = req.body;
            try {
                if (password && password.trim() !== '') {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    await db.run(
                        'UPDATE users SET tenant_id=?, name=?, email=?, password=?, role=?, active=? WHERE id=?',
                        [tenant_id, name, email, hashedPassword, role, active, req.params.id]
                    );
                } else {
                    await db.run(
                        'UPDATE users SET tenant_id=?, name=?, email=?, role=?, active=? WHERE id=?',
                        [tenant_id, name, email, role, active, req.params.id]
                    );
                }
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao atualizar usuário' });
            }
        });

        app.listen(PORT, () => console.log(`[SERVER] Rodando na porta ${PORT}`));

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

start();
