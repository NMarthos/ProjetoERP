import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Trash2, Pencil, CreditCard, ChevronRight, Hash, Percent, Wallet, Settings, Save, Info, CheckCircle2 } from 'lucide-react';

const PaymentMethods = () => {
    const [methods, setMethods] = useState([]);
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showConditionModal, setShowConditionModal] = useState(false);

    // Formas de Pagamento (Mestre)
    const [methodForm, setMethodForm] = useState({ name: '', active: 1 });
    const [editingMethodId, setEditingMethodId] = useState(null);
    const [savingMethod, setSavingMethod] = useState(false);

    // Condições de Pagamento (Subordinado)
    const [conditionForm, setConditionForm] = useState({ title: '', discount_percentage: 0, finance_cost_percentage: 0, installments: 1, down_payment_percentage: 0 });
    const [editingConditionId, setEditingConditionId] = useState(null);

    useEffect(() => {
        fetchMethods();
    }, []);

    const fetchMethods = async () => {
        try {
            const r = await api.get('/payment-methods');
            setMethods(r.data);
            if (r.data.length > 0 && !selectedMethod) {
                setSelectedMethod(r.data[0]);
            } else if (selectedMethod) {
                const updated = r.data.find(m => m.id === selectedMethod.id);
                setSelectedMethod(updated || r.data[0]);
            }
            setLoading(false);
        } catch (err) {
            console.error('Erro ao buscar formas de pagamento:', err);
            setLoading(false);
        }
    };

    const handleSaveMethod = async (e) => {
        if (e) e.preventDefault();
        if (!methodForm.name.trim()) return alert('Informe o nome da forma');
        setSavingMethod(true);
        try {
            if (editingMethodId) {
                await api.put(`/payment-methods/${editingMethodId}`, methodForm);
            } else {
                await api.post('/payment-methods', methodForm);
            }
            setMethodForm({ name: '', active: 1 });
            setEditingMethodId(null);
            fetchMethods();
        } catch (err) {
            alert('Erro ao salvar forma de pagamento');
        }
        setSavingMethod(false);
    };

    const handleSaveCondition = async () => {
        try {
            const payload = { ...conditionForm, payment_method_id: selectedMethod.id };
            if (editingConditionId) {
                await api.put(`/payment-conditions/${editingConditionId}`, payload);
            } else {
                await api.post('/payment-conditions', payload);
            }
            setShowConditionModal(false);
            fetchMethods();
        } catch (err) {
            alert('Erro ao salvar condição');
        }
    };

    const handleDeleteMethod = async (id) => {
        if (!window.confirm('Excluir esta forma de pagamento e todas as suas condições?')) return;
        try {
            await api.delete(`/payment-methods/${id}`);
            if (selectedMethod?.id === id) setSelectedMethod(null);
            fetchMethods();
        } catch (err) {
            alert('Erro ao excluir');
        }
    };

    const handleDeleteCondition = async (id) => {
        if (!window.confirm('Excluir esta condição?')) return;
        try {
            await api.delete(`/payment-conditions/${id}`);
            fetchMethods();
        } catch (err) {
            alert('Erro ao excluir');
        }
    };

    if (loading) return <div className="p-8 text-center fade-in">Carregando política comercial...</div>;

    return (
        <div className="fade-in">
            {/* Header Estilo Parâmetros */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>Formas de Pagamento</h2>
                    <p style={{ color: 'var(--text-muted)', margin: '5px 0 0' }}>Gerencie as regras financeiras e condições de parcelamento.</p>
                </div>
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wallet size={20} /> Gestão Financeira
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
                
                {/* COLUNA ESQUERDA: Cadastro de Formas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    {/* Formulário de Forma */}
                    <div className="glass card" style={{ border: '2px solid var(--border)' }}>
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
                            <Plus size={20} color="var(--primary)" /> {editingMethodId ? 'Editar Forma' : 'Nova Forma de Pagamento'}
                        </h3>
                        <form onSubmit={handleSaveMethod}>
                            <label>Nome da Forma (Ex: Cartão de Crédito)</label>
                            <input 
                                required
                                placeholder="Informe o nome..." 
                                value={methodForm.name}
                                onChange={e => setMethodForm({...methodForm, name: e.target.value})}
                            />
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', marginBottom: '1.5rem' }}>
                                <input 
                                    type="checkbox" 
                                    style={{ width: '18px', height: '18px' }}
                                    checked={methodForm.active === 1}
                                    onChange={e => setMethodForm({...methodForm, active: e.target.checked ? 1 : 0})}
                                />
                                <label style={{ margin: 0, fontWeight: '600', cursor: 'pointer' }}>Ativar esta forma para uso</label>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="submit" className="btn-premium" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={savingMethod}>
                                    <Save size={18} /> {savingMethod ? 'Salvando...' : 'Salvar Forma'}
                                </button>
                                {editingMethodId && (
                                    <button type="button" onClick={() => { setEditingMethodId(null); setMethodForm({name: '', active: 1}); }} className="btn-secondary">
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Lista de Formas */}
                    <div className="glass card" style={{ border: '2px solid var(--border)' }}>
                        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Formas Cadastradas</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {methods.map(m => (
                                <div 
                                    key={m.id}
                                    onClick={() => setSelectedMethod(m)}
                                    style={{ 
                                        padding: '1rem', 
                                        borderRadius: '12px', 
                                        background: selectedMethod?.id === m.id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                        border: selectedMethod?.id === m.id ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ 
                                            width: '32px', 
                                            height: '32px', 
                                            borderRadius: '8px', 
                                            background: m.active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Wallet size={18} color={m.active ? '#10b981' : '#ef4444'} />
                                        </div>
                                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{m.name}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMethodForm({ name: m.name, active: m.active });
                                                setEditingMethodId(m.id);
                                            }}
                                            className="btn-icon"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteMethod(m.id); }}
                                            className="btn-icon"
                                            style={{ color: '#ef4444' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* COLUNA DIREITA: Condições */}
                <div className="glass card" style={{ border: '2px solid var(--border)', minHeight: '500px' }}>
                    {selectedMethod ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: 'var(--primary)' }}>
                                        Condições: {selectedMethod.name}
                                    </h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Regras de parcelamento e desconto para esta forma.</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        setConditionForm({ title: '', discount_percentage: 0, finance_cost_percentage: 0, installments: 1, down_payment_percentage: 0 });
                                        setEditingConditionId(null);
                                        setShowConditionModal(true);
                                    }}
                                    className="btn-premium"
                                    style={{ padding: '8px 20px', fontSize: '0.9rem' }}
                                >
                                    <Plus size={18} /> Nova Condição
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                                {selectedMethod.conditions?.length === 0 ? (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                                        Nenhuma condição configurada para <strong>{selectedMethod.name}</strong>.
                                    </div>
                                ) : (
                                    selectedMethod.conditions?.map(c => (
                                        <div 
                                            key={c.id}
                                            style={{ 
                                                padding: '1.5rem', 
                                                borderRadius: '16px', 
                                                border: '1.5px solid var(--border)', 
                                                background: 'rgba(255,255,255,0.02)',
                                                position: 'relative',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '12px'
                                            }}
                                        >
                                            <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <CheckCircle2 size={18} color="#10b981" /> {c.title}
                                            </div>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Parcelas:</span>
                                                    <span style={{ fontWeight: '800' }}>{c.installments}x</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Desconto:</span>
                                                    <span style={{ fontWeight: '800', color: '#10b981' }}>{c.discount_percentage}%</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Custo Fin.:</span>
                                                    <span style={{ fontWeight: '800', color: '#ef4444' }}>+{c.finance_cost_percentage}%</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Entrada:</span>
                                                    <span style={{ fontWeight: '800' }}>{c.down_payment_percentage}%</span>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                                <button 
                                                    onClick={() => {
                                                        setConditionForm({ 
                                                            title: c.title, 
                                                            discount_percentage: c.discount_percentage, 
                                                            finance_cost_percentage: c.finance_cost_percentage,
                                                            installments: c.installments, 
                                                            down_payment_percentage: c.down_payment_percentage 
                                                        });
                                                        setEditingConditionId(c.id);
                                                        setShowConditionModal(true);
                                                    }}
                                                    className="btn-icon"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button onClick={() => handleDeleteCondition(c.id)} className="btn-icon" style={{ color: '#ef4444' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '6rem 2rem', color: 'var(--text-muted)' }}>
                            <Wallet size={48} style={{ opacity: 0.2, marginBottom: '1.5rem' }} />
                            <h3 style={{ margin: 0 }}>Nenhuma Forma Selecionada</h3>
                            <p>Selecione uma forma de pagamento à esquerda para gerenciar suas condições comerciais.</p>
                        </div>
                    )}
                </div>

            </div>

            {/* Modal de Condição (Simplificado) */}
            {showConditionModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '450px' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>{editingConditionId ? 'Editar Condição' : 'Nova Condição'}</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Título da Condição</label>
                                <input 
                                    className="input-field"
                                    placeholder="Ex: À vista com desconto, 10x sem juros..." 
                                    value={conditionForm.title}
                                    onChange={e => setConditionForm(f => ({ ...f, title: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}><Percent size={14}/> Entrada</label>
                                <input 
                                    type="number"
                                    className="input-field"
                                    value={conditionForm.down_payment_percentage}
                                    onChange={e => setConditionForm(f => ({ ...f, down_payment_percentage: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}><Hash size={14}/> Parcelas</label>
                                    <input 
                                        type="number"
                                        className="input-field"
                                        value={conditionForm.installments}
                                        onChange={e => setConditionForm(f => ({ ...f, installments: parseInt(e.target.value) || 1 }))}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}><Percent size={14}/> Desconto</label>
                                    <input 
                                        type="number"
                                        className="input-field"
                                        value={conditionForm.discount_percentage}
                                        onChange={e => setConditionForm(f => ({ ...f, discount_percentage: parseFloat(e.target.value) || 0 }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}><Percent size={14}/> Custo Financeiro</label>
                                <input 
                                    type="number"
                                    className="input-field"
                                    placeholder="Ex: 2.5"
                                    value={conditionForm.finance_cost_percentage}
                                    onChange={e => setConditionForm(f => ({ ...f, finance_cost_percentage: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                            <button onClick={() => setShowConditionModal(false)} className="btn-secondary">Cancelar</button>
                            <button onClick={handleSaveCondition} className="btn-premium">Salvar Condição</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentMethods;
