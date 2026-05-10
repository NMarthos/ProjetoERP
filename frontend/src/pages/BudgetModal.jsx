import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { X, Plus, Search, Trash2, Check, LayoutGrid, PackagePlus, PlusCircle, Pencil, User, ClipboardList, Paperclip, FileText, Upload, Image } from 'lucide-react';
import { maskCurrency, parseCurrency } from '../utils/masks';
import { createPortal } from 'react-dom';

const BudgetModal = ({ proposal, settings, user, onClose, onSave, autoShowPrint = false }) => {
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
    const [showPrint, setShowPrint] = useState(false);
    const [printType, setPrintType] = useState('PROPOSAL'); // 'PROPOSAL' or 'MATERIALS'

    // Attachments
    const [globalAttachments, setGlobalAttachments] = useState([]);
    const [newItemAttachments, setNewItemAttachments] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [fullscreenImage, setFullscreenImage] = useState(null);

    // Pricing snapshot at proposal level (persisted on every save)
    const [pricingSnapshot, setPricingSnapshot] = useState(null);

    // Live settings fetched fresh on modal open (overrides stale snapshot)
    const [liveSettings, setLiveSettings] = useState(settings);

    // Payment methods (for proposal print)
    const [paymentMethods, setPaymentMethods] = useState([]);

    // ADM price tooltip
    const [showPriceTooltip, setShowPriceTooltip] = useState(false);
    const isAdm = user?.role === 'ADMIN' || user?.role === 'ADM';

    useEffect(() => {
        api.get('/products')
            .then(res => setProducts(res.data.filter(p => p.status === 1)))
            .catch(() => alert('Erro ao buscar produtos'))
            .finally(() => setLoading(false));

        api.get('/payment-methods')
            .then(res => setPaymentMethods(res.data || []))
            .catch(() => {});

        // Always fetch fresh settings on open and rebuild the pricing snapshot
        api.get('/settings')
            .then(res => {
                const fresh = res.data;
                setLiveSettings(fresh);
                // Immediately override snapshot with current live params
                const freshParams = {
                    commission:  parseFloat((proposal.referrer_commission || 0).toFixed(4)),
                    taxes:       parseFloat((fresh?.taxes       || 0).toFixed(4)),
                    financeCost: parseFloat((fresh?.financeCost || 0).toFixed(4)),
                    markup:      parseFloat((fresh?.markup      || 0).toFixed(4)),
                };
                setPricingSnapshot(freshParams);
                console.log('[BudgetModal] Parâmetros de precificação atualizados:', freshParams);
            })
            .catch(() => {
                // Fallback: use prop settings if API fails
                console.warn('[BudgetModal] Falha ao buscar settings, usando parâmetros do prop.');
            });

        const loadProposalData = async () => {
            try {
                const res = await api.get(`/proposals/${proposal.id}`);
                const freshProposal = res.data;
                if (freshProposal.budget_data) {
                    const parsed = JSON.parse(freshProposal.budget_data);
                    if (Array.isArray(parsed)) {
                        setBudgetItems(parsed);
                        if (parsed.length > 0) setActiveItemId(parsed[0].id);
                    }
                }
                // NOTE: pricing_snapshot from DB is intentionally NOT applied here,
                // as we always want fresh params fetched above to take precedence.
            } catch (e) {
                console.error("Erro ao carregar dados frescos da proposta", e);
                // Fallback to prop if API fails
                if (proposal.budget_data) {
                    try {
                        const parsed = JSON.parse(proposal.budget_data);
                        setBudgetItems(parsed);
                        if (parsed.length > 0) setActiveItemId(parsed[0].id);
                    } catch(err2) {}
                }
            }
        };

        loadProposalData();
        fetchGlobalAttachments();

        // If opened from Proposal Completion Modal, jump straight to print preview
        if (autoShowPrint) {
            setPrintType('PROPOSAL');
            setShowPrint(true);
        }
    }, [proposal.id]);

    const fetchGlobalAttachments = async () => {
        try {
            const res = await api.get(`/proposals/${proposal.id}/attachments`);
            setGlobalAttachments(res.data);
        } catch (err) { console.error("Erro ao buscar anexos"); }
    };


    // CREATE / EDIT ITEM LOGIC
    const handleOpenCreateModal = () => {
        setEditingItemId(null);
        setNewItemName('');
        setNewItemDescription('');
        setNewItemAttachments([]);
        setShowCreateModal(true);
    };

    const handleOpenEditModal = (e, item) => {
        e.stopPropagation();
        setEditingItemId(item.id);
        setNewItemName(item.name);
        setNewItemDescription(item.description || '');
        setNewItemAttachments(item.attachments || []);
        setShowCreateModal(true);
    };

    const handleSaveItemInfo = async () => {
        if (!newItemName.trim()) return alert('Informe o nome do item.');
        
        let updatedItems;
        if (editingItemId) {
            updatedItems = budgetItems.map(item => 
                item.id === editingItemId ? { ...item, name: newItemName, description: newItemDescription, attachments: newItemAttachments } : item
            );
        } else {
            const newItem = {
                id: Date.now().toString(),
                name: newItemName,
                description: newItemDescription,
                attachments: newItemAttachments,
                products: []
            };
            updatedItems = [...budgetItems, newItem];
            setActiveItemId(newItem.id);
        }
        
        setBudgetItems(updatedItems);
        await persistBudget(updatedItems); // Gravação imediata
        
        setShowCreateModal(false);
        setNewItemName('');
        setNewItemDescription('');
        setEditingItemId(null);
    };

    const handleDeleteItem = async (e, id) => {
        e.stopPropagation(); // prevent selecting the item
        if (confirm('Deseja excluir este item e todos os seus produtos?')) {
            const updatedItems = budgetItems.filter(i => i.id !== id);
            setBudgetItems(updatedItems);
            await persistBudget(updatedItems); // Gravação imediata
            if (activeItemId === id) setActiveItemId(null);
        }
    };

    // ACTIVE ITEM LOGIC
    const activeItem = budgetItems.find(i => i.id === activeItemId);

    const getPricingParams = () => ({
        commission:  parseFloat((proposal.referrer_commission || 0).toFixed(4)),
        taxes:       parseFloat((liveSettings?.taxes       || 0).toFixed(4)),
        financeCost: parseFloat((liveSettings?.financeCost || 0).toFixed(4)),
        markup:      parseFloat((liveSettings?.markup      || 0).toFixed(4)),
    });

    // Use the persisted snapshot if available, otherwise use live params
    const activePricingParams = pricingSnapshot || getPricingParams();

    const calculateSalePrice = (cost, params) => {
        const p = params || activePricingParams;
        const comm        = p.commission  / 100;
        const taxes       = p.taxes       / 100;
        const financeCost = p.financeCost / 100;
        const markup      = p.markup      / 100;
        const denominator = 1 - (comm + taxes + financeCost + markup);
        if (denominator <= 0) return cost; // Fallback for invalid configuration
        return cost / denominator;
    };

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
        persistBudget(updatedItems); // Auto-save
        
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
        persistBudget(updatedItems); // Auto-save
    };

    const handlePriceSave = (index, val) => {
        const updatedItems = budgetItems.map(item => {
            if (item.id === activeItemId) {
                const updatedProducts = item.products.map((p, i) => 
                    i === index ? { ...p, product: { ...p.product, value: val }, total: p.quantity * val } : p
                );
                return { ...item, products: updatedProducts };
            }
            return item;
        });
        setBudgetItems(updatedItems);
        persistBudget(updatedItems); // Auto-save
        setEditingPriceId(null);
    };

    const handleUpdateQuantity = (productId) => {
        const qty = parseFloat(customQtyInput[productId]);
        if (isNaN(qty) || qty <= 0) {
            setEditingQtyId(null);
            return;
        }

        const updatedItems = budgetItems.map(item => {
            if (item.id === activeItemId) {
                const updatedProducts = item.products.map(sp => 
                    sp.product.id === productId ? { ...sp, quantity: qty, total: qty * sp.product.value } : sp
                );
                return { ...item, products: updatedProducts };
            }
            return item;
        });
        setBudgetItems(updatedItems);
        persistBudget(updatedItems); // Auto-save
        setEditingQtyId(null);
    };

    const budgetTotal = budgetItems.reduce((acc, item) => {
        const itemCost = item.products.reduce((acc2, p) => acc2 + p.total, 0);
        return acc + calculateSalePrice(itemCost);
    }, 0);

    const persistBudget = async (items) => {
        // Snapshot current pricing params at proposal level
        const currentParams = getPricingParams();
        setPricingSnapshot(currentParams); // Update local state too

        const dataStr = JSON.stringify(items);
        
        // Calculate totals for the entire proposal
        let totalFab = 0;
        let totalAss = 0;
        items.forEach(item => {
            item.products.forEach(p => {
                const unit = p.product.unit?.toUpperCase();
                if (unit === 'DF') totalFab += p.quantity;
                else if (unit === 'DM') totalAss += p.quantity;
                else if (unit === 'DIA') {
                    if (p.product.name.toLowerCase().includes('montagem')) totalAss += p.quantity;
                    else totalFab += p.quantity;
                }
            });
        });

        // Calculate total value using proposal-level snapshot
        const totalValue = items.reduce((acc, item) => {
            const itemCost = item.products.reduce((acc2, p) => acc2 + p.total, 0);
            return acc + calculateSalePrice(itemCost, currentParams);
        }, 0);

        try {
            await api.put(`/proposals/${proposal.id}`, {
                budget_data: dataStr,
                pricing_snapshot: JSON.stringify(currentParams),
                value: totalValue,
                fabrication_days: totalFab,
                assembly_days: totalAss
            });
            console.log('Sincronização realizada com sucesso');
        } catch (err) {
            console.error('Erro ao sincronizar orçamento:', err);
            alert('Falha ao sincronizar dados com o servidor.');
        }
    };

    const validateBudget = () => {
        for (const item of budgetItems) {
            const hasDiaService = item.products.some(p => {
                const unit = p.product.unit?.toUpperCase();
                return ['DIA', 'DF', 'DM'].includes(unit);
            });
            if (!hasDiaService) {
                alert(`O item "${item.name}" não possui custo de fabricação/montagem informado. Adicione um serviço do tipo "DIA", "DF" ou "DM" antes de sair.`);
                return false;
            }
        }
        return true;
    };

    const handleSaveBudget = async () => {
        if (!validateBudget()) return;
        await persistBudget(budgetItems);
        onSave();
    };

    const handleClose = async () => {
        onSave(); // Refreshes parent list and closes
    };

    const handlePrint = () => {
        const oldTitle = document.title;
        const prefix = printType === 'PROPOSAL' ? 'Proposta' : 'Lista Materiais';
        document.title = `${prefix} ${String(proposal.id).padStart(4, '0')}`;
        window.print();
        document.title = oldTitle;
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

    const handleFileUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const fileData = { name: file.name, url: res.data.url, type: file.type };

            if (type === 'GLOBAL') {
                await api.post(`/proposals/${proposal.id}/attachments`, fileData);
                fetchGlobalAttachments();
            } else {
                setNewItemAttachments([...newItemAttachments, fileData]);
            }
        } catch (err) {
            alert('Erro ao fazer upload do arquivo');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteAttachment = async (id, type, index) => {
        if (!confirm('Deseja remover este anexo?')) return;
        try {
            if (type === 'GLOBAL') {
                await api.delete(`/attachments/${id}`);
                fetchGlobalAttachments();
            } else {
                setNewItemAttachments(newItemAttachments.filter((_, i) => i !== index));
            }
        } catch (err) {
            alert('Erro ao remover anexo');
        }
    };

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '1400px', width: '98vw', height: '90vh', display: 'flex', flexDirection: 'column', padding: '1.5rem', position: 'relative' }}>
                
                {/* CREATE / EDIT ITEM MINI-MODAL */}
                {showCreateModal && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px' }}>
                        <div style={{ background: '#0f172a', border: '2.5px solid var(--primary)', padding: '2rem', borderRadius: '16px', width: '600px', maxWidth: '95%', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>
                            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>
                                {editingItemId ? 'Editar Item do Orçamento' : 'Criar Novo Item do Orçamento'}
                            </h3>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label>Nome (Ex: Cozinha, Banheiro) *</label>
                                <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Nome do item..." />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '1.5rem' }}>
                                <div>
                                    <label>Descrição (Ficará visível na impressão)</label>
                                    <textarea 
                                        value={newItemDescription} 
                                        onChange={e => setNewItemDescription(e.target.value)} 
                                        placeholder="Digite aqui as especificações deste item..."
                                        style={{ width: '100%', minHeight: '150px', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', outline: 'none', resize: 'vertical', fontSize: '0.9rem', lineHeight: '1.5' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        Documentos/Fotos do Ambiente
                                        <button 
                                            onClick={() => document.getElementById('item-file-input').click()}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <Plus size={14}/> Anexar
                                        </button>
                                    </label>
                                    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', height: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px' }}>
                                        {newItemAttachments.length === 0 ? (
                                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                <Paperclip size={24} style={{ marginBottom: '8px', opacity: 0.5 }}/>
                                                Nenhum arquivo anexado
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {newItemAttachments.map((att, idx) => (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px', fontSize: '0.8rem' }}>
                                                        {att.type?.includes('image') ? <Image size={14} color="#10b981"/> : <FileText size={14} color="var(--primary)"/>}
                                                        <a href={att.url} target="_blank" rel="noreferrer" style={{ flex: 1, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</a>
                                                        <button onClick={() => handleDeleteAttachment(null, 'ITEM', idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <input id="item-file-input" type="file" hidden onChange={(e) => handleFileUpload(e, 'ITEM')} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ padding: '8px 16px' }}>Cancelar</button>
                                <button onClick={handleSaveItemInfo} className="btn-premium" style={{ padding: '8px 20px' }}>{editingItemId ? 'Salvar Alterações' : 'Criar Item'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* CREATE PRODUCT MINI-MODAL */}
                {showProductModal && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px' }}>
                        <div style={{ background: '#0f172a', border: '2.5px solid var(--primary)', padding: '2rem', borderRadius: '16px', width: '500px', maxWidth: '90%', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>
                            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Criar Novo Produto</h3>
                            <div style={{ marginBottom: '1rem' }}>
                                <label>Nome do Produto *</label>
                                <input type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="Ex: Dobradiça X" />
                            </div>
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Unidade</label>
                                    <select value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})}>
                                        {['UN', 'M', 'M2', 'L', 'CXA', 'PAR', 'H', 'DIA', 'CHP', 'PC', 'DF', 'DM'].map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Valor Unitário</label>
                                    <input type="text" value={newProduct.value} onChange={e => setNewProduct({...newProduct, value: maskCurrency(e.target.value)})} placeholder="R$ 0,00" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowProductModal(false)} className="btn-secondary" style={{ padding: '8px 16px' }}>Cancelar</button>
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
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cronograma Previsto</div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '2px' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary)' }}>Fab: {
                                    budgetItems.reduce((acc, item) => acc + item.products.reduce((acc2, p) => {
                                        const unit = p.product.unit?.toUpperCase();
                                        if (unit === 'DF') return acc2 + p.quantity;
                                        if (unit === 'DIA' && !p.product.name.toLowerCase().includes('montagem')) return acc2 + p.quantity;
                                        return acc2;
                                    }, 0), 0)
                                }d</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10b981' }}>Mont: {
                                    budgetItems.reduce((acc, item) => acc + item.products.reduce((acc2, p) => {
                                        const unit = p.product.unit?.toUpperCase();
                                        if (unit === 'DM') return acc2 + p.quantity;
                                        if (unit === 'DIA' && p.product.name.toLowerCase().includes('montagem')) return acc2 + p.quantity;
                                        return acc2;
                                    }, 0), 0)
                                }d</div>
                            </div>
                        </div>
                        {/* ADM-only price tooltip */}
                        <div
                            style={{ position: 'relative' }}
                            onMouseEnter={() => isAdm && setShowPriceTooltip(true)}
                            onMouseLeave={() => setShowPriceTooltip(false)}
                        >
                            <div style={{
                                fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981',
                                cursor: isAdm ? 'help' : 'default',
                                borderBottom: isAdm ? '1px dashed #10b981' : 'none',
                                paddingBottom: '1px'
                            }}>
                                Total: {maskCurrency(budgetTotal)}
                                {isAdm && <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '6px', verticalAlign: 'middle' }}>ADM ▸</span>}
                            </div>

                            {showPriceTooltip && isAdm && (() => {
                                const snap = activePricingParams;
                                const comm        = snap.commission;
                                const taxes       = snap.taxes;
                                const financeCost = snap.financeCost;
                                const markup      = snap.markup;
                                const totalDeductions = comm + taxes + financeCost + markup;
                                const denominator = (100 - totalDeductions) / 100;
                                const totalCost = budgetItems.reduce((acc, item) => acc + item.products.reduce((a2, p) => a2 + p.total, 0), 0);

                                return (
                                    <div style={{
                                        position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                                        width: '340px', background: '#0f172a',
                                        border: '1.5px solid var(--primary)', borderRadius: '14px',
                                        boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 9999,
                                        overflow: 'hidden', animation: 'fadeIn 0.15s ease'
                                    }}>
                                        {/* Header */}
                                        <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', padding: '12px 16px' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>📐 Formação de Preço</div>
                                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Parâmetros do cálculo desta proposta</div>
                                        </div>

                                        {/* Params */}
                                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {[
                                                { label: 'Comissão do Indicador', value: comm, origin: `Proposta #${String(proposal.id).padStart(4,'0')}` },
                                                { label: 'Impostos',              value: taxes,       origin: 'Config. Globais' },
                                                { label: 'Custo Financeiro',      value: financeCost, origin: 'Config. Globais' },
                                                { label: 'Markup / Margem',       value: markup,      origin: 'Config. Globais' },
                                            ].map(row => (
                                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.78rem', color: '#e2e8f0', fontWeight: '600' }}>{row.label}</div>
                                                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{row.origin}</div>
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#a5b4fc' }}>{row.value.toFixed(2)}%</div>
                                                </div>
                                            ))}
                                            {/* Total deductions */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(99,102,241,0.15)', borderRadius: '8px', marginTop: '4px' }}>
                                                <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: '800', textTransform: 'uppercase' }}>Total de Deduções</span>
                                                <span style={{ fontSize: '0.95rem', fontWeight: '900', color: '#c4b5fd' }}>{totalDeductions.toFixed(2)}%</span>
                                            </div>
                                        </div>

                                        {/* Formula */}
                                        <div style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.3)', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: '1.8', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ color: '#94a3b8', fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px', fontFamily: 'sans-serif' }}>Fórmula</div>
                                            <div>
                                                <span style={{ color: '#7dd3fc' }}>Divisor</span>
                                                <span style={{ color: '#94a3b8' }}> = 1 − {totalDeductions.toFixed(2)}% = </span>
                                                <span style={{ color: '#34d399', fontWeight: 'bold' }}>{denominator.toFixed(4)}</span>
                                            </div>
                                            <div>
                                                <span style={{ color: '#7dd3fc' }}>Preço de Venda</span>
                                                <span style={{ color: '#94a3b8' }}> = Custo ÷ Divisor</span>
                                            </div>
                                        </div>

                                        {/* Summary */}
                                        <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                                                <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Custo Direto</div>
                                                <div style={{ fontSize: '1rem', fontWeight: '900', color: '#f1f5f9', marginTop: '2px' }}>{maskCurrency(totalCost)}</div>
                                            </div>
                                            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px' }}>
                                                <div style={{ fontSize: '0.6rem', color: '#10b981', textTransform: 'uppercase', fontWeight: '700' }}>Preço de Venda</div>
                                                <div style={{ fontSize: '1rem', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>{maskCurrency(budgetTotal)}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        <button onClick={handleClose} className="btn-icon"><X size={20} /></button>
                    </div>
                </div>

                {/* ITEMS GRID */}
                <div style={{ display: 'flex', gap: '15px', marginBottom: '1rem', height: '120px' }}>
                    <div style={{ flex: 1, display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', borderBottom: '1.5px solid var(--border)' }}>
                        {budgetItems.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '10px 0' }}>Nenhum item criado. Clique em "Novo Item" acima.</p> :
                        budgetItems.map((item) => (
                            <div 
                                key={item.id} 
                                onClick={() => setActiveItemId(item.id)}
                                style={{ 
                                    minWidth: '220px', 
                                    padding: '12px', 
                                    borderRadius: '12px', 
                                    border: activeItemId === item.id ? '2px solid var(--primary)' : '1px solid var(--border)', 
                                    background: activeItemId === item.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', 
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
                                
                                <div style={{ display: 'flex', gap: '10px', marginTop: '6px', alignItems: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--primary)' }}>
                                        Fab: {item.products.reduce((acc, p) => {
                                            const unit = p.product.unit?.toUpperCase();
                                            if (unit === 'DF') return acc + p.quantity;
                                            if (unit === 'DIA' && !p.product.name.toLowerCase().includes('montagem')) return acc + p.quantity;
                                            return acc;
                                        }, 0)}d
                                    </div>
                                    <div style={{ fontSize: '0.7rem', background: 'rgba(16,185,129,0.2)', padding: '2px 6px', borderRadius: '4px', color: '#10b981' }}>
                                        Mont: {item.products.reduce((acc, p) => {
                                            const unit = p.product.unit?.toUpperCase();
                                            if (unit === 'DM') return acc + p.quantity;
                                            if (unit === 'DIA' && p.product.name.toLowerCase().includes('montagem')) return acc + p.quantity;
                                            return acc;
                                        }, 0)}d
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'white', marginLeft: 'auto' }}>
                                        {maskCurrency(calculateSalePrice(item.products.reduce((acc, p) => acc + (p.total || 0), 0)))}
                                    </div>
                                </div>
                                {item.attachments?.length > 0 && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '6px' }}>
                                        <Paperclip size={10}/> {item.attachments.length}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* BOTTOM SECTION */}
                <div style={{ flex: 1, display: 'flex', gap: '20px', minHeight: 0, opacity: activeItem ? 1 : 0.4, pointerEvents: activeItem ? 'auto' : 'none' }}>
                    
                    {/* ANEXOS PANEL (Bottom Left) */}
                    <div style={{ width: '300px', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Anexos</span>
                            <button 
                                onClick={() => document.getElementById('global-file-input').click()}
                                style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}
                            >
                                Anexar
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '8px' }}>
                            {[
                                ...globalAttachments.map(a => ({ ...a, origin: 'Geral', sourceType: 'GLOBAL' })),
                                ...budgetItems.flatMap(item => (item.attachments || []).map((a, idx) => ({ ...a, origin: item.name, itemId: item.id, itemIdx: idx, sourceType: 'ITEM' })))
                            ].length === 0 ? (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Nenhum anexo encontrado</div>
                            ) : (
                                [
                                    ...globalAttachments.map(a => ({ ...a, origin: 'Geral', sourceType: 'GLOBAL' })),
                                    ...budgetItems.flatMap(item => (item.attachments || []).map((a, idx) => ({ ...a, origin: item.name, itemId: item.id, itemIdx: idx, sourceType: 'ITEM' })))
                                ].map((att, i) => (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Paperclip size={12} color={att.sourceType === 'GLOBAL' ? 'var(--primary)' : '#10b981'}/>
                                            <a href={att.url} target="_blank" rel="noreferrer" style={{ flex: 1, color: 'white', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>{att.name}</a>
                                            <button onClick={() => {
                                                if (att.sourceType === 'GLOBAL') handleDeleteAttachment(att.id, 'GLOBAL');
                                                else {
                                                    if (confirm(`Deseja remover o anexo de "${att.origin}"?`)) {
                                                        const updated = budgetItems.map(it => it.id === att.itemId ? { ...it, attachments: it.attachments.filter((_, idx) => idx !== att.itemIdx) } : it);
                                                        setBudgetItems(updated);
                                                        persistBudget(updated);
                                                    }
                                                }
                                            }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={12}/></button>
                                        </div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: att.sourceType === 'GLOBAL' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)', color: att.sourceType === 'GLOBAL' ? 'var(--primary)' : '#10b981', fontWeight: 'bold' }}>
                                                {att.origin}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <input id="global-file-input" type="file" hidden onChange={(e) => handleFileUpload(e, 'GLOBAL')} />
                    </div>
                    
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
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid var(--border)' }}>
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
                                                <div 
                                                    className="editable-field"
                                                    onClick={() => setEditingPriceId(p.id)} 
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    {currentPriceStr}
                                                    <Pencil size={10} />
                                                </div>
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
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1.5px solid var(--border)', borderRadius: '12px', padding: '15px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h4 style={{ color: 'var(--primary)', margin: 0 }}>
                                Produtos em: {activeItem?.name || '---'}
                            </h4>
                            {activeItem && (() => {
                                const itemCost = activeItem.products.reduce((acc, p) => acc + p.total, 0);
                                const itemSalePrice = calculateSalePrice(itemCost);
                                return (
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Custo Direto</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>{maskCurrency(itemCost)}</div>
                                        </div>
                                        <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.6rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Preço de Venda</div>
                                            <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#10b981' }}>{maskCurrency(itemSalePrice)}</div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                            {!activeItem ? <p style={{padding: '20px', textAlign: 'center', color:'var(--text-muted)'}}>Selecione um item acima</p> :
                             activeItem.products.length === 0 ? <p style={{padding: '20px', textAlign: 'center', color:'var(--text-muted)', fontSize:'0.85rem'}}>Nenhum produto adicionado neste item.</p> :
                             activeItem.products.map(sp => (
                                <div key={sp.product.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid var(--border)' }}>
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
                                                <div 
                                                    className="editable-field"
                                                    onClick={() => {
                                                        setCustomQtyInput({...customQtyInput, [sp.product.id]: sp.quantity});
                                                        setEditingQtyId(sp.product.id);
                                                    }} 
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    {sp.quantity}
                                                    <Pencil size={10} />
                                                </div>
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

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '2px solid var(--border)', paddingTop: '1.5rem' }}>
                    <button 
                        onClick={() => { 
                            if (validateBudget()) {
                                setPrintType('PROPOSAL'); 
                                setShowPrint(true); 
                            }
                        }} 
                        style={{ padding: '10px 20px', borderRadius: '8px', border: '2px solid #eab308', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', cursor: 'pointer', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        Gerar Proposta <LayoutGrid size={18} />
                    </button>
                    <button onClick={() => { setPrintType('MATERIALS'); setShowPrint(true); }} style={{ padding: '10px 20px', borderRadius: '8px', border: '2px solid #6366f1', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', cursor: 'pointer', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Lista de Materiais <ClipboardList size={18} />
                    </button>
                    <button onClick={handleClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: '600' }}>Fechar / Cancelar</button>
                </div>

                {/* PRINT PREVIEW OVERLAY */}
                {showPrint && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#fff', color: '#000', zIndex: 20000, overflowY: 'auto', padding: '40px' }}>
                        <style>{`
                            @media print {
                                .no-print { display: none !important; }
                                body { margin: 0; background: white; }
                                .print-container { padding: 0 !important; width: 100% !important; }
                            }
                        `}</style>
                        
                        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 'bold', color: '#1e293b' }}>Visualização de Impressão</div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={handlePrint} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Imprimir Agora</button>
                                <button onClick={() => autoShowPrint ? onClose() : setShowPrint(false)} style={{ background: '#64748b', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Fechar</button>
                            </div>
                        </div>

                        <div className="print-container" style={{ maxWidth: '850px', margin: '0 auto', fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#1e293b' }}>
                            {printType === 'MATERIALS' ? (
                                <>
                                    {/* HEADER */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', borderBottom: '3px solid #6366f1', paddingBottom: '25px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {user?.logo_url ? (
                                                <img src={user.logo_url} alt="Logo" style={{ maxHeight: '70px', maxWidth: '200px', objectFit: 'contain', marginBottom: '10px' }} />
                                            ) : (
                                                <div style={{ fontSize: '24px', fontWeight: '900', color: '#6366f1', letterSpacing: '-1px' }}>ERP MÓVEIS</div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
                                                <User size={14} /> <strong>Responsável:</strong> {user?.name || 'Não identificado'}
                                            </div>
                                        </div>
                                        
                                        <div style={{ textAlign: 'right' }}>
                                            <h1 style={{ fontSize: '28px', margin: '0 0 10px', color: '#1e293b', fontWeight: '900' }}>DETALHAMENTO DE MATERIAIS / CUSTOS</h1>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '10px', justifyContent: 'end', fontSize: '14px' }}>
                                                <span style={{ color: '#64748b' }}>Proposta ref:</span>
                                                <strong style={{ color: '#1e293b' }}>#{String(proposal.id).padStart(4, '0')}</strong>
                                                <span style={{ color: '#64748b' }}>Cliente:</span>
                                                <strong style={{ color: '#1e293b' }}>{proposal.partner_name}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* GROUPED BY ITEM */}
                                    {budgetItems.map(item => {
                                        const services = item.products.filter(sp => ['DIA', 'DF', 'DM'].includes(sp.product.unit?.toUpperCase()));
                                        const materials = item.products.filter(sp => !['DIA', 'DF', 'DM'].includes(sp.product.unit?.toUpperCase()));
                                        const subTotalMaterial = materials.reduce((acc, p) => acc + p.total, 0);
                                        const subTotalService = services.reduce((acc, p) => acc + p.total, 0);

                                        return (
                                            <div key={item.id} style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
                                                <div style={{ background: '#1e293b', color: '#fff', padding: '10px 15px', borderRadius: '8px 8px 0 0', fontWeight: 'bold', fontSize: '14px' }}>
                                                    AMBIENTE: {item.name.toUpperCase()}
                                                </div>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                                                    <thead>
                                                        <tr style={{ background: '#f1f5f9' }}>
                                                            <th style={{ padding: '10px', fontSize: '11px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>DESCRIÇÃO</th>
                                                            <th style={{ padding: '10px', fontSize: '11px', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>QTD</th>
                                                            <th style={{ padding: '10px', fontSize: '11px', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>CUSTO UN.</th>
                                                            <th style={{ padding: '10px', fontSize: '11px', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>TOTAL</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {materials.length > 0 && (
                                                            <>
                                                                <tr style={{ background: '#f8fafc' }}><td colSpan="4" style={{ padding: '5px 10px', fontSize: '10px', fontWeight: '900', color: '#6366f1' }}>MATERIAIS</td></tr>
                                                                {materials.map((sp, idx) => (
                                                                    <tr key={`mat-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px' }}>{sp.product.name}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'center' }}>{sp.quantity} {sp.product.unit}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right' }}>{maskCurrency(sp.product.value)}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right' }}>{maskCurrency(sp.total)}</td>
                                                                    </tr>
                                                                ))}
                                                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                                                    <td colSpan="3" style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Subtotal Materiais:</td>
                                                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '12px', fontWeight: '800' }}>{maskCurrency(subTotalMaterial)}</td>
                                                                </tr>
                                                            </>
                                                        )}
                                                        {services.length > 0 && (
                                                            <>
                                                                <tr style={{ background: '#f8fafc' }}><td colSpan="4" style={{ padding: '5px 10px', fontSize: '10px', fontWeight: '900', color: '#6366f1' }}>SERVIÇOS</td></tr>
                                                                {services.map((sp, idx) => (
                                                                    <tr key={`ser-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px' }}>{sp.product.name}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'center' }}>{sp.quantity} {sp.product.unit}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right' }}>{maskCurrency(sp.product.value)}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right' }}>{maskCurrency(sp.total)}</td>
                                                                    </tr>
                                                                ))}
                                                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                                                    <td colSpan="3" style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Subtotal Serviços:</td>
                                                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '12px', fontWeight: '800' }}>{maskCurrency(subTotalService)}</td>
                                                                </tr>
                                                            </>
                                                        )}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr style={{ background: '#f8fafc' }}>
                                                            <td colSpan="3" style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold' }}>CUSTO TOTAL DO AMBIENTE:</td>
                                                            <td style={{ padding: '10px', textAlign: 'right', fontSize: '13px', fontWeight: '900', color: '#10b981' }}>{maskCurrency(subTotalMaterial + subTotalService)}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        );
                                    })}

                                    <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                                        <span>Documento para uso interno (Custos Diretos).</span>
                                        <span>Gerado em {new Date().toLocaleString('pt-BR')}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* HEADER */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', borderBottom: '3px solid #6366f1', paddingBottom: '25px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {user?.logo_url ? (
                                                <img src={user.logo_url} alt="Logo" style={{ maxHeight: '70px', maxWidth: '200px', objectFit: 'contain', marginBottom: '10px' }} />
                                            ) : (
                                                <div style={{ fontSize: '24px', fontWeight: '900', color: '#6366f1', letterSpacing: '-1px' }}>ERP MÓVEIS</div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
                                                <User size={14} /> <strong>Responsável:</strong> {user?.name || 'Não identificado'}
                                            </div>
                                        </div>
                                        
                                        <div style={{ textAlign: 'right' }}>
                                            <h1 style={{ fontSize: '28px', margin: '0 0 10px', color: '#1e293b', fontWeight: '900' }}>PROPOSTA COMERCIAL</h1>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '10px', justifyContent: 'end', fontSize: '14px' }}>
                                                <span style={{ color: '#64748b' }}>Proposta nº:</span>
                                                <strong style={{ color: '#1e293b' }}>{String(proposal.id).padStart(4, '0')}</strong>
                                                <span style={{ color: '#64748b' }}>Data de Emissão:</span>
                                                <strong style={{ color: '#1e293b' }}>{new Date(proposal.phase_date || Date.now()).toLocaleDateString('pt-BR')}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CLIENT INFO */}
                                    <div style={{ background: '#f8fafc', padding: '25px', borderRadius: '15px', marginBottom: '60px', border: '1.5px solid #e2e8f0' }}>
                                        <h4 style={{ textTransform: 'uppercase', fontSize: '11px', color: '#6366f1', margin: '0 0 12px', letterSpacing: '1px', fontWeight: '800' }}>Dados do Cliente</h4>
                                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>{proposal.partner_name}</div>
                                        <div style={{ fontSize: '15px', color: '#475569', marginTop: '6px' }}>{proposal.partner_phone || proposal.phone || 'Telefone não informado'}</div>
                                    </div>

                                    {/* DETAILS */}
                                    <div style={{ marginBottom: '40px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: '#6366f1', color: '#fff' }}>
                                                    <th style={{ padding: '15px', fontSize: '12px', textAlign: 'left', borderRadius: '8px 0 0 0' }}>ITEM / DESCRIÇÃO</th>
                                                    <th style={{ padding: '15px', fontSize: '12px', textAlign: 'right', borderRadius: '0 8px 0 0' }}>VALOR TOTAL</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {budgetItems.map(item => {
                                                    const itemCost = item.products.reduce((acc2, p) => acc2 + p.total, 0);
                                                    const itemPrice = calculateSalePrice(itemCost);

                                                    return (
                                                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '20px 15px', verticalAlign: 'top' }}>
                                                                <div style={{ fontWeight: '800', fontSize: '15px', color: '#1e293b', marginBottom: '8px', textTransform: 'uppercase' }}>{item.name}</div>
                                                                <div style={{ color: '#475569', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap', marginBottom: '8px' }}>
                                                                    {item.description || 'Nenhuma especificação informada.'}
                                                                </div>
                                                                
                                                                {/* Anexos do Item (Imagens e Arquivos) */}
                                                                {item.attachments && item.attachments.length > 0 && (
                                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                                                                        {item.attachments.map((att, iidx) => {
                                                                            const isImage = att.type?.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url);
                                                                            
                                                                            return (
                                                                                <div 
                                                                                    key={iidx} 
                                                                                    onClick={() => isImage ? setFullscreenImage(att.url) : window.open(att.url, '_blank')}
                                                                                    style={{ width: '36px', height: '36px', borderRadius: '4px', border: '1px solid #e2e8f0', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.02)' }}
                                                                                    title={att.name}
                                                                                >
                                                                                    {isImage ? (
                                                                                        <img 
                                                                                            src={att.url} 
                                                                                            alt="Anexo" 
                                                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                                                            onError={(e) => {
                                                                                                e.target.style.display = 'none';
                                                                                                e.target.parentElement.innerHTML = '<span style="font-size: 8px; color: #ef4444">ERR</span>';
                                                                                            }}
                                                                                        />
                                                                                    ) : (
                                                                                        <Paperclip size={16} color="var(--primary)" />
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '20px 15px', textAlign: 'right', fontWeight: '900', verticalAlign: 'top', fontSize: '16px', color: '#1e293b' }}>
                                                                {maskCurrency(itemPrice)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* PAYMENT CONDITIONS */}
                                    {(() => {
                                        // Pick the most recent active payment method
                                        const activeMethod = [...paymentMethods]
                                            .filter(m => m.active === 1)
                                            .slice(-1)[0]; // last inserted = most recent

                                        if (!activeMethod || !activeMethod.conditions?.length) return null;

                                        return (
                                            <div style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                                    <div style={{ height: '3px', flex: 1, background: 'linear-gradient(90deg, #6366f1, transparent)' }} />
                                                    <div style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6366f1', whiteSpace: 'nowrap' }}>
                                                        💳 Condições de Pagamento
                                                    </div>
                                                    <div style={{ height: '3px', flex: 1, background: 'linear-gradient(270deg, #6366f1, transparent)' }} />
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                                                    {(() => {
                                                        // Max finance cost across ALL conditions → used for à vista discount
                                                        const maxFinancePct = Math.max(
                                                            0,
                                                            ...activeMethod.conditions.map(c => c.finance_cost_percentage || 0)
                                                        );
                                                        // Discount for à vista = 70% of the max finance cost
                                                        const aVistaExtraDiscountPct = parseFloat((maxFinancePct * 0.70).toFixed(2));

                                                        return activeMethod.conditions.map((cond, idx) => {
                                                            const total        = budgetTotal;
                                                            const installments = cond.installments || 1;
                                                            const isAVista     = installments === 1;

                                                            // For à vista: apply the automatic extra discount on top of any existing discount
                                                            const totalDiscountPct    = isAVista
                                                                ? (cond.discount_percentage || 0) + aVistaExtraDiscountPct
                                                                : (cond.discount_percentage || 0);

                                                            const discountedTotal  = total * (1 - totalDiscountPct / 100);
                                                            const financedTotal    = discountedTotal * (1 + (cond.finance_cost_percentage || 0) / 100);
                                                            const downPct          = cond.down_payment_percentage || 0;
                                                            const downValue        = financedTotal * (downPct / 100);
                                                            const remaining        = financedTotal - downValue;
                                                            const installAmt       = installments > 1
                                                                ? remaining / installments
                                                                : financedTotal;

                                                            return (
                                                                <div key={idx} style={{
                                                                    border: '1.5px solid #e2e8f0',
                                                                    borderRadius: '12px',
                                                                    padding: '14px 16px',
                                                                    background: isAVista
                                                                        ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                                                                        : '#f8fafc',
                                                                    borderColor: isAVista ? '#86efac' : '#e2e8f0',
                                                                }}>
                                                                    {/* Card title: Opção 1, Opção 2, ... */}
                                                                    <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                                                        Opção {idx + 1}
                                                                    </div>

                                                                    {/* Main descriptive text — reflects exactly what's configured */}
                                                                    <div style={{ fontSize: '13px', color: isAVista ? '#15803d' : '#1e293b', fontWeight: '900', borderTop: '1px solid #cbd5e1', paddingTop: '6px', lineHeight: '1.6' }}>
                                                                        {isAVista ? (
                                                                            `À vista: ${maskCurrency(financedTotal)}`
                                                                        ) : downPct > 0 ? (
                                                                            <>
                                                                                <div>Entrada de {downPct}%: <span style={{ color: '#6366f1' }}>{maskCurrency(downValue)}</span></div>
                                                                                <div>+ {installments}x de <span style={{ color: '#6366f1' }}>{maskCurrency(installAmt)}</span></div>
                                                                            </>
                                                                        ) : (
                                                                            `${installments}x de ${maskCurrency(installAmt)}`
                                                                        )}
                                                                    </div>

                                                                    {/* Discount percentage — shown below the payment text when > 0 */}
                                                                    {(() => {
                                                                        const discPct = isAVista
                                                                            ? (cond.discount_percentage || 0) + aVistaExtraDiscountPct
                                                                            : (cond.discount_percentage || 0);
                                                                        return discPct > 0 ? (
                                                                            <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700', marginTop: '4px' }}>
                                                                                Desconto: {discPct.toFixed(2)}%
                                                                            </div>
                                                                        ) : null;
                                                                    })()}
                                                                </div>
                                                             );
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* FOOTER */}
                                    <div style={{ marginTop: '40px', pageBreakInside: 'avoid' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '30px', padding: '25px', background: '#f1f5f9', borderRadius: '12px' }}>
                                            <div style={{ textAlign: 'right', borderRight: '1px solid #cbd5e1', paddingRight: '30px' }}>
                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Prazos de Produção</div>
                                                <div style={{ display: 'flex', gap: '15px', marginTop: '4px' }}>
                                                    <div style={{ fontSize: '14px', color: '#1e293b' }}>Fabricação: <strong>{
                                                        budgetItems.reduce((acc, item) => acc + item.products.reduce((acc2, p) => {
                                                            const unit = p.product.unit?.toUpperCase();
                                                            if (unit === 'DF') return acc2 + p.quantity;
                                                            if (unit === 'DIA' && !p.product.name.toLowerCase().includes('montagem')) return acc2 + p.quantity;
                                                            return acc2;
                                                        }, 0), 0)
                                                    } dias</strong></div>
                                                    <div style={{ fontSize: '14px', color: '#1e293b' }}>Instalação: <strong>{
                                                        budgetItems.reduce((acc, item) => acc + item.products.reduce((acc2, p) => {
                                                            const unit = p.product.unit?.toUpperCase();
                                                            if (unit === 'DM') return acc2 + p.quantity;
                                                            if (unit === 'DIA' && p.product.name.toLowerCase().includes('montagem')) return acc2 + p.quantity;
                                                            return acc2;
                                                        }, 0), 0)
                                                    } dias</strong></div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600' }}>VALOR TOTAL DO INVESTIMENTO</div>
                                                <div style={{ fontSize: '32px', fontWeight: '900', color: '#10b981' }}>{maskCurrency(budgetTotal)}</div>
                                            </div>
                                        </div>
                                        
                                        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: '600' }}>Validade da proposta: 10 dias corridos.</span>
                                        </div>

                                        <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center', marginTop: '24px' }}>
                                            <div style={{ borderBottom: '1px solid #94a3b8', margin: '30px 40px 10px' }}></div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>Aceite do Cliente</div>
                                        </div>
                                        
                                        <div style={{ marginTop: '40px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                                            Documento gerado eletronicamente em {new Date().toLocaleString('pt-BR')} por {user?.name}.
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Overlay de Imagem em Tela Cheia */}
                {fullscreenImage && (
                    <div 
                        onClick={() => setFullscreenImage(null)}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '2rem' }}
                    >
                        <img src={fullscreenImage} alt="Fullscreen" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }} />
                        <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}><X size={24} /></button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default BudgetModal;
