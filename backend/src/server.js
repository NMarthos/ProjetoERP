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
const { createProposalFolder } = require('./config/googleDrive');


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
                const user = await db.get(`
                    SELECT u.*, t.logo_url 
                    FROM users u 
                    JOIN tenants t ON u.tenant_id = t.id 
                    WHERE u.email = ?
                `, [email]);
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
                res.json({ 
                    token, 
                    user: { 
                        name: user.name, 
                        email: user.email, 
                        phone: user.phone || null,
                        tenantId: user.tenant_id, 
                        role: user.role || 'ADMIN',
                        logo_url: user.logo_url
                    } 
                });
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
            const { name, type, document, email, phone, address, address_num, address_complement, address_neighborhood, address_cep, address_city, notes, commission_percentage, referrer_id } = req.body;
            try {
                await db.run('BEGIN TRANSACTION');
                const result = await db.run(
                    `INSERT INTO partners (tenant_id, name, type, document, email, phone, address, address_num, address_complement, address_neighborhood, address_cep, address_city, notes, commission_percentage) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [req.tenantId, name || null, type || 'CLIENTE', document || null, email || null, phone || null, address || null, address_num || null, address_complement || null, address_neighborhood || null, address_cep || null, address_city || null, notes || null, commission_percentage || 0]
                );
                
                if (referrer_id) {
                    await db.run('INSERT INTO referrals (tenant_id, client_id, referrer_id, notes) VALUES (?, ?, ?, ?)',
                        [req.tenantId, result.lastID, referrer_id, 'Indicação automática']);
                }
                
                await db.run('COMMIT');
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                await db.run('ROLLBACK');
                console.error("Erro no POST /api/partners:", err);
                res.status(500).json({ error: 'Erro ao criar parceiro' });
            }
        });

        app.put('/api/partners/:id', authMiddleware, async (req, res) => {
            const { name, type, document, email, phone, address, address_num, address_complement, address_neighborhood, address_cep, address_city, notes, commission_percentage, referrer_id } = req.body;
            try {
                await db.run('BEGIN TRANSACTION');
                await db.run(
                    `UPDATE partners SET name=?, type=?, document=?, email=?, phone=?, address=?, address_num=?, address_complement=?, address_neighborhood=?, address_cep=?, address_city=?, notes=?, commission_percentage=?
                    WHERE id=? AND tenant_id=?`,
                    [name || null, type || 'CLIENTE', document || null, email || null, phone || null, address || null, address_num || null, address_complement || null, address_neighborhood || null, address_cep || null, address_city || null, notes || null, commission_percentage || 0, req.params.id, req.tenantId]
                );

                // Update referral
                await db.run('DELETE FROM referrals WHERE client_id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
                if (referrer_id) {
                    await db.run('INSERT INTO referrals (tenant_id, client_id, referrer_id, notes) VALUES (?, ?, ?, ?)',
                        [req.tenantId, req.params.id, referrer_id, 'Indicação automática']);
                }

                await db.run('COMMIT');
                res.json({ ok: true });
            } catch (err) {
                await db.run('ROLLBACK');
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
            const { name, unit, value, manufacturer_id, photo, status, group_name } = req.body;
            try {
                const result = await db.run(
                    `INSERT INTO products (tenant_id, name, unit, value, manufacturer_id, photo, status, group_name, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [req.tenantId, name, unit, value || 0, manufacturer_id, photo, status ?? 1, group_name || 'Outros']
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
                                `INSERT INTO products (tenant_id, name, unit, value, manufacturer_id, status, group_name, updated_at) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                                [req.tenantId, fbName, 'M', 0, null, 1, 'Fita']
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
            const { name, unit, value, manufacturer_id, photo, status, group_name } = req.body;
            try {
                const old = await db.get('SELECT value FROM products WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                const shouldUpdateDate = old && Number(old.value) !== Number(value);

                await db.run(
                    `UPDATE products SET name=?, unit=?, value=?, manufacturer_id=?, photo=?, status=?, group_name=?,
                    updated_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE updated_at END
                    WHERE id=? AND tenant_id=?`,
                    [name, unit, value, manufacturer_id, photo, status, group_name || 'Outros', shouldUpdateDate ? 1 : 0, req.params.id, req.tenantId]
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
                // Busca orçamentos com info do parceiro e comissão de quem indicou
                const proposals = await db.all(`
                    SELECT p.*, pt.name as partner_name, pt.phone as partner_phone, pt.email as partner_email, 
                    u.name as creator_name,
                    ref_p.commission_percentage as referrer_commission,
                    (SELECT COUNT(*) FROM proposal_events e WHERE e.proposal_id = p.id AND e.monitor = 1) as has_monitored_event 
                    FROM proposals p 
                    JOIN partners pt ON p.partner_id = pt.id 
                    LEFT JOIN users u ON p.user_id = u.id
                    LEFT JOIN referrals ref ON p.partner_id = ref.client_id AND p.tenant_id = ref.tenant_id
                    LEFT JOIN partners ref_p ON ref.referrer_id = ref_p.id
                    WHERE p.tenant_id = ?`, [req.tenantId]);
                
                // Busca parâmetros globais para cálculo
                const taxes = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "COMERCIAL_IMPOSTOS"', [req.tenantId]);
                const markup = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "COMERCIAL_MARKUP"', [req.tenantId]);
                // financeCost is global 0

                res.json({
                    proposals,
                    settings: {
                        taxes: taxes ? parseFloat(taxes.value) : 0,
                        markup: markup ? parseFloat(markup.value) : 0,
                        financeCost: 0
                    }
                });
            } catch (err) {
                console.error("GET proposals error:", err);
                res.status(500).json({ error: 'Erro ao buscar orçamentos' });
            }
        });

        app.get('/api/proposals/:id', authMiddleware, async (req, res) => {
            try {
                const proposal = await db.get(`
                    SELECT p.*, pt.name as partner_name, pt.phone as partner_phone, pt.email as partner_email,
                    u.name as creator_name,
                    ref_p.name as referrer_name,
                    ref_p.commission_percentage as referrer_commission
                    FROM proposals p 
                    JOIN partners pt ON p.partner_id = pt.id 
                    LEFT JOIN users u ON p.user_id = u.id
                    LEFT JOIN referrals ref ON p.partner_id = ref.client_id AND p.tenant_id = ref.tenant_id
                    LEFT JOIN partners ref_p ON ref.referrer_id = ref_p.id
                    WHERE p.id = ? AND p.tenant_id = ?`, [req.params.id, req.tenantId]);
                
                if (!proposal) return res.status(404).json({ error: 'Orçamento não encontrado' });
                res.json(proposal);
            } catch (err) {
                console.error("GET proposal error:", err);
                res.status(500).json({ error: 'Erro ao buscar orçamento' });
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
            const body = req.body;
            try {
                // Permission Check: Owner or Admin
                const proposal = await db.get('SELECT user_id, phase FROM proposals WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                if (!proposal) return res.status(404).json({ error: 'Orçamento não encontrado' });
                
                const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'ADM';
                if (proposal.user_id !== req.user.id && !isAdmin) {
                    return res.status(403).json({ error: 'Acesso negado: Você não é o responsável por esta proposta.' });
                }

                const currentPhase = proposal.phase || '1-Comercial';
                
                let setClauses = [];
                let params = [];
                
                const fields = ['description', 'value', 'status', 'partner_id', 'budget_data', 'fabrication_days', 'assembly_days', 'payment_methods', 'payment_notes', 'pricing_snapshot', 'delivery_deadline', 'assembly_deadline'];
                fields.forEach(field => {
                    if (body[field] !== undefined) {
                        setClauses.push(`${field}=?`);
                        params.push(body[field]);
                    }
                });

                if (body.phase && body.phase !== currentPhase) {
                    setClauses.push('phase=?', 'phase_date=CURRENT_TIMESTAMP');
                    params.push(body.phase);
                    await db.run('INSERT INTO proposal_history (tenant_id, proposal_id, old_phase, new_phase, user_id) VALUES (?, ?, ?, ?, ?)',
                        [req.tenantId, req.params.id, currentPhase, body.phase, req.user.id]);
                }

                if (setClauses.length === 0) return res.json({ ok: true });

                const query = `UPDATE proposals SET ${setClauses.join(', ')} WHERE id=? AND tenant_id=?`;
                params.push(req.params.id, req.tenantId);
                
                await db.run('BEGIN TRANSACTION');
                try {
                    await db.run(query, params);
                    
                    const updatedProposal = await db.get('SELECT status, payment_notes FROM proposals WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                    if (updatedProposal && updatedProposal.status === 'APROVADO' && updatedProposal.payment_notes) {
                        // Parse payment_notes to flows
                        const lines = updatedProposal.payment_notes.split('\n').filter(l => l.includes('|'));
                        const parsedFlows = [];
                        for (const line of lines) {
                            const parts = line.split('|').map(s => s.trim());
                            if (parts.length >= 3) {
                                const title = parts[0];
                                const rawVal = parts[1];
                                const rawDate = parts[2];
                                const note = parts[3] || '';
                                
                                const value = parseFloat(rawVal.replace(/[R$\s.]/g, '').replace(',', '.'));
                                
                                let dueDate = '';
                                if (rawDate.includes('/')) {
                                    const dateParts = rawDate.split('/');
                                    if (dateParts.length === 3) {
                                        dueDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
                                    }
                                } else if (rawDate.includes('-')) {
                                    dueDate = rawDate;
                                }
                                
                                if (title && !isNaN(value) && dueDate) {
                                    parsedFlows.push({ title, value, due_date: dueDate, note });
                                }
                            }
                        }

                        if (parsedFlows.length > 0) {
                            await db.run(
                                `DELETE FROM financial_flows WHERE proposal_id=? AND tenant_id=? AND type='CREDITO'`,
                                [req.params.id, req.tenantId]
                            );
                            for (const row of parsedFlows) {
                                await db.run(
                                    `INSERT INTO financial_flows (tenant_id, proposal_id, type, category, title, value, due_date, note, status)
                                     VALUES (?, ?, 'CREDITO', 'Receita de Projeto', ?, ?, ?, ?, 'EM_ABERTO')`,
                                    [req.tenantId, req.params.id, row.title, row.value, row.due_date, row.note || '']
                                );
                            }
                            console.log(`[API] Automatically generated ${parsedFlows.length} financial flows for proposal ${req.params.id} via PUT`);
                        }
                    }
                    await db.run('COMMIT');
                    res.json({ ok: true });
                } catch (txErr) {
                    await db.run('ROLLBACK');
                    throw txErr;
                }
            } catch (err) {
                console.error("PUT proposals error:", err);
                res.status(500).json({ error: 'Erro ao atualizar orçamento: ' + err.message });
            }
        });

        // --- APPROVE PROPOSAL (full atomic flow) ---
        app.post('/api/proposals/:id/approve', authMiddleware, async (req, res) => {
            const { flows, payment_methods, payment_notes } = req.body;
            // flows: [{ title, value, due_date, note }]
            try {
                const proposal = await db.get(
                    'SELECT user_id, phase FROM proposals WHERE id=? AND tenant_id=?',
                    [req.params.id, req.tenantId]
                );
                if (!proposal) return res.status(404).json({ error: 'Proposta não encontrada' });

                const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'ADM';
                if (proposal.user_id !== req.user.id && !isAdmin) {
                    return res.status(403).json({ error: 'Acesso negado.' });
                }

                const oldPhase = proposal.phase || 'Comercial';
                const newPhase = 'Técnica';

                await db.run('BEGIN TRANSACTION');
                try {
                    // 1. Update proposal
                    await db.run(
                        `UPDATE proposals SET status='APROVADO', phase=?, phase_date=CURRENT_TIMESTAMP,
                         payment_methods=?, payment_notes=? WHERE id=? AND tenant_id=?`,
                        [newPhase, payment_methods || '', payment_notes || '', req.params.id, req.tenantId]
                    );

                    // 2. Delete existing CREDIT financial flows for this proposal (to keep only the latest approval)
                    await db.run(
                        `DELETE FROM financial_flows WHERE proposal_id=? AND tenant_id=? AND type='CREDITO'`,
                        [req.params.id, req.tenantId]
                    );

                    // 3. Insert financial flow rows (type=CREDITO, from proposal approval)
                    if (Array.isArray(flows) && flows.length > 0) {
                        for (const row of flows) {
                            await db.run(
                                `INSERT INTO financial_flows (tenant_id, proposal_id, type, category, title, value, due_date, note, status)
                                 VALUES (?, ?, 'CREDITO', 'Receita de Projeto', ?, ?, ?, ?, 'EM_ABERTO')`,
                                [req.tenantId, req.params.id, row.title, row.value, row.due_date, row.note || '']
                            );
                        }
                    }

                    // 3. Insert phase history
                    await db.run(
                        `INSERT INTO proposal_history (tenant_id, proposal_id, old_phase, new_phase, user_id)
                         VALUES (?, ?, ?, ?, ?)`,
                        [req.tenantId, req.params.id, oldPhase, newPhase, req.user.id]
                    );

                    await db.run('COMMIT');
                    res.json({ ok: true, message: 'Proposta aprovada com sucesso!' });
                } catch (txErr) {
                    await db.run('ROLLBACK');
                    throw txErr;
                }
            } catch (err) {
                console.error('[APPROVE] Error:', err);
                res.status(500).json({ error: 'Erro ao aprovar proposta: ' + err.message });
            }
        });

        // --- PRODUCTION PHASE ADVANCE (sem restrição de dono) ---
        app.put('/api/proposals/:id/production-phase', authMiddleware, async (req, res) => {
            const { phase } = req.body;
            const VALID_PHASES = ['Técnica', 'Produção', 'Despacho', 'Montagem', 'Concluído'];
            if (!phase || !VALID_PHASES.includes(phase)) {
                return res.status(400).json({ error: 'Fase inválida. Valores aceitos: ' + VALID_PHASES.join(', ') });
            }
            try {
                const proposal = await db.get(
                    'SELECT phase FROM proposals WHERE id=? AND tenant_id=? AND status=?',
                    [req.params.id, req.tenantId, 'APROVADO']
                );
                if (!proposal) return res.status(404).json({ error: 'Proposta não encontrada ou não aprovada' });

                const oldPhase = proposal.phase;
                await db.run(
                    'UPDATE proposals SET phase=?, phase_date=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?',
                    [phase, req.params.id, req.tenantId]
                );
                await db.run(
                    'INSERT INTO proposal_history (tenant_id, proposal_id, old_phase, new_phase, user_id) VALUES (?, ?, ?, ?, ?)',
                    [req.tenantId, req.params.id, oldPhase, phase, req.user.id]
                );
                res.json({ ok: true });
            } catch (err) {
                console.error('[PRODUCTION-PHASE] Error:', err);
                res.status(500).json({ error: 'Erro ao avançar fase: ' + err.message });
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

        // --- FINANCIAL FLOWS ---
        app.get('/api/financial-flows', authMiddleware, async (req, res) => {
            const { date_from, date_to, status, type } = req.query;
            try {
                let conditions = ['ff.tenant_id = ?'];
                let params = [req.tenantId];

                if (date_from) { conditions.push('ff.due_date >= ?'); params.push(date_from); }
                if (date_to)   { conditions.push('ff.due_date <= ?'); params.push(date_to); }
                if (status)    { conditions.push('ff.status = ?');    params.push(status); }
                if (type)      { conditions.push('ff.type = ?');      params.push(type); }

                const rows = await db.all(`
                    SELECT ff.*,
                           p.description as proposal_description,
                           pt.name as partner_name
                    FROM financial_flows ff
                    LEFT JOIN proposals p  ON ff.proposal_id = p.id
                    LEFT JOIN partners pt ON p.partner_id = pt.id
                    WHERE ${conditions.join(' AND ')}
                    ORDER BY ff.due_date ASC, ff.id ASC
                `, params);
                res.json(rows);
            } catch (err) {
                console.error('[FINANCIAL-FLOWS] GET error:', err);
                res.status(500).json({ error: 'Erro ao buscar fluxo de caixa: ' + err.message });
            }
        });

        app.post('/api/financial-flows', authMiddleware, async (req, res) => {
            const { type, category, title, description, value, due_date, payment_date, note, proposal_id } = req.body;
            if (!title || !due_date || !value) return res.status(400).json({ error: 'Campos obrigatórios: título, data de vencimento e valor.' });
            try {
                const result = await db.run(
                    `INSERT INTO financial_flows (tenant_id, proposal_id, type, category, title, description, value, due_date, payment_date, note, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EM_ABERTO')`,
                    [req.tenantId, proposal_id || null, type || 'CREDITO', category || null, title, description || null, value, due_date, payment_date || null, note || null]
                );
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao criar lançamento: ' + err.message });
            }
        });

        app.put('/api/financial-flows/:id', authMiddleware, async (req, res) => {
            const { type, category, title, description, value, due_date, payment_date, note, status } = req.body;
            try {
                await db.run(
                    `UPDATE financial_flows SET type=?, category=?, title=?, description=?, value=?, due_date=?, payment_date=?, note=?, status=?
                     WHERE id=? AND tenant_id=?`,
                    [type, category || null, title, description || null, value, due_date, payment_date || null, note || null, status, req.params.id, req.tenantId]
                );
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao atualizar lançamento: ' + err.message });
            }
        });

        app.patch('/api/financial-flows/:id/status', authMiddleware, async (req, res) => {
            const { status, payment_date } = req.body;
            const validStatus = ['EM_ABERTO', 'LIQUIDADO', 'CANCELADO'];
            if (!validStatus.includes(status)) return res.status(400).json({ error: 'Status inválido' });
            try {
                await db.run(
                    'UPDATE financial_flows SET status=?, payment_date=? WHERE id=? AND tenant_id=?',
                    [status, payment_date || null, req.params.id, req.tenantId]
                );
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao atualizar status: ' + err.message });
            }
        });

        app.delete('/api/financial-flows/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM financial_flows WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao excluir lançamento: ' + err.message });
            }
        });

        // --- PROPOSAL EVENTS ---
        app.get('/api/proposals/:id/events', authMiddleware, async (req, res) => {
            try {
                const events = await db.all(`
                    SELECT e.*, u.name as user_name,
                    (SELECT COUNT(*) FROM event_attachments ea WHERE ea.event_id = e.id) as attachment_count
                    FROM proposal_events e
                    LEFT JOIN users u ON e.user_id = u.id
                    WHERE e.proposal_id=? AND e.tenant_id=?
                    ORDER BY e.id ASC`, [req.params.id, req.tenantId]);
                res.json(events);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar eventos' });
            }
        });

        // --- PROPOSAL ATTACHMENTS ---
        app.get('/api/proposals/:id/attachments', authMiddleware, async (req, res) => {
            try {
                const attachments = await db.all('SELECT * FROM proposal_attachments WHERE proposal_id=? AND tenant_id=?', 
                    [req.params.id, req.tenantId]);
                res.json(attachments);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar anexos' });
            }
        });

        app.post('/api/proposals/:id/attachments', authMiddleware, async (req, res) => {
            const { name, url, type } = req.body;
            try {
                await db.run('INSERT INTO proposal_attachments (tenant_id, proposal_id, name, url, type) VALUES (?, ?, ?, ?, ?)',
                    [req.tenantId, req.params.id, name, url, type]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao salvar anexo' });
            }
        });

        app.delete('/api/attachments/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM proposal_attachments WHERE id=? AND tenant_id=?', 
                    [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao remover anexo' });
            }
        });

        app.post('/api/proposals/:id/events', authMiddleware, async (req, res) => {
            const { event_date, event_time, title, description, type, event_status, monitor } = req.body;
            try {
                await db.run(
                    'INSERT INTO proposal_events (tenant_id, proposal_id, event_date, event_time, title, description, type, event_status, monitor, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [req.tenantId, req.params.id, event_date || '', event_time || '', title || '', description, type || 'Anotacao', event_status || 'ABERTO', monitor ? 1 : 0, req.user.id]
                );
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao criar evento' });
            }
        });

        app.put('/api/events/:id', authMiddleware, async (req, res) => {
            const { event_date, event_time, title, description, type, event_status, monitor } = req.body;
            try {
                // Fetch current event before updating to detect status change
                const currentEvent = await db.get(
                    'SELECT * FROM proposal_events WHERE id=? AND tenant_id=?',
                    [req.params.id, req.tenantId]
                );

                await db.run(
                    'UPDATE proposal_events SET event_date=?, event_time=?, title=?, description=?, type=?, event_status=?, monitor=? WHERE id=? AND tenant_id=?',
                    [event_date ?? '', event_time ?? '', title ?? '', description, type ?? 'Anotacao', event_status ?? 'ABERTO', monitor ? 1 : 0, req.params.id, req.tenantId]
                );

                // Auto-advance proposal phase when a Tarefa is closed
                const isClosing = event_status === 'FECHADO' && currentEvent?.event_status !== 'FECHADO';
                const isTarefa = ['Tarefa', 'Levantamento de medidas', 'Confirmação de medidas'].includes(type ?? currentEvent?.type);

                if (isClosing && isTarefa && currentEvent?.proposal_id) {
                    const eventTitle = title ?? currentEvent?.title ?? '';
                    const PHASE_MAP = {
                        '1 -': '1-Comercial/Lev.Medidas',
                        '2 -': '1-Comercial/Projeto',
                        '3 -': '1-Comercial/Proposta',
                        '4 -': '1-Comercial/Apresentação',
                    };
                    let newPhase = null;
                    for (const [prefix, phase] of Object.entries(PHASE_MAP)) {
                        if (eventTitle.startsWith(prefix)) { newPhase = phase; break; }
                    }
                    if (newPhase) {
                        const proposal = await db.get('SELECT phase FROM proposals WHERE id=? AND tenant_id=?',
                            [currentEvent.proposal_id, req.tenantId]);
                        if (proposal && proposal.phase !== newPhase) {
                            await db.run('UPDATE proposals SET phase=?, phase_date=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?',
                                [newPhase, currentEvent.proposal_id, req.tenantId]);
                            await db.run('INSERT INTO proposal_history (tenant_id, proposal_id, old_phase, new_phase, user_id) VALUES (?, ?, ?, ?, ?)',
                                [req.tenantId, currentEvent.proposal_id, proposal.phase, newPhase, req.user.id]);
                        }
                    }
                }

                res.json({ ok: true });
            } catch (err) {
                console.error('PUT /events error:', err);
                res.status(500).json({ error: 'Erro ao atualizar evento' });
            }
        });

        app.delete('/api/events/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('BEGIN TRANSACTION');
                await db.run('DELETE FROM event_attachments WHERE event_id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                await db.run('DELETE FROM proposal_events WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                await db.run('COMMIT');
                res.json({ ok: true });
            } catch (err) {
                await db.run('ROLLBACK');
                console.error('DELETE /events error:', err);
                res.status(500).json({ error: 'Erro ao excluir evento' });
            }
        });

        // --- EVENT ATTACHMENTS ---
        app.get('/api/events/:id/attachments', authMiddleware, async (req, res) => {
            try {
                const atts = await db.all('SELECT * FROM event_attachments WHERE event_id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json(atts);
            } catch (err) { res.status(500).json({ error: 'Erro ao buscar anexos do evento' }); }
        });

        app.post('/api/events/:id/attachments', authMiddleware, async (req, res) => {
            const { name, url, type } = req.body;
            console.log('[EVENT ATT] POST event_id:', req.params.id, 'tenant:', req.tenantId, 'name:', name);
            try {
                const result = await db.run('INSERT INTO event_attachments (tenant_id, event_id, name, url, type) VALUES (?, ?, ?, ?, ?)',
                    [req.tenantId, req.params.id, name, url, type]);
                console.log('[EVENT ATT] Inserted id:', result.lastID);
                res.json({ ok: true, id: result.lastID });
            } catch (err) {
                console.error('[EVENT ATT] Insert error:', err.message);
                res.status(500).json({ error: 'Erro ao salvar anexo do evento: ' + err.message });
            }
        });

        app.delete('/api/event-attachments/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM event_attachments WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) { res.status(500).json({ error: 'Erro ao remover anexo do evento' }); }
        });

        app.delete('/api/proposals/:id', authMiddleware, async (req, res) => {
            try {
                // Permission Check: Owner or Admin
                const proposal = await db.get('SELECT user_id FROM proposals WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                if (!proposal) return res.status(404).json({ error: 'Orçamento não encontrado' });
                
                const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'ADM';
                if (proposal.user_id !== req.user.id && !isAdmin) {
                    return res.status(403).json({ error: 'Acesso negado: Você não tem permissão para excluir este orçamento.' });
                }

                await db.run('DELETE FROM proposals WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao excluir orçamento' });
            }
        });

        app.post('/api/proposals/:id/publish', authMiddleware, async (req, res) => {
            try {
                const proposal = await db.get('SELECT id FROM proposals WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                if (!proposal) return res.status(404).json({ error: 'Orçamento não encontrado' });

                const token = Math.random().toString(36).substring(2, 8).toUpperCase();
                const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

                await db.run('UPDATE proposals SET presentation_token=?, presentation_token_expires=? WHERE id=? AND tenant_id=?',
                    [token, expires, req.params.id, req.tenantId]);

                const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                const host = req.headers.host;
                const link = `/presentation/view/${req.params.id}`;
                const expireDateStr = new Date(expires).toLocaleString('pt-BR');
                
                await db.run(
                    'INSERT INTO proposal_events (tenant_id, proposal_id, event_date, event_time, title, description, type, event_status, monitor, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [req.tenantId, req.params.id, new Date().toISOString().split('T')[0], new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}), 'Apresentação Publicada', `Link: ${link}\nToken de Acesso: ${token}\nExpira em: ${expireDateStr}`, 'Publicação', 'FECHADO', 0, req.user.id]
                );

                res.json({ token, link });
            } catch (err) {
                console.error("POST proposals publish error:", err);
                res.status(500).json({ error: 'Erro ao publicar orçamento' });
            }
        });

        app.post('/api/public/proposals/:id/verify-token', async (req, res) => {
            const { token } = req.body;
            try {
                const proposal = await db.get(`
                    SELECT p.id, p.tenant_id, p.budget_data, p.value, p.partner_id, p.presentation_token, p.presentation_token_expires, 
                           pt.name as partner_name, pt.commission_percentage as referrer_commission, t.logo_url, t.website, t.instagram, t.phone as tenant_phone,
                           u.name as creator_name, u.phone as creator_phone, u.email as creator_email
                    FROM proposals p
                    JOIN partners pt ON p.partner_id = pt.id
                    JOIN tenants t ON p.tenant_id = t.id
                    LEFT JOIN users u ON p.user_id = u.id
                    WHERE p.id=?`, [req.params.id]);

                if (!proposal) return res.status(404).json({ error: 'Orçamento não encontrado' });

                if (!proposal.presentation_token || proposal.presentation_token !== token.trim().toUpperCase()) {
                    return res.status(401).json({ error: 'Token inválido' });
                }

                if (new Date(proposal.presentation_token_expires) < new Date()) {
                    return res.status(401).json({ error: 'Token expirado' });
                }

                const payment_methods = await db.all('SELECT * FROM payment_methods WHERE tenant_id = ? ORDER BY id ASC', [proposal.tenant_id]);
                for (let method of payment_methods) {
                    method.conditions = await db.all('SELECT * FROM payment_conditions WHERE payment_method_id = ? AND tenant_id = ?', [method.id, proposal.tenant_id]);
                }

                const taxes = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "COMERCIAL_IMPOSTOS"', [proposal.tenant_id]);
                const markup = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "COMERCIAL_MARKUP"', [proposal.tenant_id]);
                const finance = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "COMERCIAL_CUSTOFINANCEIRO"', [proposal.tenant_id]);

                res.json({
                    id: proposal.id,
                    budget_data: proposal.budget_data,
                    value: proposal.value,
                    partner_name: proposal.partner_name,
                    expires: proposal.presentation_token_expires,
                    tenant: {
                        logo_url: proposal.logo_url,
                        website: proposal.website,
                        instagram: proposal.instagram,
                        phone: proposal.tenant_phone
                    },
                    creator: {
                        name: proposal.creator_name,
                        phone: proposal.creator_phone,
                        email: proposal.creator_email
                    },
                    settings: {
                        taxes: taxes ? parseFloat(taxes.value) : 0,
                        markup: markup ? parseFloat(markup.value) : 0,
                        financeCost: finance ? parseFloat(finance.value) : 0,
                        comm: proposal.referrer_commission ? parseFloat(proposal.referrer_commission) : 0
                    },
                    payment_methods
                });
            } catch (err) {
                console.error("POST public verify token error:", err);
                res.status(500).json({ error: 'Erro interno no servidor' });
            }
        });

        app.post('/api/public/proposals/:id/submit-feedback', async (req, res) => {
            const { token, action, budget_data, payment_methods, payment_notes } = req.body;
            try {
                const proposal = await db.get('SELECT id, presentation_token, presentation_token_expires, tenant_id FROM proposals WHERE id=?', [req.params.id]);

                if (!proposal) return res.status(404).json({ error: 'Orçamento não encontrado' });
                if (!proposal.presentation_token || proposal.presentation_token !== token.trim().toUpperCase()) {
                    return res.status(401).json({ error: 'Token inválido' });
                }
                if (new Date(proposal.presentation_token_expires) < new Date()) {
                    return res.status(401).json({ error: 'Token expirado' });
                }

                await db.run('BEGIN TRANSACTION');

                if (action === 'Aprovar') {
                    // Update budget_data and clear token
                    await db.run('UPDATE proposals SET budget_data=?, presentation_token=NULL, presentation_token_expires=NULL WHERE id=?',
                        [budget_data, req.params.id]);
                } else if (action === 'Revisar') {
                    // Update budget_data and clear token, then update status
                    await db.run('UPDATE proposals SET budget_data=?, presentation_token=NULL, presentation_token_expires=NULL, status=? WHERE id=?',
                        [budget_data, 'REVISAR', req.params.id]);
                    
                    // Generate an event for the user
                    await db.run(
                        'INSERT INTO proposal_events (tenant_id, proposal_id, event_date, event_time, title, description, type, event_status, monitor, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [proposal.tenant_id, req.params.id, new Date().toISOString().split('T')[0], '12:00', 'Revisão Solicitada pelo Cliente', 'O cliente adicionou anotações à apresentação e solicitou uma revisão.', 'Tarefa', 'ABERTO', 1, null]
                    );
                }

                await db.run('COMMIT');
                res.json({ ok: true });
            } catch (err) {
                await db.run('ROLLBACK');
                console.error("POST public submit feedback error:", err);
                res.status(500).json({ error: 'Erro interno no servidor' });
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

        // --- PAYMENT METHODS ---
        app.get('/api/payment-methods', authMiddleware, async (req, res) => {
            try {
                const methods = await db.all('SELECT * FROM payment_methods WHERE tenant_id = ? ORDER BY name ASC', [req.tenantId]);
                for (let method of methods) {
                    method.conditions = await db.all('SELECT * FROM payment_conditions WHERE payment_method_id = ? AND tenant_id = ?', [method.id, req.tenantId]);
                }
                res.json(methods);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar formas de pagamento' });
            }
        });

        app.post('/api/payment-methods', authMiddleware, async (req, res) => {
            const { name, active } = req.body;
            try {
                const result = await db.run('INSERT INTO payment_methods (tenant_id, name, active) VALUES (?, ?, ?)',
                    [req.tenantId, name, active ?? 1]);
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao criar forma de pagamento' });
            }
        });

        app.put('/api/payment-methods/:id', authMiddleware, async (req, res) => {
            const { name, active } = req.body;
            try {
                await db.run('UPDATE payment_methods SET name=?, active=? WHERE id=? AND tenant_id=?',
                    [name, active, req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao atualizar forma de pagamento' });
            }
        });

        app.delete('/api/payment-methods/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM payment_methods WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao excluir forma de pagamento' });
            }
        });

        // --- PAYMENT CONDITIONS ---
        app.post('/api/payment-conditions', authMiddleware, async (req, res) => {
            const { payment_method_id, title, discount_percentage, finance_cost_percentage, installments, down_payment_percentage } = req.body;
            try {
                const result = await db.run(
                    'INSERT INTO payment_conditions (tenant_id, payment_method_id, title, discount_percentage, finance_cost_percentage, installments, down_payment_percentage) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [req.tenantId, payment_method_id, title, discount_percentage || 0, finance_cost_percentage || 0, installments !== undefined ? installments : 1, down_payment_percentage || 0]
                );
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao criar condição de pagamento' });
            }
        });

        app.put('/api/payment-conditions/:id', authMiddleware, async (req, res) => {
            const { title, discount_percentage, finance_cost_percentage, installments, down_payment_percentage } = req.body;
            try {
                await db.run(
                    'UPDATE payment_conditions SET title=?, discount_percentage=?, finance_cost_percentage=?, installments=?, down_payment_percentage=? WHERE id=? AND tenant_id=?',
                    [title, discount_percentage, finance_cost_percentage || 0, installments !== undefined ? installments : 1, down_payment_percentage, req.params.id, req.tenantId]
                );
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao atualizar condição de pagamento' });
            }
        });

        app.delete('/api/payment-conditions/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM payment_conditions WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao excluir condição de pagamento' });
            }
        });

        // --- SECURITY (TENANTS & USERS) ---
        app.get('/api/security/tenants', authMiddleware, async (req, res) => {
            if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
            try {
                const tenants = await db.all('SELECT id, name, cnpj as document, logo_url, active, website, instagram, phone, address_cep, address, address_num, address_complement, address_neighborhood, address_city, address_state, created_at FROM tenants ORDER BY id ASC');
                res.json(tenants);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar contas' });
            }
        });

        app.post('/api/security/tenants', authMiddleware, async (req, res) => {
            if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
            const { name, document, logo_url, website, instagram, phone, address_cep, address, address_num, address_complement, address_neighborhood, address_city, address_state } = req.body;
            try {
                const result = await db.run(
                    `INSERT INTO tenants (name, cnpj, logo_url, website, instagram, phone, address_cep, address, address_num, address_complement, address_neighborhood, address_city, address_state) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                    [name, document, logo_url, website || null, instagram || null, phone || null, address_cep || null, address || null, address_num || null, address_complement || null, address_neighborhood || null, address_city || null, address_state || null]
                );
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                console.error("Erro no POST /api/security/tenants:", err);
                res.status(500).json({ error: 'Erro ao criar conta' });
            }
        });

        app.put('/api/security/tenants/:id', authMiddleware, async (req, res) => {
            if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
            const { name, document, logo_url, active, website, instagram, phone, address_cep, address, address_num, address_complement, address_neighborhood, address_city, address_state } = req.body;
            try {
                await db.run(
                    `UPDATE tenants SET name=?, cnpj=?, logo_url=?, active=?, website=?, instagram=?, phone=?, address_cep=?, address=?, address_num=?, address_complement=?, address_neighborhood=?, address_city=?, address_state=? 
                     WHERE id=?`, 
                    [name, document, logo_url, active, website || null, instagram || null, phone || null, address_cep || null, address || null, address_num || null, address_complement || null, address_neighborhood || null, address_city || null, address_state || null, req.params.id]
                );
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
                    SELECT u.id, u.tenant_id, u.name, u.email, u.phone, u.active, u.role, t.name as tenant_name 
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
            const { tenant_id, name, email, password, role, phone } = req.body;
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                const result = await db.run(
                    'INSERT INTO users (tenant_id, name, email, password, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
                    [tenant_id, name, email, hashedPassword, role || 'USER', phone || null]
                );
                res.status(201).json({ id: result.lastID });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao criar usuário' });
            }
        });

        // --- SETTINGS (alias for BudgetModal / ProposalCompletionModal) ---
        app.get('/api/settings', authMiddleware, async (req, res) => {
            try {
                const taxes      = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "COMERCIAL_IMPOSTOS"', [req.tenantId]);
                const markup     = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "COMERCIAL_MARKUP"',   [req.tenantId]);
                const finance    = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "COMERCIAL_CUSTOFINANCEIRO"', [req.tenantId]);
                const entrega    = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "FABRICA_PRAZO_ENTREGA"', [req.tenantId]);
                const montagem   = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "FABRICA_PRAZO_MONTAGEM"', [req.tenantId]);
                const tenant     = await db.get('SELECT name, cnpj, logo_url, website, instagram, phone FROM tenants WHERE id = ?', [req.tenantId]);
                res.json({
                    taxes:       taxes      ? parseFloat(taxes.value)              : 0,
                    markup:      markup     ? parseFloat(markup.value)             : 0,
                    financeCost: finance    ? parseFloat(finance.value)            : 0,
                    entrega:     entrega    ? entrega.value                        : '45 (quarenta e cinco) dias úteis',
                    montagem:    montagem   ? montagem.value                       : '20 (vinte) dias úteis',
                    tenant:      tenant     || null
                });
            } catch (err) {
                console.error('GET /settings error:', err);
                res.status(500).json({ error: 'Erro ao buscar configurações' });
            }
        });

        // --- TENANT PARAMETERS ---
        app.get('/api/parameters', authMiddleware, async (req, res) => {
            try {
                const params = await db.all('SELECT * FROM tenant_parameters WHERE tenant_id = ? ORDER BY key ASC', [req.tenantId]);
                res.json(params);
            } catch (err) {
                res.status(500).json({ error: 'Erro ao buscar parâmetros' });
            }
        });

        app.post('/api/parameters', authMiddleware, async (req, res) => {
            const { key, type, value, description } = req.body;
            try {
                // Upsert logic
                const existing = await db.get('SELECT id FROM tenant_parameters WHERE tenant_id = ? AND key = ?', [req.tenantId, key]);
                if (existing) {
                    await db.run(
                        'UPDATE tenant_parameters SET type=?, value=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
                        [type, value, description, existing.id]
                    );
                    res.json({ id: existing.id, updated: true });
                } else {
                    const result = await db.run(
                        'INSERT INTO tenant_parameters (tenant_id, key, type, value, description) VALUES (?, ?, ?, ?, ?)',
                        [req.tenantId, key, type, value, description]
                    );
                    res.status(201).json({ id: result.lastID, created: true });
                }
            } catch (err) {
                console.error("Erro no POST /api/parameters:", err);
                res.status(500).json({ error: 'Erro ao salvar parâmetro' });
            }
        });

        app.delete('/api/parameters/:id', authMiddleware, async (req, res) => {
            try {
                await db.run('DELETE FROM tenant_parameters WHERE id=? AND tenant_id=?', [req.params.id, req.tenantId]);
                res.json({ ok: true });
            } catch (err) {
                res.status(500).json({ error: 'Erro ao excluir parâmetro' });
            }
        });

        app.put('/api/security/users/:id', authMiddleware, async (req, res) => {
            if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
            const { tenant_id, name, email, password, role, active, phone } = req.body;
            try {
                if (password && password.trim() !== '') {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    await db.run(
                        'UPDATE users SET tenant_id=?, name=?, email=?, password=?, role=?, active=?, phone=? WHERE id=?',
                        [tenant_id, name, email, hashedPassword, role, active, phone || null, req.params.id]
                    );
                } else {
                    await db.run(
                        'UPDATE users SET tenant_id=?, name=?, email=?, role=?, active=?, phone=? WHERE id=?',
                        [tenant_id, name, email, role, active, phone || null, req.params.id]
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
