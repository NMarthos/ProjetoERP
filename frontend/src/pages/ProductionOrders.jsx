import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Factory, Clock, AlertTriangle, CheckCircle, Pencil, Trash2, X } from 'lucide-react';

// ── Modal de Gerenciamento da OP ──────────────────────────────────────────────
const OrderModal = ({ order, onClose, onSave }) => {
    const [form, setForm] = useState({
        status: 'AGUARDANDO',
        priority: 'MEDIA',
        start_date: '',
        end_date: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (order) {
            setForm({
                status: order.status || 'AGUARDANDO',
                priority: order.priority || 'MEDIA',
                start_date: order.start_date ? order.start_date.split('T')[0] : '',
                end_date: order.end_date ? order.end_date.split('T')[0] : ''
            });
        }
    }, [order]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put(`/production-orders/${order.id}`, form);
            onSave();
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao atualizar ordem.');
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ width: '100%', maxWidth: '440px', background: 'rgba(15,23,42,0.97)', border: '2px solid rgba(99,102,241,0.4)', borderRadius: '20px', padding: '2rem', animation: 'fadeIn 0.2s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>Gerenciar OP #{order?.id}</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <label>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                        <option value="AGUARDANDO">Aguardando</option>
                        <option value="EM_PRODUCAO">Em Produção</option>
                        <option value="FINALIZADO">Finalizado</option>
                        <option value="ENTREGUE">Entregue</option>
                    </select>
                    <label>Prioridade</label>
                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                        <option value="BAIXA">Baixa</option>
                        <option value="MEDIA">Média</option>
                        <option value="ALTA">Alta</option>
                    </select>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label>Data Início</label>
                            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                        </div>
                        <div>
                            <label>Data Previsão</label>
                            <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" disabled={saving} className="btn-premium" style={{ flex: 2 }}>{saving ? 'Salvando...' : 'Atualizar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Página Principal ─────────────────────────────────────────────────────────
const ProductionOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalData, setModalData] = useState({ show: false, order: null });

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await api.get('/production-orders');
            setOrders(response.data);
        } catch (err) {
            console.error('Erro ao buscar ordens', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, []);

    const handleDelete = async (id) => {
        if (!confirm('Excluir esta Ordem de Produção?')) return;
        try {
            await api.delete(`/production-orders/${id}`);
            fetchOrders();
        } catch (err) { alert('Erro ao excluir ordem.'); }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'AGUARDANDO': return '#94a3b8';
            case 'EM_PRODUCAO': return '#3b82f6';
            case 'FINALIZADO': return '#10b981';
            case 'ENTREGUE': return '#6366f1';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div className="fade-in">
            {modalData.show && <OrderModal order={modalData.order} onClose={() => setModalData({ show: false, order: null })} onSave={() => { setModalData({ show: false, order: null }); fetchOrders(); }} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Ordens de Produção</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Controle o fluxo de fabricação dos móveis planejados.</p>
                </div>
                <div className="glass" style={{ padding: '10px 20px', borderRadius: '12px' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ordens Ativas</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>{orders.filter(o => o.status !== 'ENTREGUE').length}</span>
                </div>
            </div>

            <div className="scrollable-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {loading ? (
                    <p>Carregando ordens...</p>
                ) : orders.length === 0 ? (
                    <div className="glass card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
                        <Factory size={48} style={{ color: 'var(--border)', marginBottom: '1rem' }} />
                        <p style={{ color: 'var(--text-muted)' }}>Nenhuma ordem de produção cadastrada.</p>
                    </div>
                ) : (
                    orders.map(order => (
                        <div key={order.id} className="glass card" style={{ position: 'relative', borderLeft: `4px solid ${getStatusColor(order.status)}`, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>OP #{order.id}</span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => handleDelete(order.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: order.priority === 'ALTA' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)', color: order.priority === 'ALTA' ? '#ef4444' : 'var(--text-muted)' }}>{order.priority}</span>
                                </div>
                            </div>
                            <h4 style={{ marginBottom: '0.5rem' }}>{order.partner_name}</h4>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', flex: 1 }}>{order.proposal_description}</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={14} style={{ color: 'var(--text-muted)' }} /><span style={{ fontSize: '0.8rem' }}>Início: {order.start_date ? new Date(order.start_date).toLocaleDateString('pt-BR') : '—'}</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={14} style={{ color: 'var(--text-muted)' }} /><span style={{ fontSize: '0.8rem' }}>Previsão: {order.end_date ? new Date(order.end_date).toLocaleDateString('pt-BR') : '—'}</span></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getStatusColor(order.status) }}></div><span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{order.status.replace('_', ' ')}</span></div>
                                <button onClick={() => setModalData({ show: true, order })} className="btn-premium" style={{ padding: '5px 15px', fontSize: '0.75rem' }}>Gerenciar</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ProductionOrders;
