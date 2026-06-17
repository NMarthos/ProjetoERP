import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { createPortal } from 'react-dom';
import { Search, RefreshCw, Plus, Pencil, Trash2, X, TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle, XCircle, Receipt } from 'lucide-react';
import ReceiptModal from './ReceiptModal';

const maskCurrency = (v) => {
    if (!v && v !== 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};
const parseCurrency = (str) => {
    if (!str && str !== 0) return 0;
    if (typeof str === 'number') return str;
    // Remove tudo exceto dígitos e vírgula, trata formato pt-BR: 1.234,56
    const clean = str.replace(/[^\d]/g, '');
    return parseInt(clean || '0', 10) / 100;
};
// Máscara estilo ATM: extrai só dígitos e trata como centavos
const maskAtm = (raw) => {
    const digits = raw.replace(/\D/g, '');
    const cents = parseInt(digits || '0', 10);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
};
const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
};

const STATUS_CONFIG = {
    EM_ABERTO: { label: 'Em Aberto', color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
    LIQUIDADO:  { label: 'Liquidado', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    CANCELADO:  { label: 'Cancelado', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const CATEGORIES = [
    'Receita de Projeto', 'Serviço Extra', 'Adiantamento',
    'Fornecedor', 'Aluguel', 'Salário', 'Comissão',
    'Material', 'Transporte', 'Impostos', 'Outros'
];

const EMPTY_FORM = {
    type: 'CREDITO', category: '', title: '', description: '',
    value: 'R$ 0,00', due_date: new Date().toISOString().split('T')[0],
    payment_date: '', note: '', status: 'EM_ABERTO'
};

// ── Modal de Lançamento ──────────────────────────────────────────────────────
const FlowModal = ({ initial, onClose, onSaved }) => {
    const [form, setForm] = useState(initial || EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const isEdit = !!initial?.id;

    const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async () => {
        if (!form.title.trim() || !form.due_date || !parseCurrency(form.value)) {
            setError('Preencha título, data de vencimento e valor.'); return;
        }
        setSaving(true); setError('');
        try {
            const payload = {
                ...form,
                value: parseCurrency(form.value),
            };
            if (isEdit) await api.put(`/financial-flows/${initial.id}`, payload);
            else        await api.post('/financial-flows', payload);
            onSaved();
        } catch (e) {
            setError(e.response?.data?.error || e.message);
            setSaving(false);
        }
    };

    const labelStyle = { fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' };

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '540px', width: '96%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isEdit ? <Pencil size={20} color="var(--primary)" /> : <Plus size={20} color="var(--primary)" />}
                        {isEdit ? 'Editar Lançamento' : 'Novo Lançamento'}
                    </h2>
                    <button onClick={onClose} className="btn-icon"><X size={20} /></button>
                </div>

                {/* Tipo CREDITO / DEBITO */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.25rem' }}>
                    {[
                        { key: 'CREDITO', label: '↑ Crédito', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
                        { key: 'DEBITO',  label: '↓ Débito',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
                    ].map(t => {
                        const active = form.type === t.key;
                        return (
                            <div key={t.key} onClick={() => f('type', t.key)} style={{
                                padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                                fontWeight: '800', fontSize: '0.95rem', userSelect: 'none',
                                border: `2px solid ${active ? t.color : 'var(--border)'}`,
                                background: active ? t.bg : 'rgba(255,255,255,0.02)',
                                color: active ? t.color : 'var(--text-muted)', transition: 'all 0.15s'
                            }}>{t.label}</div>
                        );
                    })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Título *</label>
                        <input value={form.title} onChange={e => f('title', e.target.value)} placeholder="Ex: Parcela 1, Aluguel Maio..." />
                    </div>
                    <div>
                        <label style={labelStyle}>Categoria</label>
                        <select value={form.category} onChange={e => f('category', e.target.value)}>
                            <option value="">— Selecione —</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Valor *</label>
                        <input
                            value={form.value}
                            onChange={e => f('value', maskAtm(e.target.value))}
                            style={{ textAlign: 'right', fontWeight: '700', color: form.type === 'CREDITO' ? '#10b981' : '#ef4444' }}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Vencimento *</label>
                        <input type="date" value={form.due_date} onChange={e => f('due_date', e.target.value)} style={{ colorScheme: 'dark' }} />
                    </div>
                    <div>
                        <label style={labelStyle}>Data Liquidação</label>
                        <input type="date" value={form.payment_date || ''} onChange={e => f('payment_date', e.target.value)} style={{ colorScheme: 'dark' }} />
                    </div>
                    <div>
                        <label style={labelStyle}>Situação</label>
                        <select value={form.status} onChange={e => f('status', e.target.value)}>
                            <option value="EM_ABERTO">Em Aberto</option>
                            <option value="LIQUIDADO">Liquidado</option>
                            <option value="CANCELADO">Cancelado</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Anotação</label>
                        <input value={form.note || ''} onChange={e => f('note', e.target.value)} placeholder="Pix, boleto, cartão..." />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Descrição</label>
                        <textarea value={form.description || ''} onChange={e => f('description', e.target.value)} placeholder="Detalhes adicionais..." style={{ minHeight: '60px', resize: 'vertical' }} />
                    </div>
                </div>

                {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</div>}

                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                    <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="btn-premium" style={{ flex: 1 }}>
                        {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Lançamento'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ── Página Principal ──────────────────────────────────────────────────────────
const CashFlow = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const [rows, setRows]           = useState([]);
    const [loading, setLoading]     = useState(false);
    const [dateFrom, setDateFrom]   = useState(firstDay);
    const [dateTo, setDateTo]       = useState(lastDay);
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter]     = useState('');
    const [search, setSearch]       = useState('');
    const [modal, setModal]         = useState(null); // null | { initial }
    const [updatingId, setUpdatingId] = useState(null);
    const [receiptModal, setReceiptModal] = useState(null);

    const fetchFlows = useCallback(async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams();
            if (dateFrom)     p.append('date_from', dateFrom);
            if (dateTo)       p.append('date_to',   dateTo);
            if (statusFilter) p.append('status',    statusFilter);
            if (typeFilter)   p.append('type',      typeFilter);
            const res = await api.get(`/financial-flows?${p.toString()}`);
            setRows(res.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [dateFrom, dateTo, statusFilter, typeFilter]);

    useEffect(() => { fetchFlows(); }, [fetchFlows]);

    const handleDelete = async (id) => {
        if (!window.confirm('Excluir este lançamento?')) return;
        await api.delete(`/financial-flows/${id}`);
        setRows(r => r.filter(x => x.id !== id));
    };

    const handleStatusChange = async (id, status) => {
        setUpdatingId(id);
        const payment_date = status === 'LIQUIDADO' ? new Date().toISOString().split('T')[0] : null;
        try {
            await api.patch(`/financial-flows/${id}/status`, { status, payment_date });
            setRows(r => r.map(x => x.id === id ? { ...x, status, payment_date } : x));
        } catch (e) { alert('Erro ao atualizar.'); }
        setUpdatingId(null);
    };

    const filtered = rows.filter(r =>
        r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.category?.toLowerCase().includes(search.toLowerCase()) ||
        r.proposal_description?.toLowerCase().includes(search.toLowerCase())
    );

    const totalCredito = filtered.filter(r => r.type === 'CREDITO' && r.status !== 'CANCELADO').reduce((a, r) => a + (r.value || 0), 0);
    const totalDebito  = filtered.filter(r => r.type === 'DEBITO'  && r.status !== 'CANCELADO').reduce((a, r) => a + (r.value || 0), 0);
    const saldo        = totalCredito - totalDebito;
    const totalAberto  = filtered.filter(r => r.status === 'EM_ABERTO').reduce((a, r) => a + (r.value || 0), 0);

    const th = { padding: '1rem 1.25rem', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' };

    return (
        <div style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <DollarSign size={32} color="var(--primary)" /> Fluxo de Caixa
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: '6px 0 0', fontSize: '0.9rem' }}>
                        Controle de créditos e débitos da empresa
                    </p>
                </div>
                <button onClick={() => setModal({ initial: null })} className="btn-premium" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={18} /> Novo Lançamento
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Saldo do Período', value: saldo, color: saldo >= 0 ? '#10b981' : '#ef4444', icon: <DollarSign size={20} />, bg: saldo >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: saldo >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' },
                    { label: 'Total Créditos',   value: totalCredito, color: '#10b981', icon: <TrendingUp size={20} />,   bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.3)' },
                    { label: 'Total Débitos',    value: totalDebito,  color: '#ef4444', icon: <TrendingDown size={20} />, bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)' },
                    { label: 'Em Aberto',        value: totalAberto,  color: '#eab308', icon: <Clock size={20} />,        bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.3)' },
                ].map((card, i) => (
                    <div key={i} className="glass card" style={{ background: card.bg, borderColor: card.border, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: card.bg, border: `1px solid ${card.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>
                            {card.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '900', color: card.color, marginTop: '2px' }}>{maskCurrency(card.value)}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="glass card" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                {[
                    { label: 'Data Inicial', node: <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ marginBottom: 0, colorScheme: 'dark', width: '100%' }} /> },
                    { label: 'Data Final',   node: <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ marginBottom: 0, colorScheme: 'dark', width: '100%' }} /> },
                    { label: 'Tipo', node: (
                        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ marginBottom: 0, width: '100%' }}>
                            <option value="">Todos</option>
                            <option value="CREDITO">Crédito</option>
                            <option value="DEBITO">Débito</option>
                        </select>
                    )},
                    { label: 'Situação', node: (
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ marginBottom: 0, width: '100%' }}>
                            <option value="">Todos</option>
                            <option value="EM_ABERTO">Em Aberto</option>
                            <option value="LIQUIDADO">Liquidado</option>
                            <option value="CANCELADO">Cancelado</option>
                        </select>
                    )},
                ].map((item, i) => (
                    <div key={i} style={{ flex: '1 1 130px' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>{item.label}</label>
                        {item.node}
                    </div>
                ))}
                <div style={{ flex: '2 1 200px', position: 'relative' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Buscar</label>
                    <Search size={15} style={{ position: 'absolute', left: '12px', bottom: '12px', color: 'var(--text-muted)' }} />
                    <input placeholder="Título, cliente, categoria..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 0, paddingLeft: '34px', width: '100%' }} />
                </div>
                <button onClick={fetchFlows} className="btn-icon" title="Atualizar" style={{ flexShrink: 0, alignSelf: 'flex-end' }}>
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Table */}
            <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                                    <th style={th}>Tipo</th>
                                    <th style={th}>Vencimento</th>
                                    <th style={th}>Título</th>
                                    <th style={th}>Categoria</th>
                                    <th style={th}>Cliente / Origem</th>
                                    <th style={th}>Anotação</th>
                                    <th style={{ ...th, textAlign: 'right' }}>Valor</th>
                                    <th style={th}>Situação</th>
                                    <th style={th}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan="9" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum registro encontrado.</td></tr>
                                ) : filtered.map(row => {
                                    const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.EM_ABERTO;
                                    const isCredit = row.type === 'CREDITO';
                                    const isOverdue = row.status === 'EM_ABERTO' && row.due_date < new Date().toISOString().split('T')[0];
                                    return (
                                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '0.9rem 1.25rem' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '800',
                                                    background: isCredit ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                                    color: isCredit ? '#10b981' : '#ef4444',
                                                }}>
                                                    {isCredit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                    {isCredit ? 'CRÉDITO' : 'DÉBITO'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.9rem 1.25rem' }}>
                                                <div style={{ fontWeight: '700', fontSize: '0.88rem', color: isOverdue ? '#ef4444' : 'white' }}>{fmtDate(row.due_date)}</div>
                                                {isOverdue && <div style={{ fontSize: '0.62rem', color: '#ef4444', fontWeight: '700' }}>VENCIDO</div>}
                                                {row.payment_date && <div style={{ fontSize: '0.68rem', color: '#10b981' }}>Pago: {fmtDate(row.payment_date)}</div>}
                                            </td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontWeight: '600', fontSize: '0.88rem', maxWidth: '160px' }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</div>
                                                {row.description && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{row.description}</div>}
                                            </td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.category || '—'}</td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {row.partner_name || '—'}
                                                {row.proposal_id && <div style={{ fontSize: '0.68rem' }}>#{row.proposal_id}</div>}
                                            </td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.note || '—'}</td>
                                            <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right', fontWeight: '800', fontSize: '1rem', color: isCredit ? '#10b981' : '#ef4444' }}>
                                                {isCredit ? '+' : '−'}{maskCurrency(row.value)}
                                            </td>
                                            <td style={{ padding: '0.9rem 1.25rem' }}>
                                                <select
                                                    value={row.status}
                                                    disabled={updatingId === row.id}
                                                    onChange={e => handleStatusChange(row.id, e.target.value)}
                                                    style={{ marginBottom: 0, padding: '4px 8px', fontSize: '0.75rem', fontWeight: '700', background: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.color}`, borderRadius: '20px', cursor: 'pointer', minWidth: '105px' }}
                                                >
                                                    <option value="EM_ABERTO">Em Aberto</option>
                                                    <option value="LIQUIDADO">Liquidado</option>
                                                    <option value="CANCELADO">Cancelado</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    {isCredit && (
                                                        <button className="btn-icon" title="Gerar Recibo" onClick={() => setReceiptModal(row)} style={{ color: '#10b981' }}><Receipt size={15} /></button>
                                                    )}
                                                    <button className="btn-icon" title="Editar" onClick={() => setModal({ initial: { ...row, value: maskCurrency(row.value) } })} style={{ color: 'var(--text-muted)' }}><Pencil size={15} /></button>
                                                    <button className="btn-icon" title="Excluir" onClick={() => handleDelete(row.id)} style={{ color: '#ef4444' }}><Trash2 size={15} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {filtered.length > 0 && (
                                <tfoot>
                                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderTop: '2px solid var(--border)' }}>
                                        <td colSpan="6" style={{ padding: '1rem 1.25rem', fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: '900', fontSize: '1rem', color: saldo >= 0 ? '#10b981' : '#ef4444' }}>
                                            Saldo: {maskCurrency(saldo)}
                                        </td>
                                        <td colSpan="2" />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </div>

            {modal && (
                <FlowModal
                    initial={modal.initial}
                    onClose={() => setModal(null)}
                    onSaved={() => { setModal(null); fetchFlows(); }}
                />
            )}

            {receiptModal && (
                <ReceiptModal
                    flow={receiptModal}
                    onClose={() => setReceiptModal(null)}
                />
            )}
        </div>
    );
};

export default CashFlow;
