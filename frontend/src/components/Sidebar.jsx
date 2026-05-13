import React, { useState } from 'react';
import { LayoutDashboard, Users, Factory, Wallet, Settings, LogOut, ChevronDown, ChevronRight, UserPlus, Package, Shield, Building2, FileText, TrendingUp, ClipboardList } from 'lucide-react';

const Sidebar = ({ user, onLogout, setView, currentView }) => {
    const [geralOpen, setGeralOpen] = useState(true);
    const [comercialOpen, setComercialOpen] = useState(true);
    const [fabOpen, setFabOpen] = useState(false);
    const [secOpen, setSecOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);

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
                { icon: <Package size={18} />, label: 'Produtos e Serviços', module: 'M_PROD' },
                { icon: <Settings size={18} />, label: 'Parâmetros da Empresa', module: 'M_PARAMS' }
            ]
        },
        { 
            label: 'Comercial', 
            icon: <Users size={20} />,
            isHeader: true,
            isOpen: comercialOpen,
            toggle: () => setComercialOpen(!comercialOpen),
            subItems: [
                { icon: <FileText size={18} />, label: 'Proposta', module: 'M1' },
                { icon: <Wallet size={18} />, label: 'Formas de Pagamento', module: 'M_PAYMENTS' }
            ]
        },
        { 
            label: 'Fábrica',
            icon: <Factory size={20} />,
            isHeader: true,
            isOpen: fabOpen,
            toggle: () => setFabOpen(!fabOpen),
            subItems: [
                { icon: <ClipboardList size={18} />, label: 'Ordens de Produção', module: 'M_ORDERS' },
            ]
        },
        { 
            label: 'Administrativo', 
            icon: <Wallet size={20} />,
            isHeader: true,
            isOpen: adminOpen,
            toggle: () => setAdminOpen(!adminOpen),
            subItems: [
                { icon: <TrendingUp size={18} />, label: 'Fluxo de Caixa', module: 'M_CASHFLOW' },
            ]
        },
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
            <div style={{ marginBottom: '2.5rem', padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', margin: '0 1rem 2rem' }}>
                {user?.logo_url ? (
                    <img src={user.logo_url} alt="Logo Empresa" style={{ maxWidth: '100%', maxHeight: '60px', objectFit: 'contain', marginBottom: '10px' }} />
                ) : (
                    <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: '800', margin: 0 }}>ERP MÓVEIS</h2>
                )}
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '8px' }}>Empresa #{user.tenantId}</p>
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

            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '38px', height: '38px', borderRadius: '50%', 
                        background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '1.1rem', textTransform: 'uppercase',
                        boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
                    }}>
                        {user?.name ? user.name.charAt(0) : 'U'}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user?.name || 'Usuário'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {user?.role === 'ADMIN' ? 'Administrador' : (user?.role || 'Usuário')}
                        </div>
                    </div>
                </div>

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
                        borderRadius: '8px',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <LogOut size={20} />
                    <span>Sair do Sistema</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
