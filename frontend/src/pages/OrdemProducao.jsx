import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { ClipboardList, RefreshCw, Search, ArrowRight, CheckCircle, User, Calendar, Eye, X, Factory, Wrench, Hash, Paperclip, FileText, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Lightbox ──────────────────────────────────────────────────────────────────
const Lightbox = ({ src, onClose }) => (
    <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out'
    }}>
        <img src={src} alt="preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 0 60px rgba(0,0,0,0.8)' }} />
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 20 }}>✕</button>
    </div>
);

// ── Modal de Detalhes da OS ───────────────────────────────────────────────────
const OSDetailModal = ({ proposal, onClose }) => {
    const [globalAttachments, setGlobalAttachments] = useState([]);
    const [events, setEvents] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [activeSection, setActiveSection] = useState('items'); // 'items' | 'events' | 'attachments'

    const fmt = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

    const budgetItems = (() => {
        try { return JSON.parse(proposal.budget_data || '[]'); } catch { return []; }
    })();

    const fabricDays = budgetItems.reduce((s, i) => s + (Number(i.df) || 0), 0);
    const assemblyDays = budgetItems.reduce((s, i) => s + (Number(i.dm) || 0), 0);

    const entryDate = proposal.phase_date ? new Date(proposal.phase_date) : null;
    const conclusionDate = entryDate ? new Date(entryDate.getTime() + (fabricDays + assemblyDays) * 86400000) : null;

    useEffect(() => {
        if (!proposal?.id) return;
        api.get(`/proposals/${proposal.id}/attachments`)
            .then(r => setGlobalAttachments(r.data || []))
            .catch(() => {});
        api.get(`/proposals/${proposal.id}/events`)
            .then(r => setEvents(r.data || []))
            .catch(() => {});
    }, [proposal?.id]);

    const isImage = (url = '') => /\.(jpe?g|png|gif|webp|svg)$/i.test(url);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
            <div style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 16, width: '95%', maxWidth: 1400, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 80px rgba(0,0,0,0.5)' }}>

                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <ClipboardList size={20} color="#a78bfa" />
                            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>OS #{proposal.id} — {proposal.partner_name}</span>
                        </div>
                        <p style={{ color: 'var(--text-muted, #888)', fontSize: '0.875rem', margin: 0 }}>{proposal.description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted, #888)' }}>
                        <span><Calendar size={13} style={{ marginRight: 4 }} />Entrada: <b>{fmt(proposal.phase_date)}</b></span>
                        <span><Calendar size={13} style={{ marginRight: 4 }} />Previsão: <b>{conclusionDate ? fmt(conclusionDate) : '—'}</b></span>
                        <span><Factory size={13} style={{ marginRight: 4 }} />Fábrica: <b>{fabricDays}d</b></span>
                        <span><Wrench size={13} style={{ marginRight: 4 }} />Montagem: <b>{assemblyDays}d</b></span>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: 18 }}>✕</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, padding: '0.75rem 1.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {[['items', 'Itens', budgetItems.length], ['events', 'Eventos', events.length], ['attachments', 'Anexos Gerais', globalAttachments.length]].map(([key, label, count]) => (
                        <button key={key} onClick={() => { setActiveSection(key); setSelectedItem(null); }} style={{
                            padding: '0.5rem 1rem', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                            background: activeSection === key ? 'rgba(167,139,250,0.15)' : 'transparent',
                            color: activeSection === key ? '#a78bfa' : 'var(--text-muted, #888)',
                            borderBottom: activeSection === key ? '2px solid #a78bfa' : '2px solid transparent'
                        }}>
                            {label} {count > 0 && <span style={{ background: 'rgba(167,139,250,0.3)', borderRadius: 10, padding: '1px 7px', fontSize: '0.75rem', marginLeft: 4 }}>{count}</span>}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 0 }}>

                    {/* SEÇÃO: ITENS */}
                    {activeSection === 'items' && (
                        <>
                            {/* Lista de itens */}
                            <div style={{ width: 280, borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', padding: '1rem' }}>
                                <p style={{ color: 'var(--text-muted,#888)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.75rem' }}>Itens do Orçamento</p>
                                {budgetItems.length === 0 && <p style={{ color: '#666', fontSize: '0.85rem' }}>Nenhum item.</p>}
                                {budgetItems.map((item, idx) => {
                                    const hasImages = (item.images || []).length > 0;
                                    return (
                                        <div key={idx} onClick={() => setSelectedItem(item)} style={{
                                            padding: '0.75rem', borderRadius: 10, cursor: 'pointer', marginBottom: 6,
                                            background: selectedItem === item ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${selectedItem === item ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.06)'}`,
                                            transition: 'all 0.15s'
                                        }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 2 }}>{item.name || `Item ${idx + 1}`}</div>
                                            <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted,#888)' }}>
                                                {item.df && <span><Factory size={11} /> {item.df}d fáb.</span>}
                                                {item.dm && <span><Wrench size={11} /> {item.dm}d mont.</span>}
                                                {hasImages && <span style={{ color: '#a78bfa' }}><Paperclip size={11} /> {item.images.length}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Detalhe do item selecionado */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                                {!selectedItem ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555' }}>
                                        <FileText size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                                        <p>Selecione um item para ver os detalhes</p>
                                    </div>
                                ) : (
                                    <>
                                        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#a78bfa' }}>{selectedItem.name}</h3>
                                        {selectedItem.description && (
                                            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                                {selectedItem.description}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-muted,#888)' }}>
                                            {selectedItem.df && <span><Factory size={13} /> Fábrica: <b>{selectedItem.df}d</b></span>}
                                            {selectedItem.dm && <span><Wrench size={13} /> Montagem: <b>{selectedItem.dm}d</b></span>}
                                            {selectedItem.width && <span>L: <b>{selectedItem.width}cm</b></span>}
                                            {selectedItem.height && <span>A: <b>{selectedItem.height}cm</b></span>}
                                            {selectedItem.depth && <span>P: <b>{selectedItem.depth}cm</b></span>}
                                        </div>
                                        {(selectedItem.images || []).length > 0 ? (
                                            <>
                                                <p style={{ color: 'var(--text-muted,#888)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.75rem' }}>Imagens do Item</p>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                                                    {selectedItem.images.map((img, i) => (
                                                        <div key={i} onClick={() => setLightboxSrc(img.url)} style={{ cursor: 'zoom-in', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', aspectRatio: '4/3', background: '#111' }}>
                                                            <img src={img.url} alt={img.name || `img ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                                                                onMouseOver={e => e.target.style.transform = 'scale(1.05)'}
                                                                onMouseOut={e => e.target.style.transform = 'scale(1)'}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <p style={{ color: '#555', fontSize: '0.85rem' }}>Nenhuma imagem para este item.</p>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    {/* SEÇÃO: EVENTOS */}
                    {activeSection === 'events' && (
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                            {events.length === 0 ? (
                                <p style={{ color: '#555' }}>Nenhum evento registrado.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {events.map((ev, i) => (
                                        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '0.875rem 1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ev.title}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted,#888)' }}>{fmt(ev.event_date)}</span>
                                            </div>
                                            {ev.description && <p style={{ color: 'var(--text-muted,#888)', fontSize: '0.825rem', margin: 0 }}>{ev.description}</p>}
                                            {ev.attachment_count > 0 && (
                                                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#a78bfa' }}>
                                                    <Paperclip size={12} /> {ev.attachment_count} anexo(s)
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SEÇÃO: ANEXOS GERAIS */}
                    {activeSection === 'attachments' && (
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                            {globalAttachments.length === 0 ? (
                                <p style={{ color: '#555' }}>Nenhum anexo geral.</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                                    {globalAttachments.map((att, i) => isImage(att.url) ? (
                                        <div key={i} onClick={() => setLightboxSrc(att.url)} style={{ cursor: 'zoom-in', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', aspectRatio: '4/3', background: '#111' }}>
                                            <img src={att.url} alt={att.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    ) : (
                                        <a key={i} href={att.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', color: '#ccc', fontSize: '0.8rem' }}>
                                            <FileText size={18} color="#a78bfa" />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Card de OS ────────────────────────────────────────────────────────────────
const OSCard = ({ proposal, onAdvance, onDetail }) => {
    const fmt = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
    const budgetItems = (() => { try { return JSON.parse(proposal.budget_data || '[]'); } catch { return []; } })();
    const fabricDays = budgetItems.reduce((s, i) => s + (Number(i.df) || 0), 0);
    const assemblyDays = budgetItems.reduce((s, i) => s + (Number(i.dm) || 0), 0);

    return (
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '0.875rem', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 10, transition: 'border-color 0.2s' }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(167,139,250,0.35)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>OS #{proposal.id}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted,#888)', marginTop: 2 }}>{proposal.partner_name}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => onDetail(proposal)} title="Ver detalhes" style={{ background: 'rgba(167,139,250,0.15)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#a78bfa' }}>
                        <Eye size={14} />
                    </button>
                    <button onClick={() => onDetail(proposal)} title="Anexos" style={{ background: 'rgba(167,139,250,0.1)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#a78bfa' }}>
                        <Paperclip size={14} />
                    </button>
                    {onAdvance && (
                        <button onClick={() => onAdvance(proposal)} title="Avançar fase" style={{ background: 'rgba(16,185,129,0.15)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#10b981' }}>
                            <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted,#888)' }}>
                {proposal.description && <p style={{ margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proposal.description}</p>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span><Calendar size={11} /> {fmt(proposal.phase_date)}</span>
                    {fabricDays > 0 && <span><Factory size={11} /> {fabricDays}d</span>}
                    {assemblyDays > 0 && <span><Wrench size={11} /> {assemblyDays}d</span>}
                </div>
            </div>
        </div>
    );
};

// ── Componente Principal ──────────────────────────────────────────────────────
const PHASES = [
    { key: 'Técnica',   label: 'Técnica',   next: 'Produção' },
    { key: 'Produção',  label: 'Produção',  next: 'Despacho' },
    { key: 'Despacho',  label: 'Despacho',  next: 'Montagem' },
    { key: 'Montagem',  label: 'Montagem',  next: 'Concluído' },
    { key: 'Concluído', label: 'Concluído', next: null },
];

const OrdemProducao = () => {
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('Técnica');
    const [detailProposal, setDetailProposal] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/proposals');
            // A API retorna { proposals: [...], settings: {...} }
            const all = Array.isArray(res.data) ? res.data : (res.data?.proposals || []);
            setProposals(all.filter(p => p.status === 'APROVADO'));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAdvance = async (proposal) => {
        const currentPhase = PHASES.find(p => p.key === proposal.phase);
        if (!currentPhase?.next) return;
        try {
            await api.put(`/proposals/${proposal.id}/production-phase`, { phase: currentPhase.next });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const filtered = proposals
        .filter(p => p.phase === activeTab)
        .filter(p =>
            !search ||
            p.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
            p.description?.toLowerCase().includes(search.toLowerCase()) ||
            String(p.id) === search
        )
        .sort((a, b) => new Date(a.phase_date || 0) - new Date(b.phase_date || 0));

    const currentPhase = PHASES.find(p => p.key === activeTab);

    return (
        <div style={{ padding: '1.5rem' }}>
            {/* Cabeçalho */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ClipboardList size={24} color="#a78bfa" />
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>Ordem de Produção</h1>
                        <p style={{ margin: 0, color: 'var(--text-muted,#888)', fontSize: '0.85rem' }}>Gestão do fluxo de produção</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar OS..." style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.85rem', outline: 'none', width: 200 }} />
                    </div>
                    <button onClick={fetchData} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#ccc' }}>
                        <RefreshCw size={15} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Abas de fase */}
            <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: 4 }}>
                {PHASES.map(phase => {
                    const count = proposals.filter(p => p.phase === phase.key).length;
                    return (
                        <button key={phase.key} onClick={() => setActiveTab(phase.key)} style={{
                            padding: '0.5rem 1.1rem', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', transition: 'all 0.2s',
                            background: activeTab === phase.key ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
                            color: activeTab === phase.key ? '#a78bfa' : 'var(--text-muted,#888)',
                            border: `1px solid ${activeTab === phase.key ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.07)'}`,
                        }}>
                            {phase.label}
                            {count > 0 && <span style={{ marginLeft: 6, background: activeTab === phase.key ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '1px 7px', fontSize: '0.75rem' }}>{count}</span>}
                        </button>
                    );
                })}
            </div>

            {/* Lista */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Carregando...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#555' }}>
                    <ClipboardList size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p>Nenhuma OS na fase <b>{currentPhase?.label}</b></p>
                </div>
            ) : (
                <div style={{ columns: '320px', gap: '1rem' }}>
                    {filtered.map(p => (
                        <div key={p.id} style={{ breakInside: 'avoid', marginBottom: 0 }}>
                            <OSCard
                                proposal={p}
                                onDetail={setDetailProposal}
                                onAdvance={currentPhase?.next ? handleAdvance : null}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de detalhe */}
            {detailProposal && <OSDetailModal proposal={detailProposal} onClose={() => setDetailProposal(null)} />}
        </div>
    );
};

export default OrdemProducao;
