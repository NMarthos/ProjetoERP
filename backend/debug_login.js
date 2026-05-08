const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');

async function debug() {
    const db = await open({
        filename: './database/erp.db',
        driver: sqlite3.Database
    });

    console.log('\n=== USUÁRIOS NO BANCO ===');
    const users = await db.all('SELECT id, tenant_id, name, email, password FROM users');
    console.log(users);

    if (users.length === 0) {
        console.log('\n❌ NENHUM USUÁRIO ENCONTRADO! Criando agora...');
        const hash = await bcrypt.hash('admin123', 10);
        await db.run('INSERT INTO users (tenant_id, name, email, password) VALUES (?, ?, ?, ?)',
            [1, 'Admin', 'admin@exemplo.com.uk', hash]);
        console.log('✅ Usuário criado!');
    } else {
        console.log('\n=== TESTANDO SENHA admin123 ===');
        for (const user of users) {
            const match = await bcrypt.compare('admin123', user.password);
            console.log(`Email: ${user.email} | Senha bate? ${match ? '✅ SIM' : '❌ NÃO'}`);
            
            if (!match) {
                console.log(`\n🔧 Corrigindo senha do usuário ${user.email}...`);
                const newHash = await bcrypt.hash('admin123', 10);
                await db.run('UPDATE users SET password = ? WHERE id = ?', [newHash, user.id]);
                console.log('✅ Senha atualizada no banco!');
            }
        }
    }

    await db.close();
    console.log('\n=== FIM DO DIAGNÓSTICO ===\n');
}

debug().catch(console.error);
