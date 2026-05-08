import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { X, Plus, Search, Trash2, Check, LayoutGrid, PackagePlus, PlusCircle, Pencil } from 'lucide-react';
import { maskCurrency, parseCurrency } from '../utils/masks';
import { createPortal } from 'react-dom';

const BudgetModal = ({ proposal, onClose, onSave }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [budgetItems, setBudgetItems] = useState([]);
    const [activeItemId, setActiveItemId] = useState(null);
    
    // Create / Edit Item Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingItemId, setEditingItemId] = useState(null);
    const [newItemName, setNewItemName] = useState('');
    const [newItemDescription, setNewItemDescription] = useState('');

    // Products Search & Custom Price
    const [search, setSearch] = useState('');
    const [quantityInput, setQuantityInput] = useState({});
    const [customPriceInput, setCustomPriceInput] = useState({});
    const [editingPriceId, setEditingPriceId] = useState(null);
    const [editingQtyId, setEditingQtyId] = useState(null);
    const [customQtyInput, setCustomQtyInput] = useState({});

    // New Product Modal
    const [showProductModal, setShowProductModal] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', unit: 'UN', value: '' });

    useEffect(() => {
        api.get('/products')
            .then(res => setProducts(res.data.filter(p => p.status === 1)))
            .catch(() => alert('Erro ao buscar produtos'))
            .finally(() => setLoading(false));

        if (proposal.budget_data) {
            try {
                const parsed = JSON.parse(proposal.budget_data);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setBudgetItems(parsed);
                    setActiveItemId(parsed[0].id); // Auto select first
                }
            } catch (e) {
                console.error("Erro ao ler budget_data", e);
            }
        }
    }, [proposal]);


    // CREATE / EDIT ITEM LOGIC
    const handleOpenCreateModal = () => {
        setEditingItemId(null);
        setNewItemName('');
        setNewItemDescription('');
        setShowCreateModal(true);
    };

    const handleOpenEditModal = (e, item) => {
        e.stopPropagation();
        setEditingItemId(item.id);
        setNewItemName(item.name);
        
        const mdfProducts = item.products.filter(sp => sp.product.name.toLowerCase().includes('mdf'));
        let defaultDesc = item.description || '';
        if (!defaultDesc && mdfProducts.length > 0) {
            const mdfNames = mdfProducts.map(sp => sp.product.name).join(', ');
            defaultDesc = `Mdfs utilizados neste projeto: ${mdfNames}`;
        }
        setNewItemDescription(defaultDesc);
        
        setShowCreateModal(true);
    };

    const handleSaveItemInfo = () => {
        if (!newItemName.trim()) return alert('Informe o nome do item.');
        
        if (editingItemId) {
            // Edit existing
            setBudgetItems(budgetItems.map(item => 
                item.id === editingItemId ? { ...item, name: newItemName, description: newItemDescription } : item
            ));
        } else {
            // Create new
            const newItem = {
                id: Date.now().toString(),
                name: newItemName,
                description: newItemDescription,
                products: []
            };
            setBudgetItems([...budgetItems, newItem]);
            setActiveItemId(newItem.id);
        }
        
        setShowCreateModal(false);
        setNewItemName('');
        setNewItemDescription('');
        setEditingItemId(null);
    };

    // ACTIVE ITEM LOGIC
    const activeItem = budgetItems.find(i => i.id === activeItemId);

    const availableProducts = products.filter(p => {
        if (!activeItem) return false;
        const isSelected = activeItem.products.some(sp => sp.product.id === p.id);
        if (isSelected) return false;
        
        if (search) {
            return p.name.toLowerCase().includes(search.toLowerCase());
        }
        return true;
    });

    const handleAddProduct = (product) => {
        if (!activeItem) return;
        const qty = parseFloat(quantityInput[product.id] || '1');
        if (isNaN(qty) || qty <= 0) return alert('Quantidade inválida');

        let unitValue = product.value || 0;
        if (customPriceInput[product.id] !== undefined) {
            unitValue = parseCurrency(customPriceInput[product.id]);
        }

        const newItemProd = {
            product: { ...product, value: unitValue },
            quantity: qty,
            total: qty * unitValue
        };

        const updatedItems = budgetItems.map(item => {
            if (item.id === activeItemId) {
                return { ...item, products: [...item.products, newItemProd] };
            }
            return item;
        });

        setBudgetItems(updatedItems);
        
        setQuantityInput(prev => {
            const next = { ...prev };
            delete next[product.id];
            return next;
        });
    };

    const handleRemoveProduct = (productId) => {
        if (!activeItem) return;
        const updatedItems = budgetItems.map(item => {
            if (item.id === activeItemId) {
                return { ...item, products: item.products.filter(sp => sp.product.id !== productId) };
            }
            return item;
        });
        setBudgetItems(updatedItems);
    };

    const handleUpdateQuantity = (productId) => {
        const qty = parseFloat(customQtyInput[productId]);
        if (isNaN(qty) || qty <= 0) {
            setEditingQtyId(null);
            return;
        }

        const updatedItems = budgetItems.map(item => {
            if (item.id === activeItemId) {
                return {
                    ...item,
                    products: item.products.map(sp => {
                        if (sp.product.id === productId) {
                            return { ...sp, quantity: qty, total: qty * sp.product.value };
                        }
                        return sp;
                    })
                };
            }
            return item;
        });
        setBudgetItems(updatedItems);
        setEditingQtyId(null);
    };

    const handleDeleteItem = (e, id) => {
        e.stopPropagation(); // prevent selecting the item
        if (confirm('Deseja excluir este item e todos os seus produtos?')) {
            setBudgetItems(budgetItems.filter(i => i.id !== id));
            if (activeItemId === id) setActiveItemId(null);
        }
    };

    const budgetTotal = budgetItems.reduce((acc, item) => {
        return acc + item.products.reduce((acc2, p) => acc2 + p.total, 0);
    }, 0);

    const handleSaveBudget = async () => {
        const dataStr = JSON.stringify(budgetItems);
        try {
            await api.put(`/proposals/${proposal.id}`, {
                ...proposal,
                budget_data: dataStr,
                value: budgetTotal
            });
            onSave();
        } catch (err) {
            alert('Erro ao salvar orçamento completo.');
        }
    };

    const handleSaveNewProduct = async () => {
        if (!newProduct.name.trim()) return alert('Informe o nome do produto.');
        const val = parseCurrency(newProduct.value);
        try {
            const res = await api.post('/products', {
                name: newProduct.name,
                unit: newProduct.unit,
                value: val,
                status: 1
            });
            setProducts([...products, res.data.product || res.data]);
            setShowProductModal(false);
            setNewProduct({ name: '', unit: 'UN', value: '' });
        } catch (err) {
            alert('Erro ao criar produto.');
        }
    };

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '1200px', width: '95vw', height: '90vh', display: 'flex', flexDirection: 'column', padding: '1.5rem', position: 'relative' }}>
                
                {/* CREATE / EDIT ITEM MINI-MODAL */}
                {showCreateModal && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px' }}>
                        <div style={{ background: '#111827', border: '1px solid var(--primary)', padding: '2rem', borderRadius: '16px', width: '500px', maxWidth: '90%' }}>
                            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>
                                {editingItemId ? 'Editar Item do Orçamento' : 'Criar Novo Item do Orçamento'}
                            </h3>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label>Nome (Ex: Cozinha, Banheiro) *</label>
                                <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Nome do item..." />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label>Descrição (Ficará visível na impressão)</label>
                                <textarea 
                                    value={newItemDescription} 
                                    onChange={e => setNewItemDescription(e.target.value)} 
                                    placeholder="Ex: Mdfs utilizados neste projeto..."
                                    style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.02)', color: '#fff', outline: 'none', resize: 'vertical' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowCreateModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancelar</button>
                                <button onClick={handleSaveItemInfo} className="btn-premium" style={{ padding: '8px 20px' }}>{editingItemId ? 'Salvar Alterações' : 'Criar Item'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* CREATE PRODUCT MINI-MODAL */}
                {showProductModal && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px' }}>
                        <div style={{ background: '#111827', border: '1px solid var(--primary)', padding: '2rem', borderRadius: '16px', width: '500px', maxWidth: '90%' }}>
                            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Criar Novo Produto</h3>
                            <div style={{ marginBottom: '1rem' }}>
                                <label>Nome do Produto *</label>
                                <input type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="Ex: Dobradiça X" />
                            </div>
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Unidade</label>
                                    <select value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})}>
                                        {['UN', 'M', 'M2', 'L', 'CXA', 'PAR', 'H', 'DIA', 'CHP', 'PC'].map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Valor Unitário</label>
                                    <input type="text" value={newProduct.value} onChange={e => setNewProduct({...newProduct, value: maskCurrency(e.target.value)})} placeholder="R$ 0,00" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowProductModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancelar</button>
                                <button onClick={handleSaveNewProduct} className="btn-premium" style={{ padding: '8px 20px' }}>Salvar Produto</button>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            Orçamento
                            <button onClick={handleOpenCreateModal} title="Adicionar Item" style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                <PackagePlus size={16} /> Novo Item
                            </button>
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>Proposta #{proposal.id} - {proposal.partner_name}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>Total: {maskCurrency(budgetTotal)}</div>
                        <button onClick={onClose} className="btn-icon"><X size={20} /></button>
                    </div>
                </div>

                {/* ITEMS GRID */}
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                    {budgetItems.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '10px 0' }}>Nenhum item criado. Clique em "Novo Item" acima.</p> :
                     budgetItems.map((item) => (
                        <div 
                            key={item.id} 
                            onClick={() => setActiveItemId(item.id)}
                            style={{ 
                                minWidth: '180px', 
                                padding: '12px', 
                                borderRadius: '12px', 
                                border: activeItemId === item.id ? '2px solid var(--primary)' : '1px solid var(--border)', 
                                background: activeItemId === item.id ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)', 
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                        >
                            <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                                <button onClick={(e) => handleOpenEditModal(e, item)} title="Editar Item" style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                </button>
                                <button onClick={(e) => handleDeleteItem(e, item.id)} title="Excluir Item" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                    <X size={14}/>
                                </button>
                            </div>
                            <div style={{ fontWeight: 'bold', color: activeItemId === item.id ? 'var(--primary)' : 'var(--text-main)', fontSize: '0.95rem', marginBottom: '4px', paddingRight: '40px' }}>{item.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.products.length} produtos</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#10b981', marginTop: '4px' }}>
                                {maskCurrency(item.products.reduce((acc, p) => acc + p.total, 0))}
                            </div>
                        </div>
                     ))
                    }
                </div>
                
                {/* PRODUCTS SECTION */}
                <div style={{ flex: 1, display: 'flex', gap: '20px', minHeight: 0, opacity: activeItem ? 1 : 0.4, pointerEvents: activeItem ? 'auto' : 'none' }}>
                    
                    {/* LEFT COLUMN: AVAILABLE PRODUCTS */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h4 style={{ color: 'var(--primary)', margin: 0 }}>Produtos/Serviços Disponíveis</h4>
                            <button onClick={() => setShowProductModal(true)} title="Novo Produto" style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <PlusCircle size={20} />
                            </button>
                        </div>
                        <div style={{ position: 'relative', marginBottom: '10px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input placeholder="Buscar produto..." style={{ paddingLeft: '38px', marginBottom: 0 }} value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                            {loading ? <p style={{padding: '10px', textAlign: 'center'}}>Carregando...</p> : 
                             !activeItem ? <p style={{padding: '10px', textAlign: 'center', color:'var(--text-muted)'}}>Selecione um item acima</p> :
                             availableProducts.length === 0 ? <p style={{padding: '10px', textAlign: 'center', color:'var(--text-muted)', fontSize:'0.85rem'}}>Nenhum produto encontrado</p> :
                             availableProducts.map(p => {
                                const currentPriceStr = customPriceInput[p.id] !== undefined ? customPriceInput[p.id] : maskCurrency(p.value);
                                return (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{p.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                            {editingPriceId === p.id ? (
                                                <input 
                                                    type="text" 
                                                    value={currentPriceStr}
                                                    onChange={e => setCustomPriceInput({...customPriceInput, [p.id]: maskCurrency(e.target.value)})}
                                                    onBlur={() => setEditingPriceId(null)}
                                                    onKeyDown={e => e.key === 'Enter' && setEditingPriceId(null)}
                                                    autoFocus
                                                    style={{ width: '80px', padding: '2px 4px', fontSize: '0.75rem', marginBottom: 0 }}
                                                />
                                            ) : (
                                                <>
                                                    <span>{currentPriceStr}</span>
                                                    <button onClick={() => setEditingPriceId(p.id)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex' }}><Pencil size={12} /></button>
                                                </>
                                            )}
                                            <span>/ {p.unit}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input 
                                            type="number" 
                                            min="0.1" 
                                            step="any"
                                            placeholder="Qtd" 
                                            value={quantityInput[p.id] || ''}
                                            onChange={e => setQuantityInput({...quantityInput, [p.id]: e.target.value})}
                                            style={{ width: '60px', padding: '4px 8px', marginBottom: 0, fontSize: '0.8rem' }}
                                        />
                                        <button onClick={() => handleAddProduct(p)} style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}>
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                                );
                             })
                            }
                        </div>
                    </div>

                    {/* RIGHT COLUMN: SELECTED PRODUCTS */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h4 style={{ color: 'var(--primary)', margin: 0 }}>
                                Produtos em: {activeItem?.name || '---'}
                            </h4>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981' }}>
                                {activeItem ? maskCurrency(activeItem.products.reduce((acc, p) => acc + p.total, 0)) : maskCurrency(0)}
                            </div>
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                            {!activeItem ? <p style={{padding: '20px', textAlign: 'center', color:'var(--text-muted)'}}>Selecione um item acima</p> :
                             activeItem.products.length === 0 ? <p style={{padding: '20px', textAlign: 'center', color:'var(--text-muted)', fontSize:'0.85rem'}}>Nenhum produto adicionado neste item.</p> :
                             activeItem.products.map(sp => (
                                <div key={sp.product.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{sp.product.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                            {editingQtyId === sp.product.id ? (
                                                <input 
                                                    type="number"
                                                    min="0.1"
                                                    step="any"
                                                    value={customQtyInput[sp.product.id] || ''}
                                                    onChange={e => setCustomQtyInput({...customQtyInput, [sp.product.id]: e.target.value})}
                                                    onBlur={() => handleUpdateQuantity(sp.product.id)}
                                                    onKeyDown={e => e.key === 'Enter' && handleUpdateQuantity(sp.product.id)}
                                                    autoFocus
                                                    style={{ width: '60px', padding: '2px 4px', fontSize: '0.75rem', marginBottom: 0 }}
                                                />
                                            ) : (
                                                <>
                                                    <span>{sp.quantity}</span>
                                                    <button onClick={() => {
                                                        setCustomQtyInput({...customQtyInput, [sp.product.id]: sp.quantity});
                                                        setEditingQtyId(sp.product.id);
                                                    }} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex' }}><Pencil size={12} /></button>
                                                </>
                                            )}
                                            <span>{sp.product.unit} x {maskCurrency(sp.product.value)} = </span>
                                            <span style={{color: '#10b981', fontWeight: 'bold'}}>{maskCurrency(sp.total)}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveProduct(sp.product.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                             ))
                            }
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: '600' }}>Fechar / Cancelar</button>
                    <button onClick={handleSaveBudget} className="btn-premium" style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Salvar Orçamento <Check size={18} />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BudgetModal;
