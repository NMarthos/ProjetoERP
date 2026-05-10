import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Search, FileText, X, CheckCircle, Clock, XCircle, Pencil, Trash2, UserCheck, User, CalendarPlus, BellRing, ClipboardCheck, Image, Paperclip } from 'lucide-react';
import { createPortal } from 'react-dom';
import BudgetModal from './BudgetModal';

const maskCurrency = (v) => {
    if (!v) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

const parseCurrency = (v) => {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    return parseFloat(v.replace(/[R$\s.]/g, '').replace(',', '.'));
};

// ── Modais Auxiliares ──────────────────────────────────────────────────────

const ProposalModal = ({ proposal, onClose, onSave }) => {
    const [partners, setPartners] = useState([]);
    const [referrals, setReferrals] = useState([]);
    const [form, setForm] = useState({ 
        partner_id: '', 
        description: '', 
        status: 'ABERTO', 
        phase: '1-Comercial' 
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPartners();
        if (proposal) {
            setForm({
                partner_id: proposal.partner_id,
                description: proposal.description,
                status: proposal.status,
                phase: proposal.phase || '1-Comercial'
            });
        }
    }, [proposal]);

    const fetchPartners = async () => {
        try {
            const r = await api.get('/partners');
            setPartners(r.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (form.partner_id) {
            api.get(`/referrals?clientId=${form.partner_id}`).then(r => setReferrals(r.data));
        } else {
            setReferrals([]);
        }
    }, [form.partner_id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (proposal) {
                await api.put(`/proposals/${proposal.id}`, form);
            } else {
                await api.post('/proposals', form);
            }
            onSave();
        } catch (err) {
            setError('Erro ao salvar proposta: ' + (err.response?.data?.error || err.message));
            setLoading(false);
        }
    };

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2>{proposal ? 'Editar Proposta' : 'Nova Proposta'}</h2>
                    <button onClick={onClose} className="btn-icon"><X /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label>Parceiro (Cliente/Arquiteto)</label>
                        <select 
                            required 
                            value={form.partner_id} 
                            onChange={e => setForm({ ...form, partner_id: e.target.value })}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'white' }}
                        >
                            <option value="">Selecione...</option>
                            {partners.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                        </select>
                        {referrals.length > 0 && (
                            <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#eab308', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <UserCheck size={14} /> Indicado por: {referrals[0].referrer_name}
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label>Breve Descrição do Projeto</label>
                        <textarea 
                            required
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="Ex: Cozinha Planejada - Edifício Solar"
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'white', minHeight: '80px' }}
                        />
                    </div>

                    {proposal && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <label>Status</label>
                                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'white' }}>
                                    <option value="ABERTO">Aberto</option>
                                    <option value="APROVADO">Aprovado</option>
                                    <option value="REJEITADO">Rejeitado</option>
                                    <option value="ARQUIVADO">Arquivado</option>
                                </select>
                            </div>
                            <div>
                                <label>Fase Atual</label>
                                <select value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'white' }}>
                                    <option value="1-Comercial">1-Comercial</option>
                                    <option value="2-Fábrica/Técnica">2-Fábrica/Técnica</option>
                                    <option value="3-Produção">3-Produção</option>
                                    <option value="4-Montagem">4-Montagem</option>
                                    <option value="5-Finalizado">5-Finalizado</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                        <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                        <button type="submit" disabled={loading} className="btn-premium" style={{ flex: 1 }}>{loading ? 'Salvando...' : 'Salvar Proposta'}</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

const EventModal = ({ proposal, onClose, onSave }) => {
    const [events, setEvents] = useState([]);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('eventos');
    const [form, setForm] = useState({ event_date: '', event_time: '', description: '', monitor: false });

    useEffect(() => {
        fetchEvents();
        fetchHistory();
    }, [proposal.id]);

    const fetchEvents = async () => {
        const r = await api.get(`/proposals/${proposal.id}/events`);
        setEvents(r.data);
    };

    const fetchHistory = async () => {
        const r = await api.get(`/proposals/${proposal.id}/history`);
        setHistory(r.data);
    };

    const handleAddEvent = async (e) => {
        e.preventDefault();
        await api.post(`/proposals/${proposal.id}/events`, form);
        setForm({ event_date: '', event_time: '', description: '', monitor: false });
        fetchEvents();
    };

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem' }}>Linha do Tempo: #{proposal.id}</h2>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{proposal.description}</div>
                    </div>
                    <button onClick={onClose} className="btn-icon"><X /></button>
                </div>

                <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                    <div onClick={() => setActiveTab('eventos')} style={{ paddingBottom: '10px', cursor: 'pointer', color: activeTab === 'eventos' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'eventos' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: activeTab === 'eventos' ? '700' : '500' }}>Eventos & Alertas</div>
                    <div onClick={() => setActiveTab('historico')} style={{ paddingBottom: '10px', cursor: 'pointer', color: activeTab === 'historico' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'historico' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: activeTab === 'historico' ? '700' : '500' }}>Histórico de Fases</div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {activeTab === 'eventos' ? (
                        <>
                            <form onSubmit={handleAddEvent} style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                    <input type="date" required value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'white', padding: '8px', borderRadius: '6px' }} />
                                    <input type="time" required value={form.event_time} onChange={e => setForm({ ...form, event_time: e.target.value })} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'white', padding: '8px', borderRadius: '6px' }} />
                                </div>
                                <textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descreva o evento ou alerta..." style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'white', padding: '8px', borderRadius: '6px', marginBottom: '10px', minHeight: '60px' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={form.monitor} onChange={e => setForm({ ...form, monitor: e.target.checked })} /> Monitorar (Exibir Alerta na Listagem)
                                    </label>
                                    <button type="submit" className="btn-premium" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Adicionar</button>
                                </div>
                            </form>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {events.map(ev => (
                                    <div key={ev.id} style={{ display: 'flex', gap: '15px', borderLeft: '2px solid var(--primary)', paddingLeft: '15px' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)' }}>{new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR')} às {ev.event_time}</div>
                                                {ev.monitor === 1 && <span style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '700' }}>MONITORADO</span>}
                                            </div>
                                            <div style={{ fontSize: '0.9rem' }}>{ev.description}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Registrado por: {ev.user_name || 'Sistema'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {history.map((h, idx) => (
                                <div key={h.id} style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: idx === 0 ? 'var(--primary)' : 'var(--border)', border: '2px solid var(--card-bg)', zIndex: 1 }}></div>
                                        {idx !== history.length - 1 && <div style={{ width: '2px', flex: 1, background: 'var(--border)', margin: '4px 0' }}></div>}
                                    </div>
                                    <div style={{ paddingBottom: '15px' }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{h.new_phase}</div>
                                        {h.old_phase && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Vindo de: {h.old_phase}</div>}
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(h.created_at).toLocaleString('pt-BR')} por {h.user_name || 'Sistema'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const ProposalCompletionModal = ({ proposal, onClose, onSave, settings: settingsProp, onPrint }) => {
    const [form, setForm] = useState({ 
        status: 'ABERTO', 
        phase: '1-Comercial', 
        description: '',
        payment_methods: '',
        payment_notes: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [availableMethods, setAvailableMethods] = useState([]);
    const [liveSettings, setLiveSettings] = useState(settingsProp);
    const [fullscreenImage, setFullscreenImage] = useState(null);

    useEffect(() => {
        if (!proposal) return;
        setForm({
            status: proposal.status || 'ABERTO',
            phase: proposal.phase || '1-Comercial',
            description: proposal.description || '',
            payment_methods: proposal.payment_methods || '',
            payment_notes: proposal.payment_notes || ''
        });
        // Fetch fresh settings (aligned with BudgetModal)
        api.get('/settings').then(r => setLiveSettings(r.data)).catch(() => {});
        api.get('/payment-methods')
            .then(r => setAvailableMethods(r.data.filter(m => m.active)))
            .catch(() => {});
    }, [proposal]);

    let budgetItems = [];
    try { budgetItems = proposal?.budget_data ? JSON.parse(proposal.budget_data) : []; } catch(e) {}

    const calculateItemSaleTotal = (item) => {
        const cost = item.products.reduce((acc, p) => acc + (p.total || 0), 0);
        const { taxes = 0, markup = 0, financeCost = 0 } = liveSettings || {};
        const comm = proposal?.referrer_commission || 0;
        const divisor = 1 - (taxes/100) - (markup/100) - (financeCost/100) - (comm/100);
        return divisor > 0 ? cost / divisor : 0;
    };

    const grandTotal = budgetItems.reduce((acc, item) => acc + calculateItemSaleTotal(item), 0);

    // Most recent active method (same rule as printed proposal)
    const activeMethod = [...availableMethods].slice(-1)[0];

    // Max finance cost across all conditions → used for à vista discount
    const maxFinancePct = activeMethod
        ? Math.max(0, ...activeMethod.conditions.map(c => c.finance_cost_percentage || 0))
        : 0;
    const aVistaExtraDiscountPct = parseFloat((maxFinancePct * 0.70).toFixed(2));

    const calcCondition = (cond) => {
        const installments = cond.installments || 1;
        const isAVista = installments === 1;
        const totalDiscountPct = isAVista
            ? (cond.discount_percentage || 0) + aVistaExtraDiscountPct
            : (cond.discount_percentage || 0);
        const discountedTotal = grandTotal * (1 - totalDiscountPct / 100);
        const financedTotal   = discountedTotal * (1 + (cond.finance_cost_percentage || 0) / 100);
        const downPct         = cond.down_payment_percentage || 0;
        const downValue       = financedTotal * (downPct / 100);
        const remaining       = financedTotal - downValue;
        const installAmt      = installments > 1 ? remaining / installments : financedTotal;
        return { installments, isAVista, totalDiscountPct, financedTotal, downPct, downValue, installAmt };
    };

    const handleSelectCondition = (cond, idx) => {
        const { installments, isAVista, totalDiscountPct, financedTotal, downPct, downValue, installAmt } = calcCondition(cond);
        let text = `Opção ${idx + 1}${activeMethod ? ` — ${activeMethod.name}` : ''}\n`;
        if (totalDiscountPct > 0) text += `• Desconto: ${totalDiscountPct.toFixed(2)}%\n`;
        text += `• Total: ${maskCurrency(financedTotal)}\n`;
        if (isAVista) {
            text += `• À vista: ${maskCurrency(financedTotal)}`;
        } else if (downPct > 0) {
            text += `• Entrada (${downPct}%): ${maskCurrency(downValue)}\n`;
            text += `• + ${installments}x de ${maskCurrency(installAmt)}`;
        } else {
            text += `• ${installments}x de ${maskCurrency(installAmt)}`;
        }
        setForm(f => ({ ...f, payment_methods: text }));
    };

    const handleAction = async (newStatus) => {
        setSaving(true); setError('');
        try {
            const payload = {
                status: newStatus,
                payment_methods: form.payment_methods,
                payment_notes: form.payment_notes
            };
            if (newStatus === 'APROVADO' && form.phase === '1-Comercial') payload.phase = '2-Fábrica/Técnica';
            await api.put(`/proposals/${proposal.id}`, payload);
            onSave();
        } catch (err) {
            setError('Erro ao salvar conclusão: ' + (err.response?.data?.error || err.message));
            setSaving(false);
        }
    };

    if (!proposal) return null;


    return (
        <>
        {createPortal(
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '1400px', width: '98%', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '95vh' }}>
                {/* HEADER */}
                <div style={{ background: 'var(--card-bg)', borderBottom: '2px solid var(--border)', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>Cliente</div>
                            <div style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--primary)' }}>{proposal.partner_name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{proposal.partner_phone}</div>
                        </div>
                        <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '2rem' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>Identificação</div>
                            <div style={{ fontWeight: '800', fontSize: '1.2rem' }}>{proposal.phase === '1-Comercial' ? `PROPOSTA #${proposal.id}` : `PROJETO #${proposal.id}`}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Criado em: {new Date(proposal.created_at).toLocaleDateString('pt-BR')}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {onPrint && (
                            <button
                                onClick={onPrint}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--primary)', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}
                            >
                                📄 Gerar Proposta
                            </button>
                        )}
                        <button onClick={onClose} className="btn-icon"><X size={24} /></button>
                    </div>
                </div>

                {/* BODY — 3 columns: items | images | payment */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    {/* COL 1 — items */}
                    <div style={{ borderRight: '2px solid var(--border)', padding: '1.5rem', overflowY: 'auto', background: 'rgba(0,0,0,0.1)' }}>
                        <h4 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', color: 'white' }}>
                            <FileText size={18} color="var(--primary)" /> Itens do Orçamento
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {budgetItems.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>Nenhum item no orçamento.</div>
                            ) : budgetItems.map((item, i) => (
                                <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{item.name}</div>
                                        <div style={{ fontWeight: '800', color: '#10b981', fontSize: '1rem' }}>{maskCurrency(calculateItemSaleTotal(item))}</div>
                                    </div>
                                    {item.description && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{item.description}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(16,185,129,0.1)', borderRadius: '16px', border: '2px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '800', textTransform: 'uppercase', marginBottom: '2px' }}>Valor Total</div>
                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>Parâmetros atuais</div>
                            </div>
                            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#10b981' }}>{maskCurrency(grandTotal)}</div>
                        </div>
                    </div>

                    {/* COL 2 — images */}
                    <div style={{ borderRight: '2px solid var(--border)', padding: '1.5rem', overflowY: 'auto', background: 'rgba(0,0,0,0.05)' }}>
                        <h4 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', color: 'white' }}>
                            <Image size={18} color="var(--primary)" /> Imagens da Proposta
                        </h4>
                        {(() => {
                            const isImageAtt = (a) =>
                                (a.type && a.type.includes('image')) ||
                                /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(a.url || a.name || '');
                            const allImages = budgetItems.flatMap(item => {
                                const atts = Array.isArray(item.attachments)
                                    ? item.attachments
                                    : (typeof item.attachments === 'string' ? (() => { try { return JSON.parse(item.attachments); } catch { return []; } })() : []);
                                return atts.filter(isImageAtt).map(a => ({ ...a, itemName: item.name }));
                            });
                            return allImages.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', fontSize: '0.85rem' }}>
                                    Nenhuma imagem anexada aos itens.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {allImages.map((img, i) => (
                                        <div key={i} style={{ position: 'relative', cursor: 'zoom-in' }} onClick={() => setFullscreenImage(img.url)}>
                                            <img
                                                src={img.url}
                                                alt={img.itemName}
                                                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }}
                                            />
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '9px', padding: '3px 6px', borderRadius: '0 0 8px 8px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {img.itemName}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* RIGHT — payment conditions */}
                    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--card-bg)', overflowY: 'auto' }}>
                        <h4 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
                            <ClipboardCheck size={20} color="var(--primary)" /> Condições de Fechamento
                        </h4>

                        {activeMethod ? (
                            <>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-1rem' }}>
                                    Forma ativa: <strong style={{ color: 'white' }}>{activeMethod.name}</strong>
                                    {aVistaExtraDiscountPct > 0 && (
                                        <span style={{ color: '#16a34a', marginLeft: '8px' }}>• Desconto à vista: {aVistaExtraDiscountPct.toFixed(2)}%</span>
                                    )}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {activeMethod.conditions.map((cond, idx) => {
                                        const { installments, isAVista, totalDiscountPct, financedTotal, downPct, downValue, installAmt } = calcCondition(cond);
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => handleSelectCondition(cond, idx)}
                                                style={{
                                                    border: '1.5px solid',
                                                    borderColor: isAVista ? '#86efac' : 'var(--border)',
                                                    borderRadius: '12px',
                                                    padding: '14px',
                                                    background: isAVista ? 'rgba(22,163,74,0.08)' : 'rgba(255,255,255,0.03)',
                                                    cursor: 'pointer',
                                                    transition: 'border-color 0.2s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = isAVista ? '#86efac' : 'var(--border)'}
                                            >
                                                <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>
                                                    Opção {idx + 1}
                                                </div>
                                                <div style={{ fontSize: '13px', fontWeight: '900', color: isAVista ? '#16a34a' : 'white', borderTop: '1px solid var(--border)', paddingTop: '6px', lineHeight: '1.6' }}>
                                                    {isAVista ? (
                                                        `À vista: ${maskCurrency(financedTotal)}`
                                                    ) : downPct > 0 ? (
                                                        <>
                                                            <div>Entrada {downPct}%: <span style={{ color: '#6366f1' }}>{maskCurrency(downValue)}</span></div>
                                                            <div>+ {installments}x de <span style={{ color: '#6366f1' }}>{maskCurrency(installAmt)}</span></div>
                                                        </>
                                                    ) : (
                                                        `${installments}x de ${maskCurrency(installAmt)}`
                                                    )}
                                                </div>
                                                {totalDiscountPct > 0 && (
                                                    <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700', marginTop: '4px' }}>
                                                        Desconto: {totalDiscountPct.toFixed(2)}%
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nenhuma forma de pagamento ativa encontrada.</div>
                        )}

                        <div>
                            <label style={{ marginBottom: '8px', display: 'block', fontWeight: '700', fontSize: '0.85rem' }}>Resumo / Observações</label>
                            <textarea
                                value={form.payment_methods}
                                onChange={e => setForm(f => ({ ...f, payment_methods: e.target.value }))}
                                style={{ width: '100%', minHeight: '130px', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: '0.85rem' }}
                            />
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div style={{ background: 'rgba(0,0,0,0.3)', borderTop: '2px solid var(--border)', padding: '1.25rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: '600' }}>{error}</div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => handleAction('ARQUIVADO')} disabled={saving} className="btn-secondary">Arquivar</button>
                        <button onClick={() => handleAction('REJEITADO')} disabled={saving} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontWeight: '700' }}>Declinar</button>
                        <button onClick={() => handleAction('APROVADO')} disabled={saving} className="btn-premium" style={{ padding: '12px 40px', fontSize: '1.1rem' }}>{saving ? 'Processando...' : '✓ Aprovar e Iniciar Projeto'}</button>
                    </div>
                </div>
            </div>

        </div>,
        document.body
        )}
        {fullscreenImage && createPortal(
            <div
                onClick={() => setFullscreenImage(null)}
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.95)',
                    zIndex: 99999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'zoom-out'
                }}
            >
                <img
                    src={fullscreenImage}
                    alt="Visualização"
                    style={{ maxWidth: '92%', maxHeight: '92vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 0 80px rgba(0,0,0,0.9)' }}
                />
                <div style={{ position: 'absolute', top: '20px', right: '20px', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)', padding: '6px 14px', borderRadius: '8px' }}>
                    Clique para fechar
                </div>
            </div>,
            document.body
        )}
        </>
    );
};


// ── Página Principal ─────────────────────────────────────────────────────────



const Proposals = ({ user }) => {
    const [proposals, setProposals] = useState([]);
    const [settings, setSettings] = useState({ taxes: 0, markup: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedProposal, setSelectedProposal] = useState(null);
    const [eventModalData, setEventModalData] = useState({ show: false, proposal: null });
    const [completionModalData, setCompletionModalData] = useState({ show: false, proposal: null });
    const [budgetModalData, setBudgetModalData] = useState({ show: false, proposal: null });

    useEffect(() => {
        fetchProposals();
    }, []);

    const fetchProposals = async () => {
        setLoading(true);
        try {
            const r = await api.get('/proposals');
            setProposals(r.data.proposals);
            setSettings(r.data.settings);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleEdit = (p) => {
        setSelectedProposal(p);
        setModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Excluir este orçamento permanentemente?')) return;
        await api.delete(`/proposals/${id}`);
        fetchProposals();
    };

    const statusConfig = {
        'ABERTO': { color: '#eab308', icon: <Clock size={16} /> },
        'APROVADO': { color: '#10b981', icon: <CheckCircle size={16} /> },
        'REJEITADO': { color: '#ef4444', icon: <XCircle size={16} /> },
        'ARQUIVADO': { color: 'var(--text-muted)', icon: <Clock size={16} /> }
    };

    const filtered = proposals.filter(p => 
        p.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toString() === search
    );

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', margin: 0 }}>Gestão Comercial</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Acompanhamento de orçamentos e projetos</p>
                </div>
                <button className="btn-premium" onClick={() => { setSelectedProposal(null); setModalOpen(true); }}>
                    <Plus size={20} /> Nova Proposta
                </button>
            </div>

            <div className="glass card" style={{ marginBottom: '2rem', padding: '1rem', display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                    <input 
                        type="text" 
                        placeholder="Buscar por cliente, descrição ou número..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', padding: '12px 12px 12px 45px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'white' }}
                    />
                </div>
                <button onClick={fetchProposals} className="btn-icon" title="Atualizar"><BellRing size={20} /></button>
            </div>

            <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando dados...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '1.25rem' }}>ID</th>
                                    <th>Parceiro / Cliente</th>
                                    <th>Descrição / Projeto</th>
                                    <th>Status</th>
                                    <th>Fase</th>
                                    <th>Valor</th>
                                    <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum orçamento encontrado.</td></tr>
                                ) : (
                                    filtered.map(p => {
                                        const cfg = statusConfig[p.status] || statusConfig.ABERTO;
                                        const canModify = user?.role === 'ADMIN' || user?.role === 'ADM' || p.user_id === user?.id;
                                        
                                        return (
                                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1.25rem', fontWeight: '700' }}>#{p.id}</td>
                                                <td>
                                                    <div style={{ fontWeight: '600' }}>{p.partner_name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.partner_phone}</div>
                                                </td>
                                                <td>{p.description}</td>
                                                <td>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: `${cfg.color}15`, color: cfg.color, fontSize: '0.75rem', fontWeight: '700' }}>
                                                        {cfg.icon} {p.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.85rem' }}>{p.phase || '1-Comercial'}</span>
                                                        {p.has_monitored_event === 1 && <BellRing size={14} color="#eab308" title="Possui alerta monitorado" />}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: '700' }}>{maskCurrency(p.value)}</td>
                                                <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                        <button onClick={() => setBudgetModalData({ show: true, proposal: p })} title={canModify ? "Editar Orçamento" : "Ver Orçamento"} style={{ background: 'transparent', border: 'none', color: '#eab308', cursor: 'pointer' }}><FileText size={18} /></button>
                                                        {p.status === 'ABERTO' && (
                                                            <button onClick={() => setCompletionModalData({ show: true, proposal: p })} title="Concluir Negociação / Aprovar" style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer' }}><CheckCircle size={18} /></button>
                                                        )}
                                                        <button onClick={() => setEventModalData({ show: true, proposal: p })} title="Eventos / Agenda" style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}><CalendarPlus size={18} /></button>
                                                        {canModify && (
                                                            <>
                                                                <button onClick={() => handleEdit(p)} title="Editar" style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}><Pencil size={18} /></button>
                                                                <button onClick={() => handleDelete(p.id)} title="Excluir" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                                            </>
                                                        )}
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

            {modalOpen && <ProposalModal proposal={selectedProposal} onClose={() => setModalOpen(false)} onSave={() => { setModalOpen(false); fetchProposals(); }} />}
            {eventModalData.show && <EventModal proposal={eventModalData.proposal} onClose={() => setEventModalData({ show: false, proposal: null })} />}
            {completionModalData.show && <ProposalCompletionModal
                proposal={completionModalData.proposal}
                settings={settings}
                onClose={() => setCompletionModalData({ show: false, proposal: null })}
                onSave={() => { setCompletionModalData({ show: false, proposal: null }); fetchProposals(); }}
                onPrint={() => {
                    const p = completionModalData.proposal;
                    setCompletionModalData({ show: false, proposal: null });
                    setBudgetModalData({ show: true, proposal: p, autoShowPrint: true });
                }}
            />}
            {budgetModalData.show && <BudgetModal
                proposal={budgetModalData.proposal}
                settings={settings}
                user={user}
                autoShowPrint={budgetModalData.autoShowPrint || false}
                onClose={() => {
                    const wasAutoShowPrint = budgetModalData.autoShowPrint;
                    const p = budgetModalData.proposal;
                    setBudgetModalData({ show: false, proposal: null });
                    if (wasAutoShowPrint) {
                        // Volta para a tela de conclusão da proposta
                        setCompletionModalData({ show: true, proposal: p });
                    }
                }}
                onSave={() => { setBudgetModalData({ show: false, proposal: null }); fetchProposals(); }}
            />}
        </div>
    );
};

export default Proposals;
