import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Search, FileText, X, CheckCircle, Clock, XCircle, Pencil, Trash2, UserCheck, User, CalendarPlus, BellRing } from 'lucide-react';
import { maskCurrency, parseCurrency } from '../utils/masks';
import BudgetModal from './BudgetModal';
import { createPortal } from 'react-dom';

const statusConfig = {
    ABERTO:    { label: 'Aberto',    color: '#eab308', bg: 'rgba(234,179,8,0.15)',   icon: Clock },
    APROVADO:  { label: 'Aprovado',  color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: CheckCircle },
    REJEITADO: { label: 'Rejeitado', color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  icon: XCircle },
};

const PHASES = [
    '1-Comercial',
    '2-Fábrica/Técnica',
    '3-Fábrica/Produção',
    '4-Fábrica/Despacho',
    '5-Entrega',
    '6-Montagem',
    '7-Entrega técnica',
    '8-Concluida'
];

// ── Modal de Cadastro/Edição de Orçamento ──────────────────────────────────────────
const ProposalModal = ({ proposal, onClose, onSave }) => {
    const [partners, setPartners] = useState([]);
    const [form, setForm] = useState({ partner_id: '', description: '', status: 'ABERTO', phase: '1-Comercial' });
    const [referrals, setReferrals] = useState([]);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('dados');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        document.body.classList.add('body-no-scroll');
        return () => document.body.classList.remove('body-no-scroll');
    }, []);

    useEffect(() => {
        api.get('/partners')
            .then(r => setPartners(r.data))
            .catch(() => setError('Não foi possível carregar os clientes.'));
        
        if (proposal) {
            setForm({
                partner_id: proposal.partner_id || '',
                description: proposal.description || '',
                status: proposal.status || 'ABERTO',
                phase: proposal.phase || '1-Comercial'
            });
            api.get(`/proposals/${proposal.id}/history`)
                .then(r => setHistory(r.data))
                .catch(() => {});
        }
    }, [proposal]);

    useEffect(() => {
        if (form.partner_id) {
            api.get(`/referrals?clientId=${form.partner_id}`)
                .then(r => setReferrals(r.data))
                .catch(() => setReferrals([]));
        } else {
            setReferrals([]);
        }
    }, [form.partner_id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.partner_id) { setError('Selecione um cliente.'); return; }
        if (!form.description.trim()) { setError('Informe a descrição.'); return; }

        setSaving(true);
        setError('');
        try {
            const payload = {
                partner_id: Number(form.partner_id),
                description: form.description.trim(),
                status: form.status,
                phase: form.phase
            };

            if (proposal) {
                await api.put(`/proposals/${proposal.id}`, payload);
            } else {
                await api.post(`/proposals`, payload);
            }
            onSave();
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao salvar orçamento.');
            setSaving(false);
        }
    };

    const clientePartners = partners.filter(p => p.type === 'CLIENTE'); 

    const isProjeto = proposal && proposal.phase !== '1-Comercial';
    const title = proposal ? (isProjeto ? 'Detalhes do Projeto' : 'Editar Proposta') : 'Nova Proposta';

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '540px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: '700', margin: 0 }}>{title}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>{isProjeto ? 'Acompanhamento do projeto na fábrica' : 'Preencha os dados da proposta'}</p>
                    </div>
                    <button onClick={onClose} className="btn-icon"><X size={18} /></button>
                </div>
                <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                    <div onClick={() => setActiveTab('dados')} style={{ paddingBottom: '10px', cursor: 'pointer', color: activeTab === 'dados' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'dados' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: activeTab === 'dados' ? '700' : '500' }}>Dados da {isProjeto ? 'Projeto' : 'Proposta'}</div>
                    {proposal && <div onClick={() => setActiveTab('historico')} style={{ paddingBottom: '10px', cursor: 'pointer', color: activeTab === 'historico' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'historico' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: activeTab === 'historico' ? '700' : '500' }}>Histórico de Fases</div>}
                </div>

                {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '10px 14px', color: '#ef4444', marginBottom: '1.25rem', fontSize: '0.875rem' }}>{error}</div>}

                {activeTab === 'dados' ? (
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label>Cliente *</label>
                                <select value={form.partner_id} onChange={e => setForm(f => ({ ...f, partner_id: e.target.value }))} required>
                                    <option value="">— Selecione um cliente —</option>
                                    {clientePartners.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            {proposal && (
                                <div>
                                    <label>Fase Atual</label>
                                    <select value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} disabled>
                                        {PHASES.map(ph => (
                                            <option key={ph} value={ph}>{ph}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {referrals.length > 0 && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '10px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                                <div style={{ color: '#10b981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <UserCheck size={14} /> Cliente Indicado por:
                                </div>
                                {referrals.map(r => (
                                    <div key={r.id} style={{ color: 'var(--text)' }}>
                                        • {r.referrer_name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({r.referrer_type})</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <label>Descrição (Referencial de Projeto) *</label>
                        <textarea 
                            placeholder="Ex: Cozinha completa sob medida..." 
                            value={form.description} 
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                            required 
                            style={{ width: '100%', minHeight: '100px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.25)', background: 'rgba(255,255,255,0.02)', color: 'white', fontSize: '0.9rem', resize: 'vertical', outline: 'none', marginBottom: '1rem' }}
                        />



                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                            <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
                            <button type="submit" disabled={saving} className="btn-premium" style={{ flex: 2 }}>{saving ? 'Salvando...' : '✓ Salvar'}</button>
                        </div>
                    </form>
                ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
                        {history.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Nenhum histórico registrado.</p>
                        ) : (
                            <div style={{ borderLeft: '2px solid var(--border)', marginLeft: '10px', paddingLeft: '15px' }}>
                                {history.map(h => (
                                    <div key={h.id} style={{ marginBottom: '15px', position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-21px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)' }} />
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(h.created_at).toLocaleString('pt-BR')} por {h.user_name || 'Sistema'}</div>
                                        <div style={{ fontWeight: '600', color: 'var(--text)', marginTop: '2px' }}>
                                            {h.old_phase ? `Mudou de "${h.old_phase}" para ` : 'Criado na fase '}
                                            <span style={{ color: 'var(--primary)' }}>"{h.new_phase}"</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

// ── Modal de Gestão de Eventos ─────────────────────────────────────────────────
const EventModal = ({ proposal, onClose }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ 
        id: null, 
        event_date: new Date().toISOString().split('T')[0], 
        event_time: new Date().toTimeString().split(' ')[0].slice(0, 5), 
        description: '', 
        monitor: false 
    });
    const [saving, setSaving] = useState(false);

    const loadEvents = () => {
        setLoading(true);
        api.get(`/proposals/${proposal.id}/events`)
            .then(r => {
                const sorted = r.data.sort((a, b) => {
                    const dateA = new Date(`${a.event_date}T${a.event_time || '00:00'}`);
                    const dateB = new Date(`${b.event_date}T${b.event_time || '00:00'}`);
                    return dateB - dateA;
                });
                setEvents(sorted);
            })
            .catch(() => alert('Erro ao carregar eventos'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadEvents();
    }, [proposal]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (form.id) {
                await api.put(`/events/${form.id}`, form);
            } else {
                await api.post(`/proposals/${proposal.id}/events`, form);
            }
            setForm({ 
                id: null, 
                event_date: new Date().toISOString().split('T')[0], 
                event_time: new Date().toTimeString().split(' ')[0].slice(0, 5), 
                description: '', 
                monitor: false 
            });
            loadEvents();
        } catch (err) {
            alert('Erro ao salvar evento');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (ev) => {
        setForm({
            id: ev.id,
            event_date: ev.event_date,
            event_time: ev.event_time,
            description: ev.description,
            monitor: ev.monitor === 1
        });
    };

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: '700', margin: 0 }}>Eventos / Agenda</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>Ref: {proposal.phase === '1-Comercial' ? `PROP#${proposal.id}` : `PRJ#${proposal.id}`}</p>
                    </div>
                    <button onClick={onClose} className="btn-icon"><X size={18} /></button>
                </div>
                <div style={{ height: '1px', background: 'linear-gradient(90deg, var(--primary), transparent)', marginBottom: '1.75rem' }} />

                <form onSubmit={handleSubmit} style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label>Data *</label>
                            <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} required />
                        </div>
                        <div>
                            <label>Hora *</label>
                            <input type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} required />
                        </div>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label>Descrição / Anotação *</label>
                        <input type="text" placeholder="Ex: Ligar para confirmar medidas" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                            <input type="checkbox" checked={form.monitor} onChange={e => setForm(f => ({ ...f, monitor: e.target.checked }))} style={{ width: '18px', height: '18px', margin: 0 }} />
                            <span style={{ fontSize: '0.9rem', color: form.monitor ? '#ef4444' : 'var(--text)', fontWeight: form.monitor ? '700' : '400' }}>
                                Monitorar este evento (Alerta)
                            </span>
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {form.id && <button type="button" onClick={() => setForm({ id: null, event_date: new Date().toISOString().split('T')[0], event_time: new Date().toTimeString().split(' ')[0].slice(0, 5), description: '', monitor: false })} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancelar</button>}
                            <button type="submit" disabled={saving} className="btn-premium" style={{ padding: '8px 16px' }}>{saving ? '...' : (form.id ? 'Atualizar' : 'Adicionar')}</button>
                        </div>
                    </div>
                </form>

                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <h4 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: '600' }}>Eventos Agendados</h4>
                    {loading ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</p> : events.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Nenhum evento registrado.</p> : (
                        events.map(ev => (
                            <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid var(--border)', background: ev.monitor ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '0.9rem' }}>{ev.event_date.split('-').reverse().join('/')} às {ev.event_time}</span>
                                        {ev.monitor === 1 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}><BellRing size={12} /> Alerta</span>}
                                    </div>
                                    <div style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{ev.description}</div>
                                </div>
                                <button onClick={() => handleEdit(ev)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '8px' }}><Pencil size={16} /></button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// ── Página Principal ─────────────────────────────────────────────────────────
const Proposals = () => {
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modalData, setModalData] = useState({ show: false, proposal: null });
    const [eventModalData, setEventModalData] = useState({ show: false, proposal: null });
    const [budgetModalData, setBudgetModalData] = useState({ show: false, proposal: null });
    const [error, setError] = useState('');

    const fetchProposals = async () => {
        setLoading(true);
        try {
            const r = await api.get('/proposals');
            setProposals(r.data);
            setError('');
        } catch (err) {
            setError('Erro ao buscar orçamentos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProposals(); }, []);

    const handleSave = () => { setModalData({ show: false, proposal: null }); fetchProposals(); };
    const handleEventSave = () => { setEventModalData({ show: false, proposal: null }); fetchProposals(); };
    const handleBudgetSave = () => { setBudgetModalData({ show: false, proposal: null }); fetchProposals(); };

    const handleDelete = async (id) => {
        if (!confirm('Deseja realmente excluir este orçamento?')) return;
        try {
            await api.delete(`/proposals/${id}`);
            fetchProposals();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao excluir orçamento.');
        }
    };

    const handleStatusChange = async (proposal, newStatus) => {
        if (!confirm(`Deseja alterar o status para ${newStatus === 'APROVADO' ? 'Aprovado' : 'Declinado'}?`)) return;
        try {
            await api.put(`/proposals/${proposal.id}`, {
                partner_id: proposal.partner_id,
                description: proposal.description,
                status: newStatus,
                phase: proposal.phase
            });
            fetchProposals();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao alterar status.');
        }
    };

    const handleEdit = (proposal) => { setModalData({ show: true, proposal }); };

    const filtered = proposals.filter(p =>
        p.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fade-in">
            {modalData.show && (
                <ProposalModal 
                    proposal={modalData.proposal} 
                    onClose={() => setModalData({ show: false, proposal: null })} 
                    onSave={handleSave} 
                />
            )}
            
            {eventModalData.show && (
                <EventModal 
                    proposal={eventModalData.proposal} 
                    onClose={handleEventSave} 
                />
            )}

            {budgetModalData.show && (
                <BudgetModal 
                    proposal={budgetModalData.proposal} 
                    onClose={() => setBudgetModalData({ show: false, proposal: null })} 
                    onSave={handleBudgetSave} 
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700', margin: 0 }}>Comercial</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Gerencie propostas e acompanhe os projetos na fábrica.</p>
                </div>
                <button className="btn-premium" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setModalData({ show: true, proposal: null })}>
                    <Plus size={18} /> Nova Proposta
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {['ABERTO', 'APROVADO', 'REJEITADO'].map(s => {
                    const cfg = statusConfig[s] || statusConfig.ABERTO;
                    const Icon = cfg.icon;
                    const count = proposals.filter(p => p.status === s).length;
                    return (
                        <div key={s} className="glass card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: cfg.bg, borderRadius: '8px', padding: '8px', color: cfg.color }}><Icon size={20} /></div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{count}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{cfg.label}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 0 30px rgba(99, 102, 241, 0.08)' }}>
                <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                    <Search size={18} style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-muted)' }} />
                    <input placeholder="Buscar por cliente ou descrição..." style={{ paddingLeft: '44px', marginBottom: 0 }} value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                {error && <div style={{ color: '#ef4444', padding: '1rem', textAlign: 'center' }}>{error}</div>}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Carregando...</div>
                ) : (
                    <div className="scrollable-content" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                    {['Ref. OP', 'Cliente', 'Projeto', 'Autor', 'Valor', 'Fase', 'Status', 'Ações'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Nenhum resultado.</td></tr>
                                ) : (
                                    filtered.map(p => {
                                        const cfg = statusConfig[p.status] || statusConfig.ABERTO;
                                        return (
                                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '14px 16px', color: 'var(--primary)', fontWeight: '800', fontSize: '0.9rem' }}>
                                                    {p.phase === '1-Comercial' ? `PROP#${p.id}` : `PRJ#${p.id}`}
                                                </td>
                                                <td style={{ padding: '14px 16px', fontWeight: '600' }}>{p.partner_name}</td>
                                                <td style={{ padding: '14px 16px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                                                        <User size={14} style={{ color: 'var(--primary)' }} />
                                                        {p.creator_name || 'Sistema'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#10b981' }}>
                                                    {maskCurrency(p.value || 0)}
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                        {p.phase || '1-Comercial'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <button onClick={() => setBudgetModalData({ show: true, proposal: p })} title="Ver Orçamento" style={{ background: 'transparent', border: 'none', color: '#eab308', cursor: 'pointer' }}><FileText size={18} /></button>
                                                        {p.has_monitored_event > 0 && (
                                                            <button onClick={() => setEventModalData({ show: true, proposal: p })} title="Ver Evento Monitorado" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', animation: 'pulse 2s infinite' }}><BellRing size={18} /></button>
                                                        )}
                                                        {p.status === 'ABERTO' && (
                                                            <>
                                                                <button onClick={() => handleStatusChange(p, 'APROVADO')} title="Aprovar" style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer' }}><CheckCircle size={18} /></button>
                                                                <button onClick={() => handleStatusChange(p, 'REJEITADO')} title="Declinar" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><XCircle size={18} /></button>
                                                            </>
                                                        )}
                                                        <button onClick={() => setEventModalData({ show: true, proposal: p })} title="Eventos / Agenda" style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}><CalendarPlus size={18} /></button>
                                                        <button onClick={() => handleEdit(p)} title="Editar" style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}><Pencil size={18} /></button>
                                                        <button onClick={() => handleDelete(p.id)} title="Excluir" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Proposals;
