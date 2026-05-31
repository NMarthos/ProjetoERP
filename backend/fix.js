const fs = require('fs');
let code = fs.readFileSync('src/server.js', 'utf8');

// 1. Settings maxFinance
const settingsOld = `const maxFinance = await db.get('SELECT MAX(finance_cost_percentage) as max_val FROM payment_conditions WHERE tenant_id = ?', [req.tenantId]);`;
const settingsNew = `// financeCost is global 0`;
code = code.replace(settingsOld, settingsNew);
code = code.replace(/financeCost:\s*maxFinance\s*\?\s*parseFloat\(maxFinance\.max_val\s*\|\|\s*0\)\s*:\s*0,/, 'financeCost: 0, // Regra global: nao repassar o maior custo financeiro para o preco base,');

// 2. verify-token SELECT
code = code.replace(
    'SELECT p.id, p.budget_data, p.partner_id, p.presentation_token, p.presentation_token_expires, \r\n                           pt.name as partner_name, t.logo_url, t.website, t.instagram, t.phone as tenant_phone,\r\n                           u.name as creator_name, u.phone as creator_phone, u.email as creator_email',
    'SELECT p.id, p.tenant_id, p.budget_data, p.partner_id, p.presentation_token, p.presentation_token_expires, \r\n                           pt.name as partner_name, pt.commission_percentage as referrer_commission, t.logo_url, t.website, t.instagram, t.phone as tenant_phone,\r\n                           u.name as creator_name, u.phone as creator_phone, u.email as creator_email'
);
code = code.replace(
    'SELECT p.id, p.budget_data, p.partner_id, p.presentation_token, p.presentation_token_expires, \n                           pt.name as partner_name, t.logo_url, t.website, t.instagram, t.phone as tenant_phone,\n                           u.name as creator_name, u.phone as creator_phone, u.email as creator_email',
    'SELECT p.id, p.tenant_id, p.budget_data, p.partner_id, p.presentation_token, p.presentation_token_expires, \n                           pt.name as partner_name, pt.commission_percentage as referrer_commission, t.logo_url, t.website, t.instagram, t.phone as tenant_phone,\n                           u.name as creator_name, u.phone as creator_phone, u.email as creator_email'
);

// 3. verify-token Response
const jsonOldStart = '                res.json({\r\n                    id: proposal.id,\r\n                    budget_data: proposal.budget_data,';
const jsonOldStartN = '                res.json({\n                    id: proposal.id,\n                    budget_data: proposal.budget_data,';

let idx = code.indexOf(jsonOldStart);
let isRn = true;
if (idx === -1) {
    idx = code.indexOf(jsonOldStartN);
    isRn = false;
}
if (idx !== -1) {
    const end = code.indexOf('                });', idx) + 19;
    const oldBlock = code.substring(idx, end);
    const nl = isRn ? '\r\n' : '\n';
    const newBlock = `                const payment_methods = await db.all('SELECT * FROM payment_methods WHERE tenant_id = ? ORDER BY id ASC', [proposal.tenant_id]);${nl}                for (let method of payment_methods) {${nl}                    method.conditions = await db.all('SELECT * FROM payment_conditions WHERE payment_method_id = ? AND tenant_id = ?', [method.id, proposal.tenant_id]);${nl}                }${nl}${nl}                const taxes = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "COMERCIAL_IMPOSTOS"', [proposal.tenant_id]);${nl}                const markup = await db.get('SELECT value FROM tenant_parameters WHERE tenant_id = ? AND key = "COMERCIAL_MARKUP"', [proposal.tenant_id]);${nl}${nl}                res.json({${nl}                    id: proposal.id,${nl}                    budget_data: proposal.budget_data,${nl}                    partner_name: proposal.partner_name,${nl}                    expires: proposal.presentation_token_expires,${nl}                    tenant: {${nl}                        logo_url: proposal.logo_url,${nl}                        website: proposal.website,${nl}                        instagram: proposal.instagram,${nl}                        phone: proposal.tenant_phone${nl}                    },${nl}                    creator: {${nl}                        name: proposal.creator_name,${nl}                        phone: proposal.creator_phone,${nl}                        email: proposal.creator_email${nl}                    },${nl}                    settings: {${nl}                        taxes: taxes ? parseFloat(taxes.value) : 0,${nl}                        markup: markup ? parseFloat(markup.value) : 0,${nl}                        comm: proposal.referrer_commission ? parseFloat(proposal.referrer_commission) : 0${nl}                    },${nl}                    payment_methods${nl}                });`;
    code = code.replace(oldBlock, newBlock);
}

// 4. submit-feedback
code = code.replace('const { token, action, budget_data } = req.body;', 'const { token, action, budget_data, payment_methods, payment_notes } = req.body;');
code = code.replace(
    "await db.run('UPDATE proposals SET status = ?, budget_data = ? WHERE id = ?', [newStatus, budget_data || proposal.budget_data, req.params.id]);",
    "await db.run('UPDATE proposals SET status = ?, budget_data = ?, payment_methods = ?, payment_notes = ? WHERE id = ?', [newStatus, budget_data || proposal.budget_data, payment_methods ? JSON.stringify(payment_methods) : null, payment_notes || null, req.params.id]);"
);

fs.writeFileSync('src/server.js', code);
console.log('REPLACED SUCCESSFULLY');
