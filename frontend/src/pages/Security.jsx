import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Building2, Users, Plus, Edit3, Check, X, Shield, Camera } from 'lucide-react';
import { maskPhone, maskCEP } from '../utils/masks';

const Security = () => {
    const [tenants, setTenants] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [loading, setLoading] = useState(true);

    const [tenantForm, setTenantForm] = useState(null);
    const [userForm, setUserForm] = useState(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingSignature, setUploadingSignature] = useState(false);
    const fileInputRef = useRef(null);
    const signatureFileInputRef = useRef(null);

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

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingLogo(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setTenantForm({ ...tenantForm, logo_url: response.data.url });
        } catch (err) {
            alert('Erro no upload da logomarca.');
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleSignatureUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingSignature(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUserForm(prev => ({ ...prev, signature_url: response.data.url }));
        } catch (err) {
            alert('Erro no upload da assinatura.');
        } finally {
            setUploadingSignature(false);
        }
    };

    const handleCepChange = async (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) val = val.substring(0, 5) + '-' + val.substring(5, 8);
        setTenantForm(prev => ({ ...prev, address_cep: val }));

        if (val.replace(/\D/g, '').length === 8) {
            try {
                const res = await fetch(`https://viacep.com.br/ws/${val.replace(/\D/g, '')}/json/`);
                const data = await res.json();
                if (!data.erro) {
                    setTenantForm(prev => ({
                        ...prev,
                        address: data.logradouro || '',
                        address_neighborhood: data.bairro || '',
                        address_city: data.localidade || '',
                        address_state: data.uf || '',
                    }));
                    setTimeout(() => document.getElementById('tenant_address_num_input')?.focus(), 100);
                }
            } catch (err) {
                console.error("Erro ao buscar CEP", err);
            }
        }
    };

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
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Contas e Usuários</h2>
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
                        <button className="btn-premium" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setTenantForm({ name: '', document: '', logo_url: '', active: 1, website: '', instagram: '', phone: '', address_cep: '', address: '', address_num: '', address_complement: '', address_neighborhood: '', address_city: '', address_state: '' })}>
                            <Plus size={16} /> Nova
                        </button>
                    </div>

                    {tenantForm && (
                        <form onSubmit={saveTenant} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            <h4 style={{ marginBottom: '1rem' }}>{tenantForm.id ? 'Editar Conta' : 'Nova Conta'}</h4>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1rem', marginBottom: '1rem' }}>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label>Nome da Empresa *</label>
                                    <input value={tenantForm.name} onChange={e => setTenantForm({...tenantForm, name: e.target.value})} required style={{ marginBottom: 0 }} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label>Documento (CNPJ/CPF)</label>
                                    <input value={tenantForm.document || ''} onChange={e => setTenantForm({...tenantForm, document: e.target.value})} style={{ marginBottom: 0 }} />
                                </div>
                                <div>
                                    <label>Site</label>
                                    <input value={tenantForm.website || ''} onChange={e => setTenantForm({...tenantForm, website: e.target.value})} placeholder="www.empresa.com" style={{ marginBottom: 0 }} />
                                </div>
                                <div>
                                    <label>Instagram</label>
                                    <input value={tenantForm.instagram || ''} onChange={e => setTenantForm({...tenantForm, instagram: e.target.value})} placeholder="@empresa" style={{ marginBottom: 0 }} />
                                </div>
                                <div>
                                    <label>Telefone</label>
                                    <input value={tenantForm.phone || ''} onChange={e => setTenantForm({...tenantForm, phone: maskPhone(e.target.value)})} maxLength="15" placeholder="(00) 00000-0000" style={{ marginBottom: 0 }} />
                                </div>
                                <div>
                                    <label>CEP</label>
                                    <input value={tenantForm.address_cep || ''} onChange={handleCepChange} maxLength="9" placeholder="00000-000" style={{ marginBottom: 0 }} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label>Logradouro / Endereço</label>
                                    <input value={tenantForm.address || ''} onChange={e => setTenantForm({...tenantForm, address: e.target.value})} style={{ marginBottom: 0 }} />
                                </div>
                                <div>
                                    <label>Número</label>
                                    <input id="tenant_address_num_input" value={tenantForm.address_num || ''} onChange={e => setTenantForm({...tenantForm, address_num: e.target.value})} style={{ marginBottom: 0 }} />
                                </div>
                                <div>
                                    <label>Complemento</label>
                                    <input value={tenantForm.address_complement || ''} onChange={e => setTenantForm({...tenantForm, address_complement: e.target.value})} style={{ marginBottom: 0 }} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label>Bairro</label>
                                    <input value={tenantForm.address_neighborhood || ''} onChange={e => setTenantForm({...tenantForm, address_neighborhood: e.target.value})} style={{ marginBottom: 0 }} />
                                </div>
                                <div>
                                    <label>Cidade</label>
                                    <input value={tenantForm.address_city || ''} onChange={e => setTenantForm({...tenantForm, address_city: e.target.value})} style={{ marginBottom: 0 }} />
                                </div>
                                <div>
                                    <label>Estado / UF</label>
                                    <input value={tenantForm.address_state || ''} onChange={e => setTenantForm({...tenantForm, address_state: e.target.value})} maxLength="2" placeholder="UF" style={{ marginBottom: 0 }} />
                                </div>
                            </div>

                            <label>Logomarca (Imagem)</label>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '1rem' }}>
                                <input 
                                    value={tenantForm.logo_url || ''} 
                                    onChange={e => setTenantForm({...tenantForm, logo_url: e.target.value})} 
                                    placeholder="URL ou Upload..." 
                                    style={{ marginBottom: 0 }}
                                />
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    style={{ display: 'none' }} 
                                    onChange={handleLogoUpload} 
                                    accept="image/*"
                                />
                                <button 
                                    type="button" 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="btn-premium"
                                    style={{ padding: '8px', minWidth: '40px' }}
                                    disabled={uploadingLogo}
                                >
                                    {uploadingLogo ? '...' : <Camera size={18} />}
                                </button>
                            </div>
                            
                            {tenantForm.logo_url && (
                                <div style={{ marginBottom: '1rem', textAlign: 'center', position: 'relative' }}>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Prévia:</p>
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                        <img src={tenantForm.logo_url} alt="Logo Preview" style={{ maxWidth: '150px', maxHeight: '80px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '8px', background: '#fff', padding: '5px' }} />
                                        <button 
                                            type="button" 
                                            onClick={() => setTenantForm({...tenantForm, logo_url: ''})}
                                            style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                            
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {t.logo_url ? (
                                            <img src={t.logo_url} alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain', background: '#fff', borderRadius: '4px' }} />
                                        ) : (
                                            <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}><Building2 size={16} /></div>
                                        )}
                                        <div>
                                            <strong style={{ display: 'block' }}>{t.name}</strong>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.id} {t.document ? `| Doc: ${t.document}` : ''}{t.phone ? ` | Tel: ${t.phone}` : ''}</span>
                                        </div>
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
                                <button className="btn-premium" style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#10b981' }} onClick={() => setUserForm({ tenant_id: selectedTenant.id, name: '', email: '', phone: '', password: '', role: 'USER', active: 1, signature_url: '' })}>
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
                                        <label>Telefone</label>
                                        <input value={userForm.phone || ''} onChange={e => setUserForm({...userForm, phone: maskPhone(e.target.value)})} maxLength="15" placeholder="(00) 00000-0000" />
                                    </div>
                                    <div>
                                        <label>Papel (Permissão)</label>
                                        <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                                            <option value="USER">Usuário Padrão</option>
                                            <option value="ADMIN">Administrador (Admin da Conta)</option>
                                        </select>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label>{userForm.id ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha de Acesso'}</label>
                                        <input type="password" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} required={!userForm.id} />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label>Imagem da Assinatura</label>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <input 
                                                value={userForm.signature_url || ''} 
                                                onChange={e => setUserForm({...userForm, signature_url: e.target.value})} 
                                                placeholder="URL ou Upload..." 
                                                style={{ marginBottom: 0 }}
                                            />
                                            <input 
                                                type="file" 
                                                ref={signatureFileInputRef} 
                                                style={{ display: 'none' }} 
                                                onChange={handleSignatureUpload} 
                                                accept="image/*"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => signatureFileInputRef.current?.click()}
                                                className="btn-premium"
                                                style={{ padding: '8px', minWidth: '40px', background: '#10b981' }}
                                                disabled={uploadingSignature}
                                            >
                                                {uploadingSignature ? '...' : <Camera size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    {userForm.signature_url && (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', position: 'relative', marginTop: '5px' }}>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Prévia da Assinatura:</p>
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <img src={userForm.signature_url} alt="Signature Preview" style={{ maxWidth: '200px', maxHeight: '60px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '8px', background: '#fff', padding: '5px' }} />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setUserForm({...userForm, signature_url: ''})}
                                                    style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

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
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}{u.phone ? ` | Tel: ${u.phone}` : ''}</span>
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
