import React, { useState } from 'react';
import { LayoutDashboard, Users, Factory, Wallet, Settings, LogOut, ChevronDown, ChevronRight, UserPlus, Package, Shield, Building2 } from 'lucide-react';

const Sidebar = ({ user, onLogout, setView, currentView }) => {
    const [geralOpen, setGeralOpen] = useState(true);
    const [secOpen, setSecOpen] = useState(false);

    const menuItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', module: 'dashboard' },
        { 
            label: 'Geral', 
            icon: <Settings size={20} />,
            isHeader: true,
            isOpen: geralOpen,
            toggle: () => setGeralOpen(!geralOpen),
            subItems: [
                { icon: <UserPlus size={18} />, label: 'Clientes', module: 'M0' },
                { icon: <Package size={18} />, label: 'Produtos e Serviços', module: 'M_PROD' }
            ]
        },
        { icon: <Users size={20} />, label: 'Comercial', module: 'M1' },
        { icon: <Factory size={20} />, label: 'Fábrica', module: 'M2' },
        { icon: <Wallet size={20} />, label: 'Administrativo', module: 'M3' },
    ];

    if (user?.role === 'ADMIN' || !user?.role) {
        menuItems.push({
            label: 'Segurança',
            icon: <Shield size={20} />,
            isHeader: true,
            isOpen: secOpen,
            toggle: () => setSecOpen(!secOpen),
            subItems: [
                { icon: <Building2 size={18} />, label: 'Contas e Usuários', module: 'M_SECURITY' }
            ]
        });
    }

    return (
        <aside className="sidebar">
            <div style={{ marginBottom: '2rem', padding: '0 1rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: '800' }}>ERP MÓVEIS</h2>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Empresa #{user.tenantId}</p>
            </div>

            <nav style={{ flex: 1 }}>
                {menuItems.map((item, index) => {
                    if (item.subItems) {
                        return (
                            <div key={index} style={{ marginBottom: '8px' }}>
                                <div 
                                    onClick={item.toggle}
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.9rem',
                                        fontWeight: '600'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </div>
                                    {item.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                                {item.isOpen && item.subItems.map((sub, sIndex) => (
                                    <div 
                                        key={sIndex}
                                        onClick={() => setView(sub.module)}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '12px', 
                                            padding: '10px 16px 10px 44px',
                                            cursor: 'pointer',
                                            borderRadius: '8px',
                                            fontSize: '0.875rem',
                                            color: sub.module === currentView ? 'var(--primary)' : 'var(--text-muted)',
                                            background: sub.module === currentView ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {sub.icon}
                                        <span>{sub.label}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    }

                    return (
                        <div 
                            key={index}
                            onClick={() => setView(item.module)}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '12px', 
                                padding: '12px 16px',
                                cursor: 'pointer',
                                borderRadius: '8px',
                                marginBottom: '4px',
                                fontWeight: '600',
                                color: item.module === currentView ? 'var(--primary)' : 'var(--text-muted)',
                                background: item.module === currentView ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </div>
                    );
                })}
            </nav>

            <div 
                onClick={onLogout}
                style={{ 
                    padding: '12px 16px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    color: '#ef4444',
                    fontWeight: '600',
                    borderTop: '1px solid var(--border)',
                    marginTop: '20px'
                }}
            >
                <LogOut size={20} />
                <span>Sair do Sistema</span>
            </div>
        </aside>
    );
};

export default Sidebar;
