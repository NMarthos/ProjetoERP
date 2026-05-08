import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Proposals from './pages/Proposals';
import ProductionOrders from './pages/ProductionOrders';
import Partners from './pages/Partners';
import Products from './pages/Products';
import Security from './pages/Security';
import './index.css';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState('dashboard');

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const handleLogin = (userData) => {
        setUser(userData);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    if (loading) return null;

    if (!user) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <div className="app-container">
            <Sidebar user={user} onLogout={handleLogout} setView={setCurrentView} currentView={currentView} />
            <main className="main-content">
                {currentView === 'dashboard' && (
                    <header style={{ marginBottom: '2rem' }}>
                        <h1>Bem-vindo, {user.name}</h1>
                    </header>
                )}

                {currentView === 'dashboard' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                        <div className="glass card">
                            <h3>Status do Sistema</h3>
                            <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>
                                Conectado ao módulo central. Todos os dados estão isolados para sua empresa.
                            </p>
                        </div>
                        
                        <div className="glass card">
                            <h3>Comercial</h3>
                            <button className="btn-premium" style={{ marginTop: '15px', width: '100%' }} onClick={() => setCurrentView('M1')}>
                                Ver Orçamentos
                            </button>
                        </div>
                        
                        <div className="glass card">
                            <h3>Log de Atividades</h3>
                            <p style={{ fontSize: '0.875rem', marginTop: '10px' }}>
                                <span style={{ color: '#10b981' }}>●</span> Login realizado hoje às 15:17
                            </p>
                        </div>
                    </div>
                ) : currentView === 'M0' ? (
                    <Partners />
                ) : currentView === 'M1' ? (
                    <Proposals />
                ) : currentView === 'M2' ? (
                    <ProductionOrders />
                ) : currentView === 'M_PROD' ? (
                    <Products />
                ) : currentView === 'M_SECURITY' ? (
                    <Security />
                ) : (
                    <div className="glass card">Selecione um módulo no menu lateral.</div>
                )}
            </main>
        </div>
    );
}

export default App;
