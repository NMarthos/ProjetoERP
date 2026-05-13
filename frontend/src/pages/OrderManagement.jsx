import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { ClipboardList, RefreshCw, Search, ArrowRight, CheckCircle, Clock, User, Calendar, DollarSign } from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────
const TABS = [
    { key: 'Técnica',   label: 'Técnica',   color: '#6366f1', icon: '🔬' },
    { key: 'Produção',  label: 'Produção',  color: '#f59e0b', icon: '🏭' },
    { key: 'Despacho',  label: 'Despacho',  color: '#3b82f6', icon: '🚚' },
    { key: 'Instalação',label: 'Instalação',color: '#8b5cf6', icon: '🔧' },
    { key: 'Concluído', label: 'Concluídos',color: '#10b981', icon: '✅' },
];

const NEXT_PHASE = {
    'Técnica':    'Produção',
    'Produção':   'Despacho',
    'Despacho':   'Instalação',
    'Instalação': 'Concluído',
};

const maskCurrency = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

// ── Card de Proposta ──────────────────────────────────────────────────────────
const ProposalCard = ({ proposal, tab, onAdvance, advancing }) => {
    const next = NEXT_PHASE[tab.key];
    const tabCfg = TABS.find(t => t.key === tab.key);

    let budgetItems = [];
    try { budgetItems = proposal.budget_data ? JSON.parse(proposal.budget_data) : []; } catch(e) {}
    const itemCount = budgetItems.length;

    return (
        <div style={{
            background: 'var(--card-bg)',
            border: `1px solid var(--border)`,
            borderLeft: `4px solid ${tab.color}`,
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            transition: 'transform 0.15s, box-shadow 0.15s',
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.3)`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: '800', color: tab.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        {tabCfg?.icon} {tab.key} · #{proposal.id}
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '1rem', lineHeight: 1.3 }}>
                        {proposal.partner_name}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Valor</div>
                    <div style={{ fontWeight: '900', color: '#10b981', fontSize: '0.95rem' }}>{maskCurrency(proposal.value)}</div>
                </div>
            </div>

            {/* Description */}
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                {proposal.description}
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {proposal.creator_name && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={11} /> {proposal.creator_name}
                    </span>
                )}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} /> {fmtDate(proposal.created_at?.split('T')[0])}
                </span>
                {itemCount > 0 && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ClipboardList size={11} /> {itemCount} ambiente{itemCount !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Advance button */}
            {next && (
                <button
                    onClick={() => onAdvance(proposal.id, next)}
                    disabled={advancing === proposal.id}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        width: '100%', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer',
                        border: `1px solid ${tab.color}`, background: `${tab.color}18`,
                        color: tab.color, fontWeight: '700', fontSize: '0.82rem',
                        transition: 'all 0.15s', marginTop: '4px',
                        opacity: advancing === proposal.id ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (advancing !== proposal.id) { e.currentTarget.style.background = `${tab.color}30`; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${tab.color}18`; }}
                >
                    {advancing === proposal.id ? (
                        <RefreshCw size={14} />
                    ) : (
                        <ArrowRight size={14} />
                    )}
                    {advancing === proposal.id ? 'Avançando...' : `Avançar para ${next}`}
                </button>
            )}

            {tab.key === 'Concluído' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', color: '#10b981', fontSize: '0.82rem', fontWeight: '700' }}>
                    <CheckCircle size={14} /> Concluído
                </div>
            )}
        </div>
    );
};

// ── Página Principal ──────────────────────────────────────────────────────────
const OrderManagement = () => {
    const [activeTab, setActiveTab] = useState('Técnica');
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [advancing, setAdvancing] = useState(null);
    const [error, setError] = useState('');

    const fetchProposals = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/proposals');
            // Filtra só aprovadas (com fase de produção)
            const all = res.data.proposals || [];
            setProposals(all.filter(p => p.status === 'APROVADO'));
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchProposals(); }, [fetchProposals]);

    const handleAdvance = async (id, newPhase) => {
        setAdvancing(id);
        setError('');
        try {
            await api.put(`/proposals/${id}`, { phase: newPhase });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, phase: newPhase } : p));
        } catch (e) {
            setError('Erro ao avançar fase: ' + (e.response?.data?.error || e.message));
        }
        setAdvancing(null);
    };

    const currentTab = TABS.find(t => t.key === activeTab);

    const filtered = proposals
        .filter(p => p.phase === activeTab)
        .filter(p =>
            !search ||
            p.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
            p.description?.toLowerCase().includes(search.toLowerCase()) ||
            String(p.id) === search
        );

    // Contagem por fase para badges
    const countByPhase = {};
    TABS.forEach(t => {
        countByPhase[t.key] = proposals.filter(p => p.phase === t.key).length;
    });

    return (
        <div style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ClipboardList size={32} color="var(--primary)" /> Ordens de Produção
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: '6px 0 0', fontSize: '0.9rem' }}>
                        Acompanhamento e avanço de propostas aprovadas por fase
                    </p>
                </div>
                <button onClick={fetchProposals} className="btn-icon" title="Atualizar" style={{ marginTop: '6px' }}>
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Pipeline summary bar */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '6px', border: '1px solid var(--border)' }}>
                {TABS.map((tab, i) => (
                    <div key={tab.key} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: tab.color, lineHeight: 1 }}>{countByPhase[tab.key] || 0}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{tab.label}</div>
                        </div>
                        {i < TABS.length - 1 && <div style={{ width: '1px', height: '32px', background: 'var(--border)' }} />}
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '1.5rem', gap: '4px' }}>
                {TABS.map(tab => {
                    const isActive = activeTab === tab.key;
                    const count = countByPhase[tab.key] || 0;
                    return (
                        <div
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setSearch(''); }}
                            style={{
                                padding: '10px 20px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: '700',
                                color: isActive ? tab.color : 'var(--text-muted)',
                                borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                                marginBottom: '-2px', transition: 'all 0.15s',
                                display: 'flex', alignItems: 'center', gap: '8px',
                            }}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                            {count > 0 && (
                                <span style={{
                                    background: isActive ? tab.color : 'rgba(255,255,255,0.1)',
                                    color: isActive ? 'white' : 'var(--text-muted)',
                                    borderRadius: '20px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: '800'
                                }}>
                                    {count}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Search + error */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        placeholder={`Buscar em ${currentTab?.label}...`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: '36px', marginBottom: 0, width: '100%' }}
                    />
                </div>
                {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '600' }}>{error}</div>}
            </div>

            {/* Cards Grid */}
            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={32} style={{ opacity: 0.4, marginBottom: '12px' }} />
                    <div>Carregando...</div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{currentTab?.icon}</div>
                    <div style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '6px' }}>
                        Nenhuma ordem na fase {currentTab?.label}
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                        {search ? 'Nenhum resultado para a busca.' : 'As propostas aprovadas nesta fase aparecerão aqui.'}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {filtered.map(p => (
                        <ProposalCard
                            key={p.id}
                            proposal={p}
                            tab={currentTab}
                            onAdvance={handleAdvance}
                            advancing={advancing}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrderManagement;
