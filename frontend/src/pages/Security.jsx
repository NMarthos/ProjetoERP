import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Building2, Users, Plus, Edit3, Check, X, Shield } from 'lucide-react';

const Security = () => {
    const [tenants, setTenants] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [loading, setLoading] = useState(true);

    const [tenantForm, setTenantForm] = useState(null);
    const [userForm, setUserForm] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tRes, uRes] = await Promise.all([
                api.get('/security/tenants'),
                api.get('/security/users')
            ]);
            setTenants(tRes.data);
            setUsers(uRes.data);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const saveTenant = async (e) => {
        e.preventDefault();
        try {
            if (tenantForm.id) {
                await api.put(`/security/tenants/${tenantForm.id}`, tenantForm);
            } else {
                await api.post('/security/tenants', tenantForm);
            }
            setTenantForm(null);
            fetchData();
        } catch (err) {
            alert('Erro ao salvar conta.');
        }
    };

    const saveUser = async (e) => {
        e.preventDefault();
        try {
            if (userForm.id) {
                await api.put(`/security/users/${userForm.id}`, userForm);
            } else {
                await api.post('/security/users', userForm);
            }
            setUserForm(null);
            fetchData();
        } catch (err) {
            alert('Erro ao salvar usuário.');
        }
    };

    const filteredUsers = selectedTenant ? users.filter(u => u.tenant_id === selectedTenant.id) : [];

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Segurança / Contas e Usuários</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Gerencie as empresas e as contas de acesso.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                
                {/* LADO ESQUERDO: CONTAS */}
                <div className="glass card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Building2 size={20} color="var(--primary)" />
                            <h3 style={{ margin: 0 }}>Contas (Empresas)</h3>
                        </div>
                        <button className="btn-premium" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setTenantForm({ name: '', document: '', active: 1 })}>
                            <Plus size={16} /> Nova
                        </button>
                    </div>

                    {tenantForm && (
                        <form onSubmit={saveTenant} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            <h4 style={{ marginBottom: '1rem' }}>{tenantForm.id ? 'Editar Conta' : 'Nova Conta'}</h4>
                            <label>Nome da Empresa</label>
                            <input value={tenantForm.name} onChange={e => setTenantForm({...tenantForm, name: e.target.value})} required />
                            <label>Documento (CNPJ/CPF)</label>
                            <input value={tenantForm.document || ''} onChange={e => setTenantForm({...tenantForm, document: e.target.value})} />
                            
                            {tenantForm.id && (
                                <>
                                    <label>Status</label>
                                    <select value={tenantForm.active} onChange={e => setTenantForm({...tenantForm, active: parseInt(e.target.value)})}>
                                        <option value={1}>Ativo</option>
                                        <option value={0}>Inativo</option>
                                    </select>
                                </>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setTenantForm(null)} style={{ flex: 1 }}>Cancelar</button>
                                <button type="submit" className="btn-premium" style={{ flex: 1 }}>Salvar</button>
                            </div>
                        </form>
                    )}

                    {loading ? <p>Carregando...</p> : (
                        <div className="scrollable-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {tenants.map(t => (
                                <div 
                                    key={t.id} 
                                    onClick={() => setSelectedTenant(t)}
                                    style={{ 
                                        padding: '12px', 
                                        borderRadius: '8px', 
                                        background: selectedTenant?.id === t.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                        border: `1px solid ${selectedTenant?.id === t.id ? 'var(--primary)' : 'transparent'}`,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div>
                                        <strong style={{ display: 'block' }}>{t.name}</strong>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.id} {t.document ? `| Doc: ${t.document}` : ''}</span>
                                    </div>
                                    <Edit3 size={16} color="var(--text-muted)" onClick={(e) => { e.stopPropagation(); setTenantForm(t); }} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* LADO DIREITO: USUÁRIOS */}
                <div className="glass card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    {!selectedTenant ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <Shield size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                            <h3>Selecione uma Conta</h3>
                            <p>Clique em uma empresa na lista ao lado para gerenciar seus usuários.</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Users size={20} color="#10b981" />
                                    <h3 style={{ margin: 0 }}>Usuários de {selectedTenant.name}</h3>
                                </div>
                                <button className="btn-premium" style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#10b981' }} onClick={() => setUserForm({ tenant_id: selectedTenant.id, name: '', email: '', password: '', role: 'USER', active: 1 })}>
                                    <Plus size={16} /> Novo Usuário
                                </button>
                            </div>

                            {userForm && (
                                <form onSubmit={saveUser} style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <h4 style={{ margin: 0 }}>{userForm.id ? 'Editar Usuário' : 'Novo Usuário'}</h4>
                                    </div>
                                    
                                    <div>
                                        <label>Nome Completo</label>
                                        <input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} required />
                                    </div>
                                    <div>
                                        <label>E-mail (Login)</label>
                                        <input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} required />
                                    </div>
                                    <div>
                                        <label>{userForm.id ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha de Acesso'}</label>
                                        <input type="password" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} required={!userForm.id} />
                                    </div>
                                    <div>
                                        <label>Papel (Permissão)</label>
                                        <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                                            <option value="USER">Usuário Padrão</option>
                                            <option value="ADMIN">Administrador (Admin da Conta)</option>
                                        </select>
                                    </div>
                                    {userForm.id && (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label>Status</label>
                                            <select value={userForm.active} onChange={e => setUserForm({...userForm, active: parseInt(e.target.value)})}>
                                                <option value={1}>Ativo</option>
                                                <option value={0}>Inativo / Bloqueado</option>
                                            </select>
                                        </div>
                                    )}

                                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <button type="button" onClick={() => setUserForm(null)} style={{ flex: 1 }}>Cancelar</button>
                                        <button type="submit" className="btn-premium" style={{ flex: 2, background: '#10b981' }}>Salvar Usuário</button>
                                    </div>
                                </form>
                            )}

                            <div className="scrollable-content" style={{ display: 'grid', gap: '10px' }}>
                                {filteredUsers.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)' }}>Nenhum usuário cadastrado nesta conta.</p>
                                ) : (
                                    filteredUsers.map(u => (
                                        <div key={u.id} style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <strong style={{ display: 'block', color: u.active ? '#fff' : 'var(--text-muted)' }}>
                                                    {u.name} {u.role === 'ADMIN' && <span style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>ADMIN</span>}
                                                    {!u.active && <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>INATIVO</span>}
                                                </strong>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</span>
                                            </div>
                                            <button className="btn-icon" onClick={() => setUserForm({ ...u, password: '' })} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                                                <Edit3 size={18} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
};

export default Security;
