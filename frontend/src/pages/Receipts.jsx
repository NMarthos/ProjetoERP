import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { createPortal } from 'react-dom';
import { Search, RefreshCw, Plus, Pencil, Trash2, X, FileText, DollarSign, Clock, Receipt } from 'lucide-react';
import ReceiptModal from './ReceiptModal';

const maskCurrency = (v) => {
    if (!v && v !== 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};
const parseCurrency = (str) => {
    if (!str && str !== 0) return 0;
    if (typeof str === 'number') return str;
    const clean = str.replace(/[^\d]/g, '');
    return parseInt(clean || '0', 10) / 100;
};
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

const CREDIT_CATEGORIES = [
    'Receita de Projeto', 'Serviço Extra', 'Adiantamento', 'Outros'
];

const EMPTY_FORM = {
    type: 'CREDITO', category: 'Receita de Projeto', title: '', description: '',
    value: 'R$ 0,00', due_date: new Date().toISOString().split('T')[0],
    payment_date: new Date().toISOString().split('T')[0], note: '', status: 'LIQUIDADO',
    partner_id: ''
};

// ── Modal de Lançamento de Recibo ──────────────────────────────────────────
const ReceiptFormModal = ({ initial, onClose, onSaved }) => {
    const [form, setForm] = useState(initial || EMPTY_FORM);
    const [partners, setPartners] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const isEdit = !!initial?.id;

    useEffect(() => {
        api.get('/partners')
            .then(res => setPartners(res.data || []))
            .catch(e => console.error(e));
    }, []);

    const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async () => {
        if (!form.title.trim() || !form.due_date || !parseCurrency(form.value)) {
            setError('Preencha título, data de vencimento/emissão e valor.'); return;
        }
        setSaving(true); setError('');
        try {
            const payload = {
                ...form,
                value: parseCurrency(form.value),
            };
            let savedId = initial?.id;
            if (isEdit) {
                await api.put(`/financial-flows/${initial.id}`, payload);
            } else {
                const res = await api.post('/financial-flows', payload);
                savedId = res.data.id;
            }
            onSaved(savedId);
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
                        {isEdit ? 'Editar Recibo' : 'Emitir Recibo Avulso'}
                    </h2>
                    <button onClick={onClose} className="btn-icon"><X size={20} /></button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Cliente / Parceiro</label>
                        <select value={form.partner_id || ''} onChange={e => f('partner_id', e.target.value)}>
                            <option value="">— Sem parceiro atrelado (Manual) —</option>
                            {partners.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Título / Referência *</label>
                        <input value={form.title} onChange={e => f('title', e.target.value)} placeholder="Ex: Parcela Única, Entrada de Serviço..." />
                    </div>
                    <div>
                        <label style={labelStyle}>Categoria</label>
                        <select value={form.category} onChange={e => f('category', e.target.value)}>
                            {CREDIT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Valor *</label>
                        <input
                            value={form.value}
                            onChange={e => f('value', maskAtm(e.target.value))}
                            style={{ textAlign: 'right', fontWeight: '700', color: '#10b981' }}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Data de Vencimento/Emissão *</label>
                        <input type="date" value={form.due_date} onChange={e => f('due_date', e.target.value)} style={{ colorScheme: 'dark' }} />
                    </div>
                    <div>
                        <label style={labelStyle}>Data de Pagamento</label>
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
                        <input value={form.note || ''} onChange={e => f('note', e.target.value)} placeholder="Pix, boleto, dinheiro..." />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Descrição / Detalhes</label>
                        <textarea value={form.description || ''} onChange={e => f('description', e.target.value)} placeholder="Detalhes que aparecerão no recibo..." style={{ minHeight: '60px', resize: 'vertical' }} />
                    </div>
                </div>

                {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</div>}

                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                    <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="btn-premium" style={{ flex: 1 }}>
                        {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Emitir Recibo'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ── Página Principal de Recibos ──────────────────────────────────────────────
const Receipts = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(null); // null | { initial }
    const [printModal, setPrintModal] = useState(null); // null | flow
    const [activeTab, setActiveTab] = useState('avulsos'); // 'avulsos' | 'entradas'

    const fetchReceipts = useCallback(async () => {
        setLoading(true);
        try {
            // Buscamos apenas os fluxos de tipo CREDITO
            const res = await api.get('/financial-flows?type=CREDITO');
            setRows(res.data || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchReceipts();
    }, [fetchReceipts]);

    const handleDelete = async (id) => {
        if (!window.confirm('Excluir este recibo? Isso também removerá o lançamento do fluxo de caixa.')) return;
        await api.delete(`/financial-flows/${id}`);
        setRows(r => r.filter(x => x.id !== id));
    };

    const sorted = [...rows].sort((a, b) => {
        const dateA = a.due_date || '';
        const dateB = b.due_date || '';
        if (dateA !== dateB) {
            return dateB.localeCompare(dateA);
        }
        return b.id - a.id;
    });

    const filtered = sorted.filter(r =>
        r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.category?.toLowerCase().includes(search.toLowerCase()) ||
        r.description?.toLowerCase().includes(search.toLowerCase())
    );

    const avulsos = filtered.filter(r => !r.proposal_id && r.category !== 'Receita de Projeto');
    const entradas = filtered.filter(r => (!!r.proposal_id || r.category === 'Receita de Projeto') && r.status?.toUpperCase() === 'LIQUIDADO');
    const displayedRows = activeTab === 'avulsos' ? avulsos : entradas;

    const th = { padding: '1rem 1.25rem', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' };

    return (
        <div style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Receipt size={32} color="var(--primary)" /> Recibos Emitidos
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: '6px 0 0', fontSize: '0.9rem' }}>
                        Gestão de todos os recibos (Fluxo de Caixa e Avulsos)
                    </p>
                </div>
                <button onClick={() => setModal({ initial: null })} className="btn-premium" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={18} /> Novo Recibo Avulso
                </button>
            </div>

            {/* Filters */}
            <div className="glass card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Buscar</label>
                    <Search size={15} style={{ position: 'absolute', left: '12px', bottom: '12px', color: 'var(--text-muted)' }} />
                    <input placeholder="Título, cliente, categoria..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 0, paddingLeft: '34px', width: '100%' }} />
                </div>
                <button onClick={fetchReceipts} className="btn-icon" title="Atualizar" style={{ flexShrink: 0, alignSelf: 'flex-end' }}>
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
                <button
                    onClick={() => setActiveTab('avulsos')}
                    style={{
                        padding: '12px 24px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'avulsos' ? '3px solid var(--primary)' : '3px solid transparent',
                        color: activeTab === 'avulsos' ? 'white' : 'var(--text-muted)',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        marginBottom: '-2px'
                    }}
                >
                    Recibos Avulsos ({avulsos.length})
                </button>
                <button
                    onClick={() => setActiveTab('entradas')}
                    style={{
                        padding: '12px 24px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'entradas' ? '3px solid var(--primary)' : '3px solid transparent',
                        color: activeTab === 'entradas' ? 'white' : 'var(--text-muted)',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        marginBottom: '-2px'
                    }}
                >
                    Entradas de Projetos ({entradas.length})
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
                                    <th style={th}>Número</th>
                                    <th style={th}>Data Emissão</th>
                                    <th style={th}>Título / Referência</th>
                                    <th style={th}>Cliente / Parceiro</th>
                                    <th style={th}>Categoria</th>
                                    <th style={{ ...th, textAlign: 'right' }}>Valor</th>
                                    <th style={th}>Situação</th>
                                    <th style={th}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedRows.length === 0 ? (
                                    <tr><td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum recibo encontrado.</td></tr>
                                ) : displayedRows.map(row => {
                                    const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.EM_ABERTO;
                                    return (
                                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '0.9rem 1.25rem', fontWeight: '800' }}>#{row.id}</td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontWeight: '700', fontSize: '0.88rem' }}>{fmtDate(row.due_date)}</td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontWeight: '600', fontSize: '0.88rem' }}>
                                                <div>{row.title}</div>
                                                {row.description && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{row.description}</div>}
                                            </td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.88rem', color: 'white' }}>{row.partner_name || '—'}</td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.category}</td>
                                            <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right', fontWeight: '800', fontSize: '1rem', color: '#10b981' }}>
                                                {maskCurrency(row.value)}
                                            </td>
                                            <td style={{ padding: '0.9rem 1.25rem' }}>
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '800',
                                                    background: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.color}`
                                                }}>
                                                    {cfg.label.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.9rem 1.25rem' }}>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button className="btn-icon" title="Gerar / Imprimir Recibo" onClick={() => setPrintModal(row)} style={{ color: '#10b981' }}>
                                                        <FileText size={15} />
                                                    </button>
                                                    <button className="btn-icon" title="Editar" onClick={() => setModal({ initial: { ...row, value: maskCurrency(row.value) } })} style={{ color: 'var(--text-muted)' }}>
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button className="btn-icon" title="Excluir" onClick={() => handleDelete(row.id)} style={{ color: '#ef4444' }}>
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modal && (
                <ReceiptFormModal
                    initial={modal.initial}
                    onClose={() => setModal(null)}
                    onSaved={async (savedId) => {
                        setModal(null);
                        setLoading(true);
                        try {
                            const res = await api.get('/financial-flows?type=CREDITO');
                            const updatedList = res.data || [];
                            setRows(updatedList);
                            const savedFlow = updatedList.find(x => x.id === savedId);
                            if (savedFlow) {
                                setPrintModal(savedFlow);
                            }
                        } catch (e) {
                            console.error(e);
                        }
                        setLoading(false);
                    }}
                />
            )}

            {printModal && (
                <ReceiptModal
                    flow={printModal}
                    onClose={() => setPrintModal(null)}
                />
            )}
        </div>
    );
};

export default Receipts;
