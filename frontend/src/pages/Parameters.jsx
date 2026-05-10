import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Settings, Plus, Trash2, Save, X, Info, Type, Hash, ToggleLeft } from 'lucide-react';

const Parameters = () => {
    const [params, setParams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ key: '', type: 'STRING', value: '', description: '' });
    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/parameters');
            setParams(res.data);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.key) return alert('A chave é obrigatória');
        
        setSaving(true);
        try {
            await api.post('/parameters', form);
            setForm({ key: '', type: 'STRING', value: '', description: '' });
            fetchData();
        } catch (err) {
            alert('Erro ao salvar parâmetro');
        }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        if (!confirm('Deseja excluir este parâmetro?')) return;
        try {
            await api.delete(`/parameters/${id}`);
            fetchData();
        } catch (err) {
            alert('Erro ao excluir');
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'NUMBER': return <Hash size={14} />;
            case 'PERCENTAGE': return <span style={{ fontWeight: 'bold' }}>%</span>;
            case 'BOOLEAN': return <ToggleLeft size={14} />;
            case 'JSON': return <Settings size={14} />;
            default: return <Type size={14} />;
        }
    };

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Parâmetros</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Configure chaves específicas para as regras de negócio da sua empresa.</p>
                </div>
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={20} /> Painel de Controle
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
                {/* FORMULÁRIO */}
                <div className="glass card" style={{ height: 'fit-content', border: '2px solid var(--border)' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Plus size={20} color="var(--primary)" /> Novo Parâmetro
                    </h3>
                    <form onSubmit={handleSave}>
                        <label>Chave do Parâmetro (Ex: DIAS_ENTREGA)</label>
                        <input 
                            required 
                            placeholder="NOME_DA_CHAVE" 
                            value={form.key} 
                            onChange={e => setForm({...form, key: e.target.value.toUpperCase().replace(/\s+/g, '_')})} 
                        />

                        <label>Tipo de Dado</label>
                        <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                            <option value="STRING">Texto (String)</option>
                            <option value="NUMBER">Número (Decimal)</option>
                            <option value="PERCENTAGE">Percentual (%)</option>
                            <option value="BOOLEAN">Booleano (Verdadeiro/Falso)</option>
                            <option value="JSON">Configuração Complexa (JSON)</option>
                        </select>

                        <label>Valor do Parâmetro</label>
                        {form.type === 'BOOLEAN' ? (
                            <select value={form.value} onChange={e => setForm({...form, value: e.target.value})}>
                                <option value="">Selecione...</option>
                                <option value="true">Verdadeiro</option>
                                <option value="false">Falso</option>
                            </select>
                        ) : form.type === 'JSON' ? (
                            <textarea 
                                placeholder='{"chave": "valor"}' 
                                value={form.value} 
                                onChange={e => setForm({...form, value: e.target.value})} 
                                style={{ minHeight: '100px', fontFamily: 'monospace' }}
                            />
                        ) : (
                            <input 
                                required 
                                type={(form.type === 'NUMBER' || form.type === 'PERCENTAGE') ? 'number' : 'text'} 
                                step="any"
                                placeholder={form.type === 'PERCENTAGE' ? "Ex: 15.5" : "Informe o valor..."} 
                                value={form.value} 
                                onChange={e => setForm({...form, value: e.target.value})} 
                            />
                        )}

                        <label>Descrição / Finalidade</label>
                        <textarea 
                            placeholder="Para que serve este parâmetro?" 
                            value={form.description} 
                            onChange={e => setForm({...form, description: e.target.value})} 
                            style={{ minHeight: '80px' }}
                        />

                        <button type="submit" className="btn-premium" style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} disabled={saving}>
                            {saving ? 'Salvando...' : <><Save size={18} /> Salvar Parâmetro</>}
                        </button>
                    </form>
                </div>

                {/* LISTA */}
                <div className="glass card" style={{ border: '2px solid var(--border)' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>Parâmetros Ativos</h3>
                    {loading ? <p>Carregando...</p> : params.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Nenhum parâmetro cadastrado.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {params.map(p => (
                                <div key={p.id} style={{ padding: '15px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1.5px solid var(--border)', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: '800', color: 'var(--primary)', letterSpacing: '1px' }}>{p.key}</span>
                                                <span style={{ fontSize: '0.65rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {getTypeIcon(p.type)} {p.type}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '8px' }}>
                                                {p.type === 'BOOLEAN' ? (p.value === 'true' ? '✅ Verdadeiro' : '❌ Falso') : 
                                                 p.type === 'PERCENTAGE' ? `${p.value}%` : p.value}
                                            </div>
                                            {p.description && (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Info size={12} /> {p.description}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                className="btn-icon" 
                                                title="Editar" 
                                                onClick={() => setForm({ key: p.key, type: p.type, value: p.value, description: p.description || '' })}
                                            >
                                                <Plus size={16} />
                                            </button>
                                            <button 
                                                className="btn-icon" 
                                                style={{ color: '#ef4444' }} 
                                                title="Excluir" 
                                                onClick={() => handleDelete(p.id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '10px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', textAlign: 'right' }}>
                                        Atualizado em: {new Date(p.updated_at).toLocaleString('pt-BR')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Parameters;
