import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Search, User, Mail, Phone, MapPin, Edit3, Trash2, X, Check, Filter, UserCheck } from 'lucide-react';
import { maskPhone, maskDocument } from '../utils/masks';
import { createPortal } from 'react-dom';

// ── Componente de Modal (Popup) ──────────────────────────────────────────────────
const maskCPF = (value) => {
    if (!value) return '';
    let v = value.replace(/\D/g, '');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return v.substring(0, 14);
};

const maskCNPJ = (value) => {
    if (!value) return '';
    let v = value.replace(/\D/g, '');
    v = v.replace(/^(\d{2})(\d)/, '$1.$2');
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
    return v.substring(0, 18);
};

export const PartnerModal = ({ partner, allPartners, initialTab = 'dados', onClose, onSave }) => {
    const [form, setForm] = useState({
        name: '', type: 'CLIENTE', document: '', email: '', phone: '',
        address: '', address_num: '', address_complement: '', address_neighborhood: '', address_cep: '', address_city: '', notes: '', referrer_id: '', commission_percentage: 0,
        person_type: 'F',
        delivery_address: '', delivery_address_num: '', delivery_address_complement: '', delivery_address_cep: '', delivery_address_city: '', delivery_address_neighborhood: ''
    });
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab === 'indicacao' ? 'dados' : initialTab);

    useEffect(() => {
        document.body.classList.add('body-no-scroll');
        return () => document.body.classList.remove('body-no-scroll');
    }, []);

    useEffect(() => {
        if (partner) {
            setForm(prev => ({
                ...prev,
                ...partner,
                person_type: partner.person_type || 'F',
                delivery_address: partner.delivery_address || '',
                delivery_address_num: partner.delivery_address_num || '',
                delivery_address_complement: partner.delivery_address_complement || '',
                delivery_address_cep: partner.delivery_address_cep || '',
                delivery_address_city: partner.delivery_address_city || '',
                delivery_address_neighborhood: partner.delivery_address_neighborhood || ''
            }));
            if (partner.id) {
                api.get(`/referrals?clientId=${partner.id}`).then(res => {
                    if (res.data && res.data.length > 0) {
                        setForm(f => ({ ...f, referrer_id: res.data[0].referrer_id }));
                    }
                }).catch(console.error);
            }
        }
    }, [partner]);

    const handleCepChange = async (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) val = val.substring(0, 5) + '-' + val.substring(5, 8);
        setForm(prev => ({ ...prev, address_cep: val }));

        if (val.replace(/\D/g, '').length === 8) {
            try {
                const res = await fetch(`https://viacep.com.br/ws/${val.replace(/\D/g, '')}/json/`);
                const data = await res.json();
                if (!data.erro) {
                    setForm(prev => ({
                        ...prev,
                        address: data.logradouro || '',
                        address_neighborhood: data.bairro || '',
                        address_city: `${data.localidade} - ${data.uf}`,
                    }));
                    setTimeout(() => document.getElementById('address_num_input')?.focus(), 100);
                }
            } catch (err) {
                console.error("Erro ao buscar CEP", err);
            }
        }
    };

    const handleDeliveryCepChange = async (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) val = val.substring(0, 5) + '-' + val.substring(5, 8);
        setForm(prev => ({ ...prev, delivery_address_cep: val }));

        if (val.replace(/\D/g, '').length === 8) {
            try {
                const res = await fetch(`https://viacep.com.br/ws/${val.replace(/\D/g, '')}/json/`);
                const data = await res.json();
                if (!data.erro) {
                    setForm(prev => ({
                        ...prev,
                        delivery_address: data.logradouro || '',
                        delivery_address_neighborhood: data.bairro || '',
                        delivery_address_city: `${data.localidade} - ${data.uf}`,
                    }));
                    setTimeout(() => document.getElementById('delivery_address_num_input')?.focus(), 100);
                }
            } catch (err) {
                console.error("Erro ao buscar CEP de entrega", err);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!form.name || form.name.trim() === '') {
            setActiveTab('dados');
            setTimeout(() => alert('O campo Nome Completo / Razão Social é obrigatório.'), 100);
            return;
        }

        setSaving(true);
        try {
            let newId = null;
            if (partner?.id) {
                await api.put(`/partners/${partner.id}`, form);
            } else {
                const res = await api.post('/partners', form);
                newId = res.data.id;
            }
            onSave(newId);
        } catch (err) { alert('Erro ao salvar parceiro'); }
        setSaving(false);    };

    return createPortal(
        <div className="modal-overlay">
            <div className="glass card modal-content" style={{ maxWidth: '600px' }}>
                <style>{`
                    .partner-form input, .partner-form select, .partner-form textarea {
                        margin-bottom: 0 !important;
                    }
                `}</style>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>{partner?.id ? 'Editar Registro' : 'Novo Parceiro'}</h3>
                    <button onClick={onClose} className="btn-icon"><X size={20} /></button>
                </div>

                {/* Navegação de Abas */}
                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                    <button 
                        type="button"
                        onClick={() => setActiveTab('dados')}
                        style={{ background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', color: activeTab === 'dados' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'dados' ? '2px solid var(--primary)' : 'none', fontWeight: '600' }}
                    >
                        Dados Principais
                    </button>
                    <button 
                        type="button"
                        onClick={() => setActiveTab('localizacao')}
                        style={{ background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', color: activeTab === 'localizacao' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'localizacao' ? '2px solid var(--primary)' : 'none', fontWeight: '600' }}
                    >
                        End. Residencial
                    </button>
                    <button 
                        type="button"
                        onClick={() => setActiveTab('entrega')}
                        style={{ background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', color: activeTab === 'entrega' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'entrega' ? '2px solid var(--primary)' : 'none', fontWeight: '600' }}
                    >
                        End. Entrega
                    </button>
                </div>

                <form className="partner-form" onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1rem' }}>
                    
                    {/* Aba: Dados Principais */}
                    {activeTab === 'dados' && (
                        <>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label>Nome Completo / Razão Social *</label>
                                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                            </div>
                            <div>
                                <label>Tipo de Parceiro</label>
                                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                                    <option value="CLIENTE">Cliente</option>
                                    <option value="ARQUITETO">Arquiteto</option>
                                    <option value="CORRETOR">Corretor</option>
                                    <option value="FORNECEDOR">Fornecedor</option>
                                    <option value="OUTRO">Outro</option>
                                </select>
                            </div>
                            <div>
                                <label>Tipo de Pessoa</label>
                                <select value={form.person_type} onChange={e => setForm({...form, person_type: e.target.value, document: ''})}>
                                    <option value="F">Física</option>
                                    <option value="J">Jurídica</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label>{form.person_type === 'J' ? 'CNPJ *' : 'CPF *'}</label>
                                <input 
                                    value={form.document} 
                                    onChange={e => setForm({...form, document: form.person_type === 'J' ? maskCNPJ(e.target.value) : maskCPF(e.target.value)})} 
                                    maxLength={form.person_type === 'J' ? "18" : "14"} 
                                    placeholder={form.person_type === 'J' ? "00.000.000/0000-00" : "000.000.000-00"}
                                />
                            </div>
                            <div>
                                <label>E-mail</label>
                                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                            </div>
                            <div>
                                <label>Telefone</label>
                                <input value={form.phone} onChange={e => setForm({...form, phone: maskPhone(e.target.value)})} maxLength="15" />
                            </div>
                            <div>
                                <label>% Comissão</label>
                                <input type="number" step="0.01" value={form.commission_percentage} onChange={e => setForm({...form, commission_percentage: e.target.value})} placeholder="0.00" />
                            </div>
                            {form.type === 'CLIENTE' && (
                                <div style={{ gridColumn: '1 / -1', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '8px' }}>
                                    <label style={{ color: '#10b981' }}>Este cliente foi indicado por alguém?</label>
                                    <select value={form.referrer_id || ''} onChange={e => setForm({...form, referrer_id: e.target.value})}>
                                        <option value="">Ninguém (Cadastro direto)</option>
                                        {allPartners && allPartners.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </>
                    )}

                    {/* Aba: End. Residencial */}
                    {activeTab === 'localizacao' && (
                        <>
                            <div>
                                <label>CEP</label>
                                <input value={form.address_cep} onChange={handleCepChange} maxLength="9" placeholder="00000-000" />
                            </div>
                            <div>
                                <label>Cidade</label>
                                <input value={form.address_city} onChange={e => setForm({...form, address_city: e.target.value})} />
                            </div>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 2 }}>
                                    <label>Endereço / Logradouro</label>
                                    <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Bairro</label>
                                    <input value={form.address_neighborhood || ''} onChange={e => setForm({...form, address_neighborhood: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label>Número</label>
                                <input id="address_num_input" value={form.address_num} onChange={e => setForm({...form, address_num: e.target.value})} />
                            </div>
                            <div>
                                <label>Complemento</label>
                                <input value={form.address_complement} onChange={e => setForm({...form, address_complement: e.target.value})} />
                            </div>
                        </>
                    )}

                    {/* Aba: End. Entrega */}
                    {activeTab === 'entrega' && (
                        <>
                            <div>
                                <label>CEP de Entrega</label>
                                <input value={form.delivery_address_cep} onChange={handleDeliveryCepChange} maxLength="9" placeholder="00000-000" />
                            </div>
                            <div>
                                <label>Cidade de Entrega</label>
                                <input value={form.delivery_address_city} onChange={e => setForm({...form, delivery_address_city: e.target.value})} />
                            </div>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 2 }}>
                                    <label>Endereço / Logradouro</label>
                                    <input value={form.delivery_address} onChange={e => setForm({...form, delivery_address: e.target.value})} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Bairro</label>
                                    <input value={form.delivery_address_neighborhood || ''} onChange={e => setForm({...form, delivery_address_neighborhood: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label>Número</label>
                                <input id="delivery_address_num_input" value={form.delivery_address_num} onChange={e => setForm({...form, delivery_address_num: e.target.value})} />
                            </div>
                            <div>
                                <label>Complemento</label>
                                <input value={form.delivery_address_complement} onChange={e => setForm({...form, delivery_address_complement: e.target.value})} />
                            </div>
                        </>
                    )}

                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button type="button" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
                        <button type="submit" className="btn-premium" style={{ flex: 2 }} disabled={saving}>
                            {saving ? 'Salvando...' : 'Salvar Registro'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

// ── Página Principal ─────────────────────────────────────────────────────────
const Partners = () => {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('TODOS');
    const [modal, setModal] = useState({ show: false, data: null, tab: 'dados' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const r = await api.get('/partners');
            setPartners(r.data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const filtered = partners.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) && 
        (filterType === 'TODOS' || p.type === filterType)
    );

    return (
        <div className="fade-in">

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Clientes</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Gerencie seus clientes e parceiros.</p>
                </div>
                <button className="btn-premium" onClick={() => setModal({ show: true, data: null, tab: 'dados' })}>
                    <Plus size={20} /> Novo Parceiro
                </button>
            </div>

            <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                        <input placeholder="Buscar..." style={{ paddingLeft: '40px', marginBottom: 0 }} value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: '200px', marginBottom: 0 }}>
                        <option value="TODOS">Todos</option>
                        <option value="CLIENTE">Clientes</option>
                        <option value="ARQUITETO">Arquitetos</option>
                        <option value="CORRETOR">Corretores</option>
                        <option value="FORNECEDOR">Fornecedores</option>
                        <option value="OUTRO">Outros</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>Carregando...</div>
            ) : (
                <div className="scrollable-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {filtered.map(p => (
                        <div key={p.id} className="glass card" style={{ padding: '1.5rem', zIndex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0 }}>{p.name}</h4>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700' }}>{p.type}</span>
                                            {p.commission_percentage > 0 && (
                                                <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                                    {p.commission_percentage}% Comissão
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button className="btn-icon" title="Editar" onClick={() => setModal({ show: true, data: p, tab: 'dados' })}><Edit3 size={16} /></button>
                                    <button className="btn-icon" title="Excluir" style={{ color: '#ef4444' }} onClick={() => { if(confirm('Excluir?')) api.delete(`/partners/${p.id}`).then(fetchData) }}><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                <div style={{ marginBottom: '4px' }}><Mail size={12} /> {p.email || '—'}</div>
                                <div style={{ marginBottom: '4px' }}><Phone size={12} /> {p.phone || '—'}</div>
                                <div style={{ marginBottom: '4px' }}><MapPin size={12} /> {p.address_city || '—'}</div>
                                {p.referrer_name && (
                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <UserCheck size={14} /> Indicado por: <strong style={{ color: 'var(--text-main)' }}>{p.referrer_name}</strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal no final da árvore DOM garante sobreposição natural */}
            {modal.show && (
                <PartnerModal 
                    partner={modal.data} 
                    allPartners={partners}
                    initialTab={modal.tab}
                    onClose={() => setModal({ show: false, data: null, tab: 'dados' })} 
                    onSave={() => { setModal({ show: false, data: null, tab: 'dados' }); fetchData(); }} 
                />
            )}
        </div>
    );
};

export default Partners;
