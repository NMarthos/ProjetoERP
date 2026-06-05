

import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Plus, Search, FileText, X, CheckCircle, Clock, XCircle, Pencil, Trash2, UserCheck, User, UserPlus, CalendarPlus, BellRing, ClipboardCheck, Image, Paperclip, UploadCloud, File, Trash, Monitor, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import BudgetModal from './BudgetModal';
import { PartnerModal } from './Partners';
import BuildPresentationModal from './BuildPresentationModal';

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
        phase: 'Comercial' 
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [partnerModalOpen, setPartnerModalOpen] = useState(false);

    useEffect(() => {
        fetchPartners();
        if (proposal) {
            setForm({
                partner_id: proposal.partner_id,
                description: proposal.description,
                status: proposal.status,
                phase: proposal.phase || 'Comercial'
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ margin: 0 }}>Parceiro (Cliente/Arquiteto) *</label>
                            <button
                                type="button"
                                onClick={() => setPartnerModalOpen(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', padding: 0 }}
                            >
                                <UserPlus size={15} /> Novo Cliente
                            </button>
                        </div>
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

                    {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                        <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                        <button type="submit" disabled={loading} className="btn-premium" style={{ flex: 1 }}>{loading ? 'Salvando...' : 'Salvar Proposta'}</button>
                    </div>
                </form>
                {partnerModalOpen && (
                    <PartnerModal
                        partner={null}
                        allPartners={partners}
                        initialTab="dados"
                        onClose={() => setPartnerModalOpen(false)}
                        onSave={async (newId) => {
                            await fetchPartners();
                            if (newId) {
                                setForm(f => ({ ...f, partner_id: newId }));
                            }
                            setPartnerModalOpen(false);
                        }}
                    />
                )}
            </div>
        </div>,
        document.body
    );
};

// ── Modal de Anexos da Proposta ──────────────────────────────────────────────

const AttachmentsModal = ({ proposal, onClose }) => {
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchAttachments();
    }, [proposal.id]);

    const fetchAttachments = async () => {
        try {
            const r = await api.get(`/proposals/${proposal.id}/attachments`);
            setAttachments(r.data);
        } catch (e) { console.error(e); }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            await api.post(`/proposals/${proposal.id}/attachments`, {
                name: file.name,
                url: uploadRes.data.url,
                type: file.type
            });
            fetchAttachments();
        } catch (err) {
            setError('Erro ao enviar arquivo: ' + (err.response?.data?.error || err.message));
        }
        setUploading(false);
        e.target.value = '';
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Remover este anexo?')) return;
        try {
            await api.delete(`/attachments/${id}`);
            fetchAttachments();
        } catch (err) {
            setError('Erro ao remover anexo');
        }
    };

    const isImage = (att) =>
        (att.type && att.type.startsWith('image')) ||
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(att.url || att.name || '');

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Paperclip size={22} color="var(--primary)" /> Anexos da Proposta
                        </h2>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>#{proposal.id} — {proposal.description}</div>
                    </div>
                    <button onClick={onClose} className="btn-icon"><X /></button>
                </div>

                {/* Upload Area */}
                <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        border: '2px dashed var(--border)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        marginBottom: '1.5rem',
                        background: 'rgba(99,102,241,0.04)',
                        transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                    <UploadCloud size={32} color="var(--primary)" style={{ marginBottom: '8px' }} />
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                        {uploading ? 'Enviando...' : 'Clique para anexar arquivo'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Imagens, PDFs, documentos, etc.</div>
                    <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} disabled={uploading} />
                </div>

                {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

                {/* Attachments List */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {attachments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                            Nenhum arquivo anexado.
                        </div>
                    ) : attachments.map(att => (
                        <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--border)' }}>
                            {isImage(att) ? (
                                <img src={att.url} alt={att.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                            ) : (
                                <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.15)', borderRadius: '6px', flexShrink: 0 }}>
                                    <File size={22} color="var(--primary)" />
                                </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ color: 'white', fontWeight: '600', fontSize: '0.9rem', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    onMouseEnter={e => e.target.style.color = 'var(--primary)'}
                                    onMouseLeave={e => e.target.style.color = 'white'}
                                >
                                    {att.name}
                                </a>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{att.type || 'arquivo'}</div>
                            </div>
                            <button
                                onClick={() => handleDelete(att.id)}
                                title="Remover anexo"
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '6px', flexShrink: 0 }}
                            >
                                <Trash size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
};

const EventModal = ({ proposal, onClose }) => {
    const [events, setEvents] = useState([]);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('eventos');
    const [form, setForm] = useState({ title: '', event_date: '', event_time: '', description: '', type: 'Levantamento de medidas', event_status: 'ABERTO', monitor: false });
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [eventAttachments, setEventAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [cardUploadingId, setCardUploadingId] = useState(null);
    const eventFileRef = useRef(null);

    const EMPTY_FORM = { title: '', event_date: '', event_time: '', description: '', type: 'Levantamento de medidas', event_status: 'ABERTO', monitor: false };

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

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        if (form.type === 'Levantamento de medidas') {
            const desc = form.description || '';
            const descLower = desc.toLowerCase();
            const hasLogradouro = descLower.includes('logradouro');
            const hasNumero = descLower.includes('numero') || descLower.includes('número');
            const hasComplemento = descLower.includes('complemento');
            
            if (!hasLogradouro || !hasNumero || !hasComplemento) {
                alert('Para Levantamento de Medidas, informe na Descrição os campos:\nLogradouro:\nNumero:\nComplemento:');
                return;
            }
        }
        setSaving(true);
        if (editingId) {
            await api.put(`/events/${editingId}`, form);
            setEditingId(null);
        } else {
            await api.post(`/proposals/${proposal.id}/events`, form);
        }
        setForm(EMPTY_FORM);
        await fetchEvents();
        setSaving(false);
    };

    const handleEditEvent = (ev) => {
        setEditingId(ev.id);
        setEventAttachments([]);
        setForm({
            title: ev.title || '',
            event_date: ev.event_date || '',
            event_time: ev.event_time || '',
            description: ev.description || '',
            type: ev.type || 'Levantamento de medidas',
            event_status: ev.event_status || 'ABERTO',
            monitor: ev.monitor === 1,
        });
        api.get(`/events/${ev.id}/attachments`).then(r => setEventAttachments(r.data)).catch(() => {});
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEventAttachments([]);
        setForm(EMPTY_FORM);
    };

    const handleEventFileUpload = async (e) => {
        const file = e.target.files[0];
        console.log('[EDIT ATTACH] file:', file?.name, 'editingId:', editingId);
        if (!file || !editingId) {
            console.warn('[EDIT ATTACH] Aborted — file or editingId missing');
            return;
        }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            console.log('[EDIT ATTACH] Uploading to /upload...');
            const uploadRes = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            console.log('[EDIT ATTACH] Upload OK, url:', uploadRes.data.url);
            await api.post(`/events/${editingId}/attachments`, { name: file.name, url: uploadRes.data.url, type: file.type });
            console.log('[EDIT ATTACH] Attachment saved OK');
            const r = await api.get(`/events/${editingId}/attachments`);
            setEventAttachments(r.data);
        } catch (err) {
            console.error('[EDIT ATTACH] Error:', err?.response?.data || err.message);
        }
        setUploading(false);
        e.target.value = '';
    };

    const handleDeleteEventAttachment = async (id) => {
        if (!window.confirm('Remover este anexo?')) return;
        await api.delete(`/event-attachments/${id}`).catch(() => {});
        const r = await api.get(`/events/${editingId}/attachments`);
        setEventAttachments(r.data);
    };

    const handleToggleStatus = async (ev) => {
        const newStatus = ev.event_status === 'FECHADO' ? 'ABERTO' : 'FECHADO';
        await api.put(`/events/${ev.id}`, {
            ...ev, event_status: newStatus, monitor: ev.monitor === 1,
        });
        fetchEvents();
    };

    const handleToggleMonitor = async (ev) => {
        await api.put(`/events/${ev.id}`, {
            event_date: ev.event_date, event_time: ev.event_time,
            title: ev.title || '', description: ev.description,
            type: ev.type || 'Anotacao', event_status: ev.event_status || 'ABERTO',
            monitor: ev.monitor !== 1,
        });
        fetchEvents();
    };

    const handleDeleteEvent = async (id) => {
        if (!window.confirm('Remover este evento?')) return;
        await api.delete(`/events/${id}`).catch(() => {});
        fetchEvents();
    };

    const uploadEventAttachment = async (file, eventId) => {
        if (!file || !eventId) return;
        setCardUploadingId(eventId);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            await api.post(`/events/${eventId}/attachments`, {
                name: file.name, url: uploadRes.data.url, type: file.type,
            });
        } catch (err) {
            console.error('[EVENT ATTACH] Error:', err?.response?.data || err.message);
        }
        setCardUploadingId(null);
    };

    const tabStyle = (key) => ({
        padding: '10px 18px', cursor: 'pointer', fontSize: '0.85rem',
        fontWeight: activeTab === key ? '700' : '500',
        color: activeTab === key ? 'var(--primary)' : 'var(--text-muted)',
        borderBottom: activeTab === key ? '2px solid var(--primary)' : '2px solid transparent',
        transition: 'all 0.15s',
    });

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '1280px', width: '98%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem' }}>
                            <CalendarPlus size={22} color="var(--primary)" /> Agenda da Proposta
                        </h2>
                        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.88rem' }}>#{proposal.id} — {proposal.description}</p>
                    </div>
                    <button onClick={onClose} className="btn-icon"><X /></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                    <div style={tabStyle('eventos')} onClick={() => setActiveTab('eventos')}>Eventos & Alertas</div>
                    <div style={tabStyle('historico')} onClick={() => setActiveTab('historico')}>Histórico de Fases</div>
                </div>

                {activeTab === 'eventos' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: editingId ? '360px 1fr 320px' : '400px 1fr', gap: '1.5rem', flex: 1, overflow: 'hidden', minHeight: 0 }}>

                        {/* LEFT — Form card */}
                        <div className="glass card" style={{ border: `2px solid ${editingId ? 'var(--primary)' : 'var(--border)'}`, height: '100%', overflowY: 'auto', transition: 'border-color 0.2s' }}>
                            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '1rem' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {editingId ? <Pencil size={18} color="var(--primary)" /> : <Plus size={18} color="var(--primary)" />}
                                    {editingId ? 'Editando Evento' : 'Novo Evento'}
                                </span>
                                {editingId && (
                                    <button onClick={handleCancelEdit} className="btn-icon" title="Cancelar edição" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <X size={16} />
                                    </button>
                                )}
                            </h3>
                            <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label>Título</label>
                                    <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Reunião com cliente, Medição..." />
                                </div>
                                <div>
                                    <label>Tipo</label>
                                    <select 
                                        required 
                                        value={form.type} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            let desc = form.description || '';
                                            if (val === 'Levantamento de medidas') {
                                                if (desc.trim() === '' || !desc.toLowerCase().includes('logradouro')) {
                                                    desc = 'Logradouro: \nNumero: \nComplemento: ';
                                                }
                                            } else {
                                                // Remove address template lines
                                                desc = desc
                                                    .split('\n')
                                                    .filter(line => {
                                                        const l = line.trim().toLowerCase();
                                                        return !l.startsWith('logradouro:') && 
                                                               !l.startsWith('numero:') && 
                                                               !l.startsWith('número:') && 
                                                               !l.startsWith('complemento:');
                                                    })
                                                    .join('\n')
                                                    .trim();
                                            }
                                            setForm({ ...form, type: val, description: desc });
                                        }}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'white' }}
                                    >
                                        <option value="Levantamento de medidas">Levantamento de medidas</option>
                                        <option value="Confirmação de medidas">Confirmação de medidas</option>
                                        <option value="Outro">Outro</option>
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label>Data</label>
                                        <input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} style={{ colorScheme: 'dark' }} />
                                    </div>
                                    <div>
                                        <label>Horário</label>
                                        <input type="time" value={form.event_time} onChange={e => setForm({ ...form, event_time: e.target.value })} style={{ colorScheme: 'dark' }} />
                                    </div>
                                </div>
                                <div>
                                    <label>Descrição / Observações</label>
                                    <textarea 
                                        value={form.description} 
                                        onChange={e => setForm({ ...form, description: e.target.value })} 
                                        placeholder={form.type === 'Levantamento de medidas' ? "Logradouro:\nNumero:\nComplemento:" : "Detalhes adicionais..."} 
                                        style={{ minHeight: '100px', resize: 'vertical' }} 
                                    />
                                </div>
                                {/* Situação — only in edit mode */}
                                {editingId && (
                                    <div>
                                        <label>Situação</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {['ABERTO', 'FECHADO'].map(s => {
                                                const isActive = form.event_status === s;
                                                const color = s === 'FECHADO' ? '#22c55e' : '#f59e0b';
                                                return (
                                                    <div
                                                        key={s}
                                                        onClick={() => setForm({ ...form, event_status: s })}
                                                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontWeight: '700', fontSize: '0.82rem', userSelect: 'none', border: `1.5px solid ${isActive ? color : 'var(--border)'}`, background: isActive ? `${color}22` : 'rgba(255,255,255,0.03)', color: isActive ? color : 'var(--text-muted)', transition: 'all 0.15s' }}
                                                    >
                                                        {s === 'ABERTO' ? '○ Aberto' : '● Fechado'}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                <div onClick={() => setForm({ ...form, monitor: !form.monitor })} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 14px', borderRadius: '10px', userSelect: 'none', border: `1.5px solid ${form.monitor ? '#eab308' : 'var(--border)'}`, background: form.monitor ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.03)', transition: 'all 0.2s' }}>
                                    <div style={{ position: 'relative', width: '36px', height: '20px', borderRadius: '10px', background: form.monitor ? '#eab308' : 'rgba(255,255,255,0.15)', transition: 'background 0.2s', flexShrink: 0 }}>
                                        <div style={{ position: 'absolute', top: '3px', left: form.monitor ? '19px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                                    </div>
                                    <BellRing size={14} color={form.monitor ? '#eab308' : 'var(--text-muted)'} />
                                    <span style={{ fontSize: '0.82rem', fontWeight: form.monitor ? '700' : '400', color: form.monitor ? '#eab308' : 'var(--text-muted)' }}>
                                        {form.monitor ? 'Monitorando — alerta ativo' : 'Monitorar na listagem'}
                                    </span>
                                </div>
                                <button type="submit" className="btn-premium" disabled={saving} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    {saving ? 'Salvando...' : editingId ? <><Pencil size={16} /> Salvar Alterações</> : <><Plus size={16} /> Salvar Evento</>}
                                </button>
                            </form>
                        </div>

                        {/* MIDDLE — List card */}
                        <div className="glass card" style={{ border: '2px solid var(--border)', overflowY: 'auto' }}>
                            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>
                                Eventos Cadastrados <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '400' }}>({events.length})</span>
                            </h3>
                            {events.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nenhum evento cadastrado.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    {events.map((ev, idx) => {
                                        const hasDate = ev.event_date && ev.event_date.trim() !== '';
                                        const isMonitored = ev.monitor === 1;
                                        const isTarefa = ev.type === 'Tarefa';
                                        const isFechado = ev.event_status === 'FECHADO';
                                        const hasAttachments = (ev.attachment_count || 0) > 0;
                                        const statusColor = isFechado ? '#22c55e' : '#f59e0b';
                                        
                                        const getTypeBadgeConfig = (type) => {
                                            switch (type) {
                                                case 'Levantamento de medidas':
                                                    return { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Levantamento' };
                                                case 'Confirmação de medidas':
                                                    return { bg: 'rgba(234,179,8,0.15)', color: '#eab308', label: 'Confirmação' };
                                                case 'Tarefa':
                                                    return { bg: 'rgba(129,140,248,0.15)', color: '#818cf8', label: '✓ Tarefa' };
                                                case 'Outro':
                                                default:
                                                    return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: type || '✎ Anotação' };
                                            }
                                        };
                                        const typeConfig = getTypeBadgeConfig(ev.type);

                                        return (
                                            <div key={ev.id} style={{ padding: '14px 16px', borderRadius: '12px', background: editingId === ev.id ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${editingId === ev.id ? 'var(--primary)' : isMonitored ? '#eab308' : isFechado ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`, opacity: isFechado ? 0.75 : 1, transition: 'all 0.2s' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        {/* Type + Status badges */}
                                                        <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '2px 7px', borderRadius: '5px', background: typeConfig.bg, color: typeConfig.color, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                                                                {typeConfig.label}
                                                            </span>
                                                            <span
                                                                style={{ fontSize: '0.65rem', fontWeight: '800', padding: '2px 7px', borderRadius: '5px', background: isFechado ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: statusColor, letterSpacing: '0.4px', textTransform: 'uppercase' }}
                                                            >
                                                                {isFechado ? '● Fechado' : '○ Aberto'}
                                                            </span>
                                                            {hasAttachments && (
                                                                <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '2px 7px', borderRadius: '5px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Paperclip size={10} /> {ev.attachment_count}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {/* Title */}
                                                        <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: '3px', textDecoration: isFechado ? 'line-through' : 'none', color: isFechado ? 'var(--text-muted)' : 'inherit' }}>
                                                            {ev.title || ev.description}
                                                        </div>
                                                        {/* Description (only if title exists and description differs) */}
                                                        {ev.title && ev.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>{ev.description}</div>}
                                                        {/* Date + monitor badges */}
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                            {hasDate ? (
                                                                <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                                                                    📅 {new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}{ev.event_time ? ` às ${ev.event_time}` : ''}
                                                                </span>
                                                            ) : (
                                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>Sem data definida</span>
                                                            )}
                                                            {isMonitored && <span style={{ fontSize: '0.68rem', background: 'rgba(234,179,8,0.15)', color: '#eab308', padding: '2px 8px', borderRadius: '6px', fontWeight: '800' }}>MONITORADO</span>}
                                                        </div>
                                                        {ev.user_name && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '5px' }}>por {ev.user_name}</div>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, opacity: isTarefa && isFechado ? 0.35 : 1, pointerEvents: isTarefa && isFechado ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
                                                        <button
                                                            className="btn-icon"
                                                            title="Anexar arquivo a este evento"
                                                            disabled={isTarefa && isFechado}
                                                            style={{ color: cardUploadingId === ev.id ? 'var(--primary)' : 'var(--text-muted)', position: 'relative', cursor: isTarefa && isFechado ? 'not-allowed' : 'pointer' }}
                                                            onClick={() => {
                                                                const input = document.createElement('input');
                                                                input.type = 'file';
                                                                input.onchange = (e) => uploadEventAttachment(e.target.files[0], ev.id);
                                                                input.click();
                                                            }}
                                                        >
                                                            <Paperclip size={16} />
                                                            {cardUploadingId === ev.id && (
                                                                <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--primary)' }} />
                                                            )}
                                                        </button>
                                                        <button className="btn-icon" title="Editar evento" disabled={isTarefa && isFechado} onClick={() => handleEditEvent(ev)} style={{ color: editingId === ev.id ? 'var(--primary)' : 'var(--text-muted)' }}><Pencil size={16} /></button>
                                                        <button className="btn-icon" title={isMonitored ? 'Desativar alerta' : 'Ativar alerta'} disabled={isTarefa && isFechado} onClick={() => handleToggleMonitor(ev)} style={{ color: isMonitored ? '#eab308' : 'var(--text-muted)' }}><BellRing size={16} /></button>
                                                        <button className="btn-icon" title="Excluir evento" disabled={isTarefa && isFechado} onClick={() => handleDeleteEvent(ev.id)} style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* RIGHT — Attachments (only in edit mode) */}
                        {editingId && (
                            <div className="glass card" style={{ border: '2px solid var(--border)', height: '100%', overflowY: 'auto' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Paperclip size={16} color="var(--primary)" /> Anexos do Evento ({eventAttachments.length})
                                </div>
                                <div
                                    onClick={() => eventFileRef.current?.click()}
                                    style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'rgba(99,102,241,0.03)', transition: 'all 0.2s', marginBottom: '1.25rem' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                >
                                    <UploadCloud size={28} color="var(--primary)" style={{ marginBottom: '8px' }} />
                                    <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>{uploading ? 'Enviando...' : 'Anexar Arquivo'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>PDF, imagens, documentos</div>
                                    <input ref={eventFileRef} type="file" style={{ display: 'none' }} onChange={handleEventFileUpload} disabled={uploading} />
                                </div>
                                
                                {eventAttachments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {eventAttachments.map(att => {
                                            const isImg = (att.type && att.type.startsWith('image')) || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.url || att.name || '');
                                            return (
                                                <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px', border: '1px solid var(--border)' }}>
                                                    {isImg ? (
                                                        <img src={att.url} alt={att.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                                                    ) : (
                                                        <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.15)', borderRadius: '6px', flexShrink: 0 }}>
                                                            <File size={18} color="var(--primary)" />
                                                        </div>
                                                    )}
                                                    <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, color: 'white', fontWeight: '600', fontSize: '0.82rem', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                        onMouseEnter={e => e.target.style.color = 'var(--primary)'}
                                                        onMouseLeave={e => e.target.style.color = 'white'}
                                                    >{att.name}</a>
                                                    <button onClick={() => handleDeleteEventAttachment(att.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
                                                        <Trash size={18} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                                        Nenhum anexo para este evento.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {history.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>Nenhuma mudança de fase registrada.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {history.map((h, idx) => (
                                    <div key={h.id} style={{ display: 'flex', gap: '15px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: idx === 0 ? 'var(--primary)' : 'var(--border)', border: '2px solid var(--card-bg)' }} />
                                            {idx !== history.length - 1 && <div style={{ width: '2px', flex: 1, background: 'var(--border)', margin: '4px 0' }} />}
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
                )}
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
    const [successMsg, setSuccessMsg] = useState('');
    const [availableMethods, setAvailableMethods] = useState([]);
    const [liveSettings, setLiveSettings] = useState(settingsProp);
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [showFluxo, setShowFluxo] = useState(false);
    const [fluxoRows, setFluxoRows] = useState([]);
    const [selectedCondIdx, setSelectedCondIdx] = useState(null);
    const [conditions, setConditions] = useState([]);

    useEffect(() => {
        if (!proposal) return;
        setForm({
            status: proposal.status || 'ABERTO',
            phase: proposal.phase || 'Comercial',
            description: proposal.description || '',
            payment_methods: proposal.payment_methods || '',
            payment_notes: proposal.payment_notes || ''
        });
        setSelectedCondIdx(null);
        setFluxoRows([]);
        let snap = null;
        if (proposal.pricing_snapshot) {
            try { snap = JSON.parse(proposal.pricing_snapshot); } catch(e) {}
        }
        
        if (snap && typeof snap === 'object') {
            setLiveSettings(snap);
        } else {
            api.get('/settings').then(r => setLiveSettings(r.data)).catch(() => {});
        }
        api.get('/payment-methods')
            .then(r => {
                const methods = r.data.filter(m => m.active);
                setAvailableMethods(methods);
                const method = [...methods].slice(-1)[0];
                if (method && method.conditions) {
                    setConditions(method.conditions.map(c => ({ ...c })));
                } else {
                    setConditions([]);
                }
            })
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

    const diasFabrica  = budgetItems.reduce((acc, item) =>
        acc + item.products.reduce((s, p) => {
            const unit = p.product?.unit?.toUpperCase();
            if (unit === 'DF') return s + (parseFloat(p.quantity) || 0);
            if (unit === 'DIA' && !p.product?.name?.toLowerCase().includes('montagem')) return s + (parseFloat(p.quantity) || 0);
            return s;
        }, 0), 0);
    const diasMontagem = budgetItems.reduce((acc, item) =>
        acc + item.products.reduce((s, p) => {
            const unit = p.product?.unit?.toUpperCase();
            if (unit === 'DM') return s + (parseFloat(p.quantity) || 0);
            if (unit === 'DIA' && p.product?.name?.toLowerCase().includes('montagem')) return s + (parseFloat(p.quantity) || 0);
            return s;
        }, 0), 0);

    // Most recent active method (by ID)
    const activeMethod = [...availableMethods].sort((a, b) => a.id - b.id).slice(-1)[0];

    const calcCondition = (cond) => {
        const installments = cond.installments !== undefined ? Number(cond.installments) : 1;
        const isAVista = installments === 0;
        const totalDiscountPct = cond.discount_percentage || 0;
        const discountedTotal = grandTotal * (1 - totalDiscountPct / 100);
        const financedTotal   = discountedTotal * (1 + (cond.finance_cost_percentage || 0) / 100);
        const downPct         = cond.down_payment_percentage || 0;
        const downValue       = financedTotal * (downPct / 100);
        const remaining       = financedTotal - downValue;
        const installAmt      = installments > 0 ? remaining / installments : financedTotal;
        return { installments, isAVista, totalDiscountPct, financedTotal, downPct, downValue, installAmt };
    };

    const buildFluxoRows = (cond, idx) => {
        const { installments, isAVista, financedTotal, downPct, downValue, installAmt } = calcCondition(cond);
        const today = new Date();
        const fmt = (d) => d.toISOString().split('T')[0];
        const rows = [];
        if (isAVista) {
            rows.push({ title: 'À vista', value: maskCurrency(financedTotal), date: fmt(today), note: '' });
        } else {
            if (downPct > 0) {
                rows.push({ title: 'Entrada', value: maskCurrency(downValue), date: fmt(today), note: '' });
            }
            for (let i = 1; i <= installments; i++) {
                const d = new Date(today);
                d.setMonth(d.getMonth() + i);
                rows.push({ title: `Parcela ${i}`, value: maskCurrency(installAmt), date: fmt(d), note: '' });
            }
        }
        return rows;
    };

    const handleSelectCondition = (cond, idx) => {
        const { installments, isAVista, totalDiscountPct, financedTotal, downPct, downValue, installAmt } = calcCondition(cond);
        const titleStr = cond.title ? ` - ${cond.title}` : '';
        let text = `Opção ${idx + 1}${titleStr}${activeMethod ? ` — ${activeMethod.name}` : ''}\n`;
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
        setSelectedCondIdx(idx);
        setFluxoRows(buildFluxoRows(cond, idx));
    };

    const handleUpdateConditionField = (field, val) => {
        if (selectedCondIdx === null) return;
        const updated = conditions.map((c, idx) => {
            if (idx === selectedCondIdx) {
                return {
                    ...c,
                    [field]: val
                };
            }
            return c;
        });
        setConditions(updated);
        
        const updatedCond = updated[selectedCondIdx];
        const { installments, isAVista, totalDiscountPct, financedTotal, downPct, downValue, installAmt } = calcCondition(updatedCond);
        const titleStr = updatedCond.title ? ` - ${updatedCond.title}` : '';
        let text = `Opção ${selectedCondIdx + 1}${titleStr}${activeMethod ? ` — ${activeMethod.name}` : ''}\n`;
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
        setFluxoRows(buildFluxoRows(updatedCond, selectedCondIdx));
    };

    const handleAction = async (newStatus) => {
        // --- Validations before APROVADO ---
        if (newStatus === 'APROVADO') {
            if (!grandTotal || grandTotal <= 0) {
                setError('A proposta não possui valor. Adicione itens no orçamento antes de aprovar.');
                return;
            }
            if (!diasFabrica || diasFabrica <= 0) {
                setError('Informe o número de dias de fabricação no orçamento antes de aprovar.');
                return;
            }
            if (selectedCondIdx === null) {
                setError('Selecione uma condição de pagamento antes de aprovar.');
                return;
            }
            // Open financial flow review screen
            setError('');
            setShowFluxo(true);
            return;
        }
        // Other actions (REJEITADO, ARQUIVADO) save directly
        setSaving(true); setError('');
        try {
            const payload = {
                status: newStatus,
                payment_methods: form.payment_methods,
                payment_notes: form.payment_notes
            };
            await api.put(`/proposals/${proposal.id}`, payload);
            onSave();
        } catch (err) {
            setError('Erro ao salvar conclusão: ' + (err.response?.data?.error || err.message));
            setSaving(false);
        }
    };

    const handleConfirmApproval = async () => {
        setSaving(true); setError('');
        try {
            // Convert display values back to numeric and format dates for the API
            const flows = fluxoRows.map(r => ({
                title: r.title,
                value: parseCurrency(r.value),
                due_date: r.date, // YYYY-MM-DD
                note: r.note || ''
            }));

            const fluxoText = fluxoRows
                .map(r => `${r.title} | ${r.value} | ${new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR')}${r.note ? ' | ' + r.note : ''}`)
                .join('\n');

            await api.post(`/proposals/${proposal.id}/approve`, {
                flows,
                payment_methods: form.payment_methods,
                payment_notes: fluxoText,
            });

            setSuccessMsg('Proposta aprovada com sucesso! Redirecionando...');
            setTimeout(() => {
                onSave(); // fecha o modal e atualiza a lista
            }, 2000);
        } catch (err) {
            setError('Erro ao aprovar: ' + (err.response?.data?.error || err.message));
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
                            <div style={{ fontWeight: '800', fontSize: '1.2rem' }}>{proposal.phase === 'Comercial' ? `PROPOSTA #${proposal.id}` : `PROJETO #${proposal.id}`}</div>
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
                                    {(() => {
                                        const rawProducts = (item.products || []).filter(p => 
                                            (p.product?.group_name === 'Ferragens' || p.product?.group_name === 'MDFs' || p.product?.group_name === 'Vidros') && p.product?.photo
                                        );
                                        
                                        const uniqueProductsMap = new Map();
                                        rawProducts.forEach(p => {
                                            if (p.product && !uniqueProductsMap.has(p.product.id)) {
                                                uniqueProductsMap.set(p.product.id, p);
                                            }
                                        });
                                        const displayProducts = Array.from(uniqueProductsMap.values());
                                        
                                        if (displayProducts.length === 0) return null;

                                        return (
                                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '10px' }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                    Materiais e Acessórios:
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    {displayProducts.map((hp, hIdx) => (
                                                        <div key={hIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                            <img 
                                                                src={hp.product.photo} 
                                                                alt={hp.product.name} 
                                                                title={hp.product.name}
                                                                style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px' }} 
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
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

                        {/* Factory & Assembly Days */}
                        <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                            <div style={{ padding: '0.9rem 1rem', background: 'rgba(99,102,241,0.1)', borderRadius: '12px', border: '1.5px solid rgba(99,102,241,0.35)', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>🏭 Dias Fábrica</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--primary)', lineHeight: 1 }}>{diasFabrica}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>dias produção</div>
                            </div>
                            <div style={{ padding: '0.9rem 1rem', background: 'rgba(234,179,8,0.08)', borderRadius: '12px', border: '1.5px solid rgba(234,179,8,0.35)', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>🔧 Dias Montagem</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#eab308', lineHeight: 1 }}>{diasMontagem}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>dias instalação</div>
                            </div>
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
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {conditions.map((cond, idx) => {
                                        const { installments, isAVista, totalDiscountPct, financedTotal, downPct, downValue, installAmt } = calcCondition(cond);
                                        const isSelected = selectedCondIdx === idx;
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => handleSelectCondition(cond, idx)}
                                                style={{
                                                    border: '1.5px solid',
                                                    borderColor: isSelected ? 'var(--primary)' : (isAVista ? '#86efac' : 'var(--border)'),
                                                    borderRadius: '12px',
                                                    padding: '14px',
                                                    background: isSelected ? 'rgba(99,102,241,0.08)' : (isAVista ? 'rgba(22,163,74,0.08)' : 'rgba(255,255,255,0.03)'),
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = isSelected ? 'var(--primary)' : (isAVista ? '#86efac' : 'var(--border)')}
                                            >
                                                <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>
                                                    Opção {idx + 1}{cond.title ? ` - ${cond.title}` : ''}
                                                </div>
                                                <div style={{ fontSize: '13px', fontWeight: '900', color: isSelected ? 'var(--primary)' : (isAVista ? '#16a34a' : 'white'), borderTop: '1px solid var(--border)', paddingTop: '6px', lineHeight: '1.6' }}>
                                                    {isAVista ? (
                                                        `À vista: ${maskCurrency(financedTotal)}`
                                                    ) : downPct > 0 ? (
                                                        <>
                                                            <div>Entrada {downPct}%: <span style={{ color: isSelected ? 'var(--primary)' : '#6366f1' }}>{maskCurrency(downValue)}</span></div>
                                                            <div>+ {installments}x de <span style={{ color: isSelected ? 'var(--primary)' : '#6366f1' }}>{maskCurrency(installAmt)}</span></div>
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

                                {selectedCondIdx !== null && (
                                    <div style={{
                                        border: '1.5px solid var(--border)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        background: 'rgba(255,255,255,0.02)',
                                        marginTop: '0.5rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                    }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            ✏️ Customizar Opção {selectedCondIdx + 1}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>Parcelas</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="120"
                                                    value={conditions[selectedCondIdx]?.installments ?? 0}
                                                    onChange={e => handleUpdateConditionField('installments', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.82rem' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>Desconto (%)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.01"
                                                    value={conditions[selectedCondIdx]?.discount_percentage || 0}
                                                    onChange={e => handleUpdateConditionField('discount_percentage', parseFloat(e.target.value) || 0)}
                                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.82rem' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>Entrada (%)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.01"
                                                    value={conditions[selectedCondIdx]?.down_payment_percentage || 0}
                                                    onChange={e => handleUpdateConditionField('down_payment_percentage', parseFloat(e.target.value) || 0)}
                                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.82rem' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>Custo Fin. / Juros (%)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.01"
                                                    value={conditions[selectedCondIdx]?.finance_cost_percentage || 0}
                                                    onChange={e => handleUpdateConditionField('finance_cost_percentage', parseFloat(e.target.value) || 0)}
                                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.82rem' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                        <button onClick={() => handleAction('APROVADO')} disabled={saving} className="btn-premium" style={{ padding: '12px 40px', fontSize: '1.1rem' }}>{saving ? 'Processando...' : '✓ Demonstrar fluxo'}</button>
                    </div>
                </div>
            </div>

        </div>,
        document.body
        )}
        {/* ── FLUXO FINANCEIRO OVERLAY ─────────────────────────────── */}
        {showFluxo && createPortal(
            <div className="modal-overlay" style={{ zIndex: 99998 }}>
                <div className="modal-content" style={{ maxWidth: '820px', width: '96%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.3rem' }}>
                                💳 Fluxo Financeiro
                            </h2>
                            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.85rem' }}>
                                Revise e edite as parcelas antes de confirmar a aprovação
                            </p>
                        </div>
                        <button onClick={() => setShowFluxo(false)} className="btn-icon"><X size={20} /></button>
                    </div>

                    {/* Table */}
                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(99,102,241,0.15)', borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Título</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Valor</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Data</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Anotação</th>
                                    <th style={{ width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {fluxoRows.map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '8px 10px' }}>
                                            <input
                                                value={row.title}
                                                onChange={e => setFluxoRows(rows => rows.map((r, j) => j === i ? { ...r, title: e.target.value } : r))}
                                                style={{ width: '100%', marginBottom: 0, fontWeight: '700', fontSize: '0.88rem' }}
                                            />
                                        </td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <input
                                                value={row.value}
                                                onChange={e => setFluxoRows(rows => rows.map((r, j) => j === i ? { ...r, value: maskCurrency(e.target.value) } : r))}
                                                style={{ width: '120px', marginBottom: 0, textAlign: 'right', fontWeight: '700', color: '#10b981' }}
                                            />
                                        </td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <input
                                                type="date"
                                                value={row.date}
                                                onChange={e => setFluxoRows(rows => rows.map((r, j) => j === i ? { ...r, date: e.target.value } : r))}
                                                style={{ marginBottom: 0, colorScheme: 'dark', fontSize: '0.85rem' }}
                                            />
                                        </td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <input
                                                value={row.note}
                                                onChange={e => setFluxoRows(rows => rows.map((r, j) => j === i ? { ...r, note: e.target.value } : r))}
                                                placeholder="Ex: Pix, Cartão..."
                                                style={{ width: '100%', marginBottom: 0, fontSize: '0.85rem' }}
                                            />
                                        </td>
                                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => setFluxoRows(rows => rows.filter((_, j) => j !== i))}
                                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                                                title="Remover linha"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Total summary */}
                    {(() => {
                        const total = fluxoRows.reduce((acc, r) => acc + parseCurrency(r.value), 0);
                        return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(16,185,129,0.08)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.3)', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Total do fluxo:</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#10b981' }}>{maskCurrency(total)}</span>
                            </div>
                        );
                    })()}

                    {/* Add row button */}
                    <button
                        onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            setFluxoRows(rows => [...rows, { title: `Parcela ${rows.length + 1}`, value: 'R$ 0,00', date: today, note: '' }]);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: '1.5px dashed var(--border)', color: 'var(--text-muted)', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', marginBottom: '1.25rem', transition: 'all 0.15s', width: '100%', justifyContent: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        <Plus size={16} /> Adicionar Linha
                    </button>

                    {/* Footer actions */}
                    {successMsg ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: 'rgba(16,185,129,0.12)', border: '1.5px solid #10b981', borderRadius: '12px', marginTop: '0.5rem' }}>
                            <CheckCircle size={22} color="#10b981" />
                            <div>
                                <div style={{ fontWeight: '800', color: '#10b981', fontSize: '1rem' }}>Proposta aprovada com sucesso!</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Redirecionando para Gestão Comercial...</div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowFluxo(false)} className="btn-secondary" disabled={saving}>Voltar</button>
                                <button onClick={handleConfirmApproval} disabled={saving} className="btn-premium" style={{ padding: '12px 32px', fontSize: '1rem' }}>
                                    {saving ? 'Aprovando...' : '✓ Aprovar'}
                                </button>
                            </div>
                            {error && <div style={{ color: '#ef4444', fontSize: '0.88rem', marginTop: '8px', textAlign: 'right' }}>{error}</div>}
                        </>
                    )}
                </div>
            </div>,
            document.body
        )}

        {fullscreenImage && createPortal(
            <div
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setFullscreenImage(null); }}
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
                    onClick={(e) => e.stopPropagation()}
                    style={{ maxWidth: '92%', maxHeight: '92vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 0 80px rgba(0,0,0,0.9)', cursor: 'default' }}
                />
                <button
                    onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }}
                    style={{
                        position: 'absolute', top: '20px', right: '20px',
                        background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
                        color: 'white', borderRadius: '50%', width: '40px', height: '40px',
                        cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s'
                    }}
                    title="Fechar"
                >✕</button>
                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', background: 'rgba(0,0,0,0.5)', padding: '4px 14px', borderRadius: '8px' }}>
                    Clique fora da imagem para fechar
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
    const [presentationModalData, setPresentationModalData] = useState({ show: false, proposal: null });
    const [attachmentsModalData, setAttachmentsModalData] = useState({ show: false, proposal: null });
    const [activeStatusTab, setActiveStatusTab] = useState('ABERTO');
    const [globalPartnerModalOpen, setGlobalPartnerModalOpen] = useState(false);
    const [partners, setPartners] = useState([]);

    useEffect(() => {
        fetchProposals();
        fetchPartners();
    }, []);

    const fetchPartners = async () => {
        try {
            const r = await api.get('/partners');
            setPartners(r.data);
        } catch (e) { console.error(e); }
    };

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
        'ABERTO': { color: '#eab308', icon: <Clock size={16} />, label: 'Aberta' },
        'REVISAR': { color: '#f97316', icon: <AlertCircle size={16} />, label: 'Em Revisão' },
        'APROVADO': { color: '#10b981', icon: <CheckCircle size={16} />, label: 'Aprovada' },
        'REJEITADO': { color: '#ef4444', icon: <XCircle size={16} />, label: 'Declinada' },
        'ARQUIVADO': { color: 'var(--text-muted)', icon: <Clock size={16} />, label: 'Arquivada' }
    };

    const filtered = proposals.filter(p => {
        const matchesSearch = p.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
                             p.description?.toLowerCase().includes(search.toLowerCase()) ||
                             p.id.toString() === search;
        
        // Se estiver pesquisando por ID exato, ignora a aba de status para encontrar a proposta
        if (search && p.id.toString() === search) return true;

        return matchesSearch && p.status === activeStatusTab;
    });

    const tabStyle = (status) => ({
        padding: '1rem 1.5rem',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: activeStatusTab === status ? '700' : '500',
        color: activeStatusTab === status ? 'var(--primary)' : 'var(--text-muted)',
        borderBottom: activeStatusTab === status ? '3px solid var(--primary)' : '3px solid transparent',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: activeStatusTab === status ? 'rgba(99,102,241,0.05)' : 'transparent',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
    });

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', margin: 0 }}>Gestão Comercial</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Acompanhamento de orçamentos e projetos</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', fontWeight: '600' }} onClick={() => setGlobalPartnerModalOpen(true)}>
                        <UserPlus size={18} /> Novo Cliente
                    </button>
                    <button className="btn-premium" onClick={() => { setSelectedProposal(null); setModalOpen(true); }}>
                        <Plus size={20} /> Nova Proposta
                    </button>
                </div>
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

            {/* Tabs de Status */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '0', gap: '5px' }}>
                <div style={tabStyle('ABERTO')} onClick={() => setActiveStatusTab('ABERTO')}>
                    <Clock size={18} /> Aberta
                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                        {proposals.filter(p => p.status === 'ABERTO').length}
                    </span>
                </div>
                <div style={tabStyle('REVISAR')} onClick={() => setActiveStatusTab('REVISAR')}>
                    <AlertCircle size={18} /> Revisão
                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                        {proposals.filter(p => p.status === 'REVISAR').length}
                    </span>
                </div>
                <div style={tabStyle('APROVADO')} onClick={() => setActiveStatusTab('APROVADO')}>
                    <CheckCircle size={18} /> Aprovada
                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                        {proposals.filter(p => p.status === 'APROVADO').length}
                    </span>
                </div>
                <div style={tabStyle('REJEITADO')} onClick={() => setActiveStatusTab('REJEITADO')}>
                    <XCircle size={18} /> Declinada
                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                        {proposals.filter(p => p.status === 'REJEITADO').length}
                    </span>
                </div>
            </div>

            <div className="glass card" style={{ padding: 0, overflow: 'hidden', borderTopLeftRadius: 0 }}>
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
                                    <th>Valor</th>
                                    <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum orçamento encontrado.</td></tr>
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
                                                        {cfg.icon} {cfg.label || p.status}
                                                    </span>
                                                </td>
                                                <td style={{ fontWeight: '700' }}>{maskCurrency(p.value)}</td>
                                                <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                        <button onClick={() => setEventModalData({ show: true, proposal: p })} title="Eventos / Agenda" style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}><CalendarPlus size={18} /></button>
                                                        <button onClick={() => setPresentationModalData({ show: true, proposal: p })} title="Apresentação para Cliente" style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer' }}><Monitor size={18} /></button>
                                                        <button onClick={() => setBudgetModalData({ show: true, proposal: p })} title={canModify ? "Editar Orçamento" : "Ver Orçamento"} style={{ background: 'transparent', border: 'none', color: '#eab308', cursor: 'pointer' }}><FileText size={18} /></button>
                                                        {p.status === 'ABERTO' && (
                                                            <button onClick={() => setCompletionModalData({ show: true, proposal: p })} title="Concluir Negociação / Aprovar" style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer' }}><CheckCircle size={18} /></button>
                                                        )}
                                                        <button onClick={() => setAttachmentsModalData({ show: true, proposal: p })} title="Anexos da Proposta" style={{ background: 'transparent', border: 'none', color: '#a78bfa', cursor: 'pointer' }}><Paperclip size={18} /></button>
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
            {attachmentsModalData.show && <AttachmentsModal proposal={attachmentsModalData.proposal} onClose={() => setAttachmentsModalData({ show: false, proposal: null })} />}
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
                    if (wasAutoShowPrint && wasAutoShowPrint !== 'PRESENTATION') {
                        // Volta para a tela de conclusão da proposta
                        setCompletionModalData({ show: true, proposal: p });
                    }
                }}
                onSave={() => { setBudgetModalData({ show: false, proposal: null }); fetchProposals(); }}
            />}
            {presentationModalData.show && <BuildPresentationModal
                proposal={presentationModalData.proposal}
                user={user}
                onClose={() => {
                    setPresentationModalData({ show: false, proposal: null });
                    fetchProposals();
                }}
            />}
            {globalPartnerModalOpen && (
                <PartnerModal
                    partner={null}
                    allPartners={partners}
                    initialTab="dados"
                    onClose={() => setGlobalPartnerModalOpen(false)}
                    onSave={() => {
                        fetchPartners();
                        setGlobalPartnerModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

export default Proposals;
