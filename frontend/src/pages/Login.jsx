import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:3001/api/login', { 
                email: email.trim(), 
                password: password.trim() 
            });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            onLogin(response.data.user);
        } catch (err) {
            console.error('[LOGIN ERROR]', err);
            if (err.response) {
                setError(err.response.data?.error || `Erro ${err.response.status}: Falha no login`);
            } else {
                setError(`Erro de rede ou servidor offline: ${err.message}`);
            }
        }
    };

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '100vh',
            background: 'radial-gradient(circle at top right, #1e1b4b, #0f172a)' 
        }}>
            <div className="glass card fade-in" style={{ width: '400px', padding: '2.5rem' }}>
                <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>ERP Móveis Planejados</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', textAlign: 'center' }}>
                    Acesse sua conta para gerenciar sua marcenaria
                </p>
                
                {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
                
                <form onSubmit={handleSubmit}>
                    <label>Email</label>
                    <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="seu@email.com"
                        required
                    />
                    
                    <label>Senha</label>
                    <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="••••••••"
                        required
                    />
                    
                    <button type="submit" className="btn-premium" style={{ width: '100%', marginTop: '1rem' }}>
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
