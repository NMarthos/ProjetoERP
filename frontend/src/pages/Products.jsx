import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Package, Truck, Plus, Search, Edit3, Trash2, X, Check, AlertCircle, Camera, Calendar, Upload, Loader2 } from 'lucide-react';
import { maskPhone, maskCurrency, parseCurrency } from '../utils/masks';
import { createPortal } from 'react-dom';

const unitDomain = {
    CHP: 'Chapa',
    UN:  'Unidade',
    M:   'Metro',
    M2:  'Metro²',
    L:   'Litro',
    CXA: 'Caixa',
    PAR: 'Par',
    H:   'Hora',
    DIA: 'Dia',
    PC:  'Peça',
    DF:  'Diária fábrica',
    DM:  'Diária montagem'
};

// ── Funções de Formatação ──────────────────────────────────────────────────
// (Using standardized masks from utils)

// ── Modal de Fabricante ──────────────────────────────────────────────────────
const ManufacturerModal = ({ manufacturer, onClose, onSave }) => {
    const [form, setForm] = useState({ name: '', contact: '', phone: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (manufacturer) setForm(manufacturer);
    }, [manufacturer]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (manufacturer) await api.put(`/manufacturers/${manufacturer.id}`, form);
            else await api.post('/manufacturers', form);
            onSave();
        } catch (err) { alert('Erro ao salvar fabricante'); }
        setSaving(false);
    };

    return createPortal(
        <div className="modal-overlay">
            <div className="glass card modal-content" style={{ maxWidth: '400px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h3>{manufacturer ? 'Editar Fabricante' : 'Novo Fabricante'}</h3>
                    <button onClick={onClose} className="btn-icon"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <label>Nome do Fabricante *</label>
                    <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    <label>Contato</label>
                    <input value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} />
                    <label>Telefone</label>
                    <input value={form.phone} onChange={e => setForm({...form, phone: maskPhone(e.target.value)})} maxLength="15" />
                    <button type="submit" className="btn-premium" style={{ width: '100%', marginTop: '1rem' }} disabled={saving}>
                        {saving ? 'Salvando...' : 'Salvar Fabricante'}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

// ── Modal de Produto ──────────────────────────────────────────────────────────
// ── Função Auxiliar de Auto-Previsão de Grupo ────────────────────────────────
const predictGroup = (name, unit) => {
    if (!name) return 'Outros';
    const n = name.toUpperCase();
    if (['DF', 'DM', 'DIA', 'H'].includes(unit?.toUpperCase()) || n.includes('MÃO DE OBRA') || n.includes('MAO DE OBRA') || n.includes('SERVIÇO') || n.includes('SERVICO')) return 'Servico';
    if (n.startsWith('MDF') || n.includes('MDF')) return 'Mdf';
    if (n.startsWith('FB') || n.includes('FB ') || n.includes('FITA DE BORDA') || n.includes('FITA')) return 'Fita';
    if (n.includes('PARAFUSO') || n.includes('PREGO') || n.includes('COMPONENTES') || n.includes('COMPONENTE')) return 'Ferragem';
    if (n.includes('DOBRADIÇA') || n.includes('DOBRADICA') || n.includes('CORREDIÇA') || n.includes('CORREDICA') || n.includes('PUXADOR') || n.includes('FECHADURA') || n.includes('FERRAGEM') || n.includes('FERRAGENS')) return 'Ferragem';
    if (n.includes('COLA') || n.includes('ADESIVO') || n.includes('SELANTE') || n.includes('SILICONE')) return 'Quimicos';
    if (n.includes('VERNIZ') || n.includes('PINTURA') || n.includes('LACA') || n.includes('ACABAMENTO')) return 'Acabamento';
    return 'Outros';
};

// ── Modal de Produto ──────────────────────────────────────────────────────────
const ProductModal = ({ product, manufacturers, onClose, onSave }) => {
    const [form, setForm] = useState({ 
        name: '', unit: 'UN', value: 0, manufacturer_id: '', photo: '', status: 1, group_name: 'Outros' 
    });
    const [displayValue, setDisplayValue] = useState('0,00');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        document.body.classList.add('body-no-scroll');
        return () => document.body.classList.remove('body-no-scroll');
    }, []);

    useEffect(() => {
        if (product) {
            setForm({
                ...product, 
                manufacturer_id: product.manufacturer_id || '',
                group_name: product.group_name || 'Outros'
            });
            setDisplayValue(maskCurrency(product.value));
        }
    }, [product]);

    const handleValueChange = (e) => {
        const val = e.target.value;
        const formatted = maskCurrency(val);
        setDisplayValue(formatted);
        setForm({ ...form, value: parseCurrency(formatted) });
    };

    const handleNameChange = (nameVal) => {
        const predicted = predictGroup(nameVal, form.unit);
        setForm(f => ({ ...f, name: nameVal, group_name: predicted }));
    };

    const handleUnitChange = (unitVal) => {
        const predicted = predictGroup(form.name, unitVal);
        setForm(f => ({ ...f, unit: unitVal, group_name: predicted }));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setForm({ ...form, photo: response.data.url });
        } catch (err) {
            alert('Erro no upload da imagem.');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form, manufacturer_id: form.manufacturer_id || null };
            if (product) await api.put(`/products/${product.id}`, payload);
            else await api.post('/products', payload);
            onSave();
        } catch (err) { alert('Erro ao salvar produto'); }
        setSaving(false);
    };

    return createPortal(
        <div className="modal-overlay">
            <div className="glass card modal-content" style={{ maxWidth: '500px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h3>{product ? 'Editar Produto/Serviço' : 'Novo Produto/Serviço'}</h3>
                    <button onClick={onClose} className="btn-icon"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '1.25rem' }}>
                        <div 
                            onClick={() => fileInputRef.current.click()}
                            style={{ 
                                width: '120px', height: '120px', 
                                border: '2px dashed var(--border)', 
                                borderRadius: '12px', 
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', overflow: 'hidden',
                                position: 'relative', background: 'rgba(255,255,255,0.02)'
                            }}
                        >
                            {uploading ? (
                                <Loader2 className="spin" />
                            ) : form.photo ? (
                                <img src={form.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <>
                                    <Upload size={24} style={{ color: 'var(--text-muted)' }} />
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>Upload Foto</span>
                                </>
                            )}
                            <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} accept="image/*" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>Nome *</label>
                            <input required value={form.name} onChange={e => handleNameChange(e.target.value)} />
                            
                            <label>Unidade</label>
                            <select value={form.unit} onChange={e => handleUnitChange(e.target.value)}>
                                {Object.entries(unitDomain).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                        <label>Valor Unitário (R$)</label>
                        <input 
                            type="text" 
                            value={displayValue} 
                            onChange={handleValueChange} 
                            style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label>Grupo / Categoria *</label>
                            <select value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})}>
                                {['Mdf', 'Fita', 'Ferragem', 'Quimicos', 'Acabamento', 'Servico', 'Outros'].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label>Fabricante</label>
                            <select value={form.manufacturer_id} onChange={e => setForm({...form, manufacturer_id: e.target.value})}>
                                <option value="">Nenhum</option>
                                {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Status — toggle switch */}
                    <div
                        onClick={() => setForm(f => ({ ...f, status: f.status === 1 ? 0 : 1 }))}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.5rem', padding: '12px 16px', background: form.status === 1 ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: '10px', border: `1px solid ${form.status === 1 ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.25s', userSelect: 'none' }}
                    >
                        <div>
                            <div style={{ fontWeight: '700', fontSize: '0.88rem', color: form.status === 1 ? '#10b981' : 'var(--text-muted)' }}>
                                Ativado no Catálogo
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {form.status === 1 ? 'Produto visível e disponível para orçamentos' : 'Produto oculto do catálogo'}
                            </div>
                        </div>
                        {/* Toggle pill */}
                        <div style={{ position: 'relative', width: '44px', height: '24px', borderRadius: '12px', background: form.status === 1 ? '#10b981' : 'rgba(255,255,255,0.15)', transition: 'background 0.25s', flexShrink: 0 }}>
                            <div style={{ position: 'absolute', top: '3px', left: form.status === 1 ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)', transition: 'left 0.25s' }} />
                        </div>
                    </div>

                    <button type="submit" className="btn-premium" style={{ width: '100%', marginTop: '1.5rem' }} disabled={saving || uploading}>
                        {saving ? 'Salvando...' : 'Salvar no Catálogo'}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

// ── Página Principal ─────────────────────────────────────────────────────────
const Products = () => {
    const [activeTab, setActiveTab] = useState('products');
    const [products, setProducts] = useState([]);
    const [manufacturers, setManufacturers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState({ show: false, type: '', data: null });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [p, m] = await Promise.all([api.get('/products'), api.get('/manufacturers')]);
            setProducts(p.data);
            setManufacturers(m.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleDelete = async (type, id) => {
        if (!confirm('Deseja excluir este item?')) return;
        try {
            await api.delete(`/${type}/${id}`);
            fetchData();
        } catch (e) { alert('Erro ao excluir'); }
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    const filteredManufacturers = manufacturers.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fade-in">
            {modal.show && modal.type === 'manufacturer' && (
                <ManufacturerModal manufacturer={modal.data} onClose={() => setModal({show:false})} onSave={() => {setModal({show:false}); fetchData();}} />
            )}
            {modal.show && modal.type === 'product' && (
                <ProductModal product={modal.data} manufacturers={manufacturers} onClose={() => setModal({show:false})} onSave={() => {setModal({show:false}); fetchData();}} />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Produtos e Serviços</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Mantenha seu catálogo técnico e lista de fabricantes.</p>
                </div>
                <button className="btn-premium" onClick={() => setModal({ show: true, type: activeTab === 'products' ? 'product' : 'manufacturer', data: null })}>
                    <Plus size={20} /> {activeTab === 'products' ? 'Novo Produto' : 'Novo Fabricante'}
                </button>
            </div>

            <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
                <button 
                    onClick={() => setActiveTab('products')}
                    style={{ background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', color: activeTab === 'products' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'products' ? '2px solid var(--primary)' : 'none', fontWeight: '600' }}
                >
                    <Package size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Catálogo
                </button>
                <button 
                    onClick={() => setActiveTab('manufacturers')}
                    style={{ background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', color: activeTab === 'manufacturers' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'manufacturers' ? '2px solid var(--primary)' : 'none', fontWeight: '600' }}
                >
                    <Truck size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Fabricantes
                </button>
            </div>

            <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input placeholder="Buscar por nome..." style={{ paddingLeft: '40px' }} value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                {activeTab === 'products' ? (
                    <div className="custom-scrollbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', paddingRight: '10px' }}>
                        {filteredProducts.map(p => (
                            <div key={p.id} className="glass card" style={{ padding: '1.5rem', zIndex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        {p.photo ? (
                                            <img src={p.photo} style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover' }} alt={p.name} />
                                        ) : (
                                            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.25)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Package size={22} />
                                            </div>
                                        )}
                                        <div>
                                            <h4 style={{ margin: 0 }}>{p.name}</h4>
                                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: p.status ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: p.status ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                                    {p.status ? 'ATIVADO' : 'DESATIVADO'}
                                                </span>
                                                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', fontWeight: 'bold' }}>
                                                    📁 {p.group_name || 'Outros'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn-icon" onClick={() => setModal({show:true, type:'product', data: p})}><Edit3 size={16} /></button>
                                        <button className="btn-icon" style={{ color: '#ef4444' }} onClick={() => handleDelete('products', p.id)}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                
                                <div style={{ fontSize: '1rem', marginBottom: '12px', background: 'rgba(0,0,0,0.45)', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Valor: </span> 
                                    <span style={{ fontWeight: '800', color: 'var(--primary)' }}>R$ {p.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span> 
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> / {unitDomain[p.unit]}</span>
                                </div>

                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Truck size={14} /> Fabricante: {p.manufacturer_name || 'Nenhum'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Calendar size={14} /> Atualizado: {new Date(p.updated_at).toLocaleDateString('pt-BR')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="custom-scrollbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', paddingRight: '10px' }}>
                        {filteredManufacturers.map(m => (
                            <div key={m.id} className="glass card" style={{ padding: '1.5rem', zIndex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Truck size={22} />
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0 }}>{m.name}</h4>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn-icon" onClick={() => setModal({show:true, type:'manufacturer', data: m})}><Edit3 size={16} /></button>
                                        <button className="btn-icon" style={{ color: '#ef4444' }} onClick={() => handleDelete('manufacturers', m.id)}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    <div style={{ marginBottom: '6px' }}><strong>Contato:</strong> {m.contact || '—'}</div>
                                    <div><strong>Telefone:</strong> {m.phone || '—'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Products;
