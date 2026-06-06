import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { X, Plus, Search, Trash2, PackagePlus, PlusCircle, Pencil, FileText, Image, Paperclip, LayoutGrid, ClipboardList, User, Loader2, Upload, Package, Layers, Scissors, Wrench, Droplet, Paintbrush, HelpCircle, Briefcase, AlertCircle } from 'lucide-react';
import { maskCurrency, parseCurrency, maskPhone } from '../utils/masks';
import { createPortal } from 'react-dom';
import BuildPresentationModal from './BuildPresentationModal';

// ── Função Auxiliar de Auto-Previsão de Grupo ────────────────────────────────
const predictGroup = (name, unit) => {
    if (!name) return 'Outros';
    const n = name.toUpperCase();
    if (['DF', 'DM', 'DIA', 'H'].includes(unit?.toUpperCase()) || n.includes('MÃO DE OBRA') || n.includes('MAO DE OBRA') || n.includes('SERVIÇO') || n.includes('SERVICO')) return 'Serviços';
    if (n.startsWith('MDF') || n.includes('MDF')) return 'MDFs';
    if (n.startsWith('FB') || n.includes('FB ') || n.includes('FITA DE BORDA') || n.includes('FITA')) return 'Fitas';
    if (n.includes('PARAFUSO') || n.includes('PREGO') || n.includes('COMPONENTES') || n.includes('COMPONENTE')) return 'Componentes';
    if (n.includes('DOBRADIÇA') || n.includes('DOBRADICA') || n.includes('CORREDIÇA') || n.includes('CORREDICA') || n.includes('PUXADOR') || n.includes('FECHADURA') || n.includes('FERRAGEM') || n.includes('FERRAGENS')) return 'Ferragens';
    if (n.includes('COLA') || n.includes('ADESIVO') || n.includes('SELANTE') || n.includes('SILICONE')) return 'Químicos';
    if (n.includes('VIDRO') || n.includes('ESPELHO')) return 'Vidros';
    return 'Outros';
};

const GROUP_SEQUENCE = [
    { key: 'MDFs', label: 'MDFs', icon: Layers },
    { key: 'Fitas', label: 'Fitas', icon: Scissors },
    { key: 'Químicos', label: 'Químicos', icon: Droplet },
    { key: 'Ferragens', label: 'Ferragens', icon: Wrench },
    { key: 'Componentes', label: 'Componentes', icon: Package },
    { key: 'Vidros', label: 'Vidros', icon: Paintbrush },
    { key: 'Outros', label: 'Outros', icon: HelpCircle },
    { key: 'Serviços', label: 'Serviços', icon: Briefcase }
];

const BudgetModal = ({ proposal, settings, user, onClose, onSave, autoShowPrint = false }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [budgetItems, setBudgetItems] = useState([]);
    const [activeItemId, setActiveItemId] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState('MDFs');
    const [showDivergencesModal, setShowDivergencesModal] = useState(false);
    const [divergences, setDivergences] = useState([]);
    
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

    // New Product Modal (full form — matches Products page)
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null); // null = create, object = edit
    const [newProduct, setNewProduct] = useState({ name: '', unit: 'UN', value: 0, manufacturer_id: '', photo: '', status: 1, group_name: 'Outros' });

    // Pricing snapshot state
    const [hasOutdatedParams, setHasOutdatedParams] = useState(false);
    const [globalParams, setGlobalParams] = useState(null);
    const [newProductDisplayValue, setNewProductDisplayValue] = useState('0,00');
    const [newProductUploading, setNewProductUploading] = useState(false);
    const [newProductSaving, setNewProductSaving] = useState(false);
    const [manufacturers, setManufacturers] = useState([]);
    const newProductFileRef = useRef(null);
    const [showPrint, setShowPrint] = useState(false);
    const [printType, setPrintType] = useState('PROPOSAL'); // 'PROPOSAL' or 'MATERIALS'
    const [showPresentationModal, setShowPresentationModal] = useState(false);

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

    const fetchProducts = async () => {
        try {
            const res = await api.get('/products');
            setProducts(res.data.filter(p => p.status === 1));
        } catch { alert('Erro ao buscar produtos'); }
        finally { setLoading(false); }
    };

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
        } catch (e) {
            console.error("Erro ao carregar dados frescos da proposta", e);
            if (proposal.budget_data) {
                try {
                    const parsed = JSON.parse(proposal.budget_data);
                    setBudgetItems(parsed);
                    if (parsed.length > 0) setActiveItemId(parsed[0].id);
                } catch(err2) {}
            }
        }
    };

    useEffect(() => {
        fetchProducts();

        api.get('/payment-methods')
            .then(res => setPaymentMethods(res.data || []))
            .catch(() => {});

        api.get('/manufacturers')
            .then(res => setManufacturers(res.data || []))
            .catch(() => {});

        // Always fetch fresh settings on open and rebuild the pricing snapshot
        api.get('/settings')
            .then(res => {
                const fresh = res.data;
                const freshParams = {
                    commission:  parseFloat((proposal.referrer_commission || 0).toFixed(4)),
                    taxes:       parseFloat((fresh?.taxes       || 0).toFixed(4)),
                    financeCost: parseFloat((fresh?.financeCost || 0).toFixed(4)),
                    markup:      parseFloat((fresh?.markup      || 0).toFixed(4)),
                };
                
                let currentParams = freshParams;
                let snapshot = null;
                try {
                    if (proposal.pricing_snapshot) {
                        snapshot = JSON.parse(proposal.pricing_snapshot);
                    }
                } catch(e) {}
                
                if (snapshot && typeof snapshot === 'object') {
                    // check if they differ
                    const hasDiff = 
                        snapshot.taxes !== freshParams.taxes ||
                        snapshot.financeCost !== freshParams.financeCost ||
                        snapshot.markup !== freshParams.markup ||
                        snapshot.commission !== freshParams.commission;

                    if (hasDiff) {
                        setHasOutdatedParams(true);
                    }
                    currentParams = snapshot;
                }

                setGlobalParams(freshParams);
                setLiveSettings(fresh);
                setPricingSnapshot(currentParams);
                
                console.log('[BudgetModal] Parâmetros de precificação utilizados:', currentParams);
            })
            .catch(() => {
                // Fallback: use prop settings if API fails
                console.warn('[BudgetModal] Falha ao buscar settings, usando parâmetros do prop.');
            });

        loadProposalData();
        fetchGlobalAttachments();

        // If opened from Proposal Completion Modal, jump straight to print preview
        if (autoShowPrint) {
            if (autoShowPrint === 'PRESENTATION') {
                setShowPresentationModal(true);
            } else {
                setPrintType(typeof autoShowPrint === 'string' ? autoShowPrint : 'PROPOSAL');
                setShowPrint(true);
            }
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
        if (!newItemName.trim()) {
            setDivergences([{
                itemName: 'Novo Item',
                type: 'Campos Obrigatórios',
                message: 'Informe o nome do item antes de salvar.'
            }]);
            setShowDivergencesModal(true);
            return;
        }
        
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

    const suggestedEdgeBands = (() => {
        if (!activeItem) return [];
        
        // Pega todos os produtos do item ativo que são do grupo MDFs
        const mdfs = activeItem.products.filter(sp => sp.product.group_name === 'MDFs');
        
        if (mdfs.length === 0) return [];

        const baseNames = mdfs.map(sp => {
            let name = sp.product.name.toUpperCase();
            // Remove prefixos comuns
            name = name.replace(/^(MDF|CHAPA)\s*/, '').trim();
            // Remove espessuras do final (ex: 15mm, 15 mm, 18MM)
            name = name.replace(/\s*\d+\s*MM$/, '').trim();
            return name.toLowerCase();
        });

        return products.filter(p => {
            const isSelected = activeItem.products.some(sp => sp.product.id === p.id);
            if (isSelected) return false;

            // Só considera fitas
            if (p.group_name !== 'Fitas') return false;

            const nameLower = p.name.toLowerCase();
            return baseNames.some(base => base.length > 2 && nameLower.includes(base));
        });
    })();

    const availableProducts = products.filter(p => {
        if (!activeItem) return false;
        const isSelected = activeItem.products.some(sp => sp.product.id === p.id);
        if (isSelected) return false;
        
        // Filter by selected sequence group
        const pGroup = p.group_name || 'Outros';
        if (pGroup !== selectedGroup) return false;
        
        if (search) {
            if (!p.name.toLowerCase().includes(search.toLowerCase())) return false;
        }

        // Se o grupo selecionado for Fitas, filtra apenas as sugeridas
        if (selectedGroup === 'Fitas') {
            return suggestedEdgeBands.some(sugg => sugg.id === p.id);
        }

        return true;
    });

    const handleAddProduct = (product) => {
        if (!activeItem) return;
        const qty = parseFloat(quantityInput[product.id] || '1');
        if (isNaN(qty) || qty <= 0) {
            setDivergences([{
                itemName: activeItem.name || 'Orçamento',
                type: 'Quantidade Inválida',
                message: 'A quantidade informada para o produto é inválida ou menor/igual a zero.'
            }]);
            setShowDivergencesModal(true);
            return;
        }

        let unitValue = product.value || 0;
        if (customPriceInput[product.id] !== undefined) {
            unitValue = parseCurrency(customPriceInput[product.id]);
        }

        if (unitValue <= 0) {
            setDivergences([{
                itemName: activeItem.name || 'Orçamento',
                type: 'Preço Inválido',
                message: 'Não é permitido adicionar um produto que não tenha preço cadastrado.'
            }]);
            setShowDivergencesModal(true);
            return;
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
        // Use the active pricing snapshot, don't silently overwrite it with live settings
        const currentParams = activePricingParams;


        // Keep local proposal.value in sync so we don't spam API
        proposal.value = items.reduce((acc, item) => {
            const itemCost = item.products.reduce((acc2, p) => acc2 + p.total, 0);
            return acc + calculateSalePrice(itemCost, currentParams);
        }, 0);

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

    const checkDivergences = () => {
        const list = [];
        for (const item of budgetItems) {
            // 1. Check Service
            const hasService = item.products.some(p => p.product.group_name === 'Serviços');
            if (!hasService) {
                list.push({
                    itemName: item.name,
                    type: 'Serviço',
                    message: 'Falta custo de serviço. Este item não possui nenhum serviço/diária adicionado.'
                });
            }

            // 2. Check Product Prices
            item.products.forEach(sp => {
                const val = sp.product.value || 0;
                if (val <= 0) {
                    list.push({
                        itemName: item.name,
                        type: 'Preço Inválido',
                        message: `O produto "${sp.product.name}" não possui preço cadastrado.`
                    });
                }
            });
        }
        return list;
    };

    const handleSaveBudget = async () => {
        await persistBudget(budgetItems);
        onSave();
    };

    const handleClose = async () => {
        onSave(); // Refreshes parent list and closes
    };

    const handlePrint = () => {
        const oldTitle = document.title;
        const proposalNum = String(proposal.id).padStart(4, '0');
        const clientName = proposal.partner_name || '';
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
        
        if (printType === 'PRESENTATION') {
            document.title = `APRESENTACAO_${proposal.id}-${dateStr}_${clientName}`;
        } else if (printType === 'PROPOSAL') {
            document.title = `PROPOSTA_${proposal.id}-${dateStr}_${clientName}`;
        } else {
            document.title = `Lista Materiais ${proposalNum}`;
        }
        window.print();
        document.title = oldTitle;
    };

    const handleNewProductPhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setNewProductUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setNewProduct(p => ({ ...p, photo: res.data.url }));
        } catch { alert('Erro no upload da imagem.'); }
        finally { setNewProductUploading(false); }
    };

    const closeProductModal = () => {
        setShowProductModal(false);
        setEditingProduct(null);
        setNewProduct({ name: '', unit: 'UN', value: 0, manufacturer_id: '', photo: '', status: 1, group_name: 'Outros' });
        setNewProductDisplayValue('0,00');
    };

    const handleOpenEditProduct = (product) => {
        setEditingProduct(product);
        setNewProduct({
            name: product.name,
            unit: product.unit,
            value: product.value,
            manufacturer_id: product.manufacturer_id || '',
            photo: product.photo || '',
            status: product.status ?? 1,
            group_name: product.group_name || 'Outros',
        });
        setNewProductDisplayValue(maskCurrency(product.value));
        setShowProductModal(true);
    };

    const handleSaveNewProduct = async (e) => {
        e.preventDefault();
        if (!newProduct.name.trim()) return;
        setNewProductSaving(true);
        try {
            const payload = { ...newProduct, manufacturer_id: newProduct.manufacturer_id || null };
            if (editingProduct) {
                await api.put(`/products/${editingProduct.id}`, payload);
            } else {
                await api.post('/products', payload);
            }
            await fetchProducts();
            closeProductModal();
        } catch { alert(editingProduct ? 'Erro ao atualizar produto.' : 'Erro ao criar produto.'); }
        finally { setNewProductSaving(false); }
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
                

                
                {/* HEADER */}
                
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

                {/* CREATE PRODUCT MODAL — idêntico ao modal de Produtos e Serviços */}
                {showProductModal && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px' }}>
                        <div style={{ background: '#0f172a', border: '2.5px solid var(--primary)', borderRadius: '16px', width: '520px', maxWidth: '95%', boxShadow: '0 0 60px rgba(0,0,0,0.9)', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(99,102,241,0.1))', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Package size={20} /> {editingProduct ? 'Editar Produto / Serviço' : 'Novo Produto / Serviço'}
                                </h3>
                                <button onClick={closeProductModal} className="btn-icon"><X size={18} /></button>
                            </div>

                            <form onSubmit={handleSaveNewProduct} style={{ padding: '1.5rem' }}>
                                {/* Photo + Name + Unit */}
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '1.25rem' }}>
                                    {/* Photo upload */}
                                    <div
                                        onClick={() => newProductFileRef.current?.click()}
                                        style={{ width: '110px', height: '110px', border: '2px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.02)', transition: 'border-color 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                    >
                                        {newProductUploading ? (
                                            <Loader2 size={28} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                                        ) : newProduct.photo ? (
                                            <img src={newProduct.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Foto" />
                                        ) : (
                                            <>
                                                <Upload size={24} style={{ color: 'var(--text-muted)' }} />
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>Upload Foto</span>
                                            </>
                                        )}
                                        <input type="file" ref={newProductFileRef} hidden onChange={handleNewProductPhotoUpload} accept="image/*" />
                                    </div>

                                    {/* Name + Unit */}
                                    <div style={{ flex: 1 }}>
                                        <label>Nome *</label>
                                        <input required value={newProduct.name} onChange={e => {
                                            const val = e.target.value;
                                            const predicted = predictGroup(val, newProduct.unit);
                                            setNewProduct(p => ({ ...p, name: val, group_name: predicted }));
                                        }} placeholder="Ex: Dobradiça Blum 110°" style={{ marginBottom: '12px' }} />
                                        <label>Unidade</label>
                                        <select value={newProduct.unit} onChange={e => {
                                            const val = e.target.value;
                                            const predicted = predictGroup(newProduct.name, val);
                                            setNewProduct(p => ({ ...p, unit: val, group_name: predicted }));
                                        }}>
                                            {[['CHP','Chapa'],['UN','Unidade'],['M','Metro'],['M2','Metro²'],['L','Litro'],['CXA','Caixa'],['PAR','Par'],['H','Hora'],['DIA','Dia'],['PC','Peça'],['DF','Diária fábrica'],['DM','Diária montagem']].map(([k,v]) => (
                                                <option key={k} value={k}>{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Value + Manufacturer */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label>Valor Unitário (R$)</label>
                                        <input
                                            type="text"
                                            value={newProductDisplayValue}
                                            onChange={e => {
                                                const fmt = maskCurrency(e.target.value);
                                                setNewProductDisplayValue(fmt);
                                                setNewProduct(p => ({ ...p, value: parseCurrency(fmt) }));
                                            }}
                                            style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label>Fabricante</label>
                                        <select value={newProduct.manufacturer_id} onChange={e => setNewProduct(p => ({ ...p, manufacturer_id: e.target.value }))}>
                                            <option value="">Nenhum</option>
                                            {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Group Selection */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                    <div>
                                        <label>Grupo / Categoria *</label>
                                        <select value={newProduct.group_name} onChange={e => setNewProduct(p => ({ ...p, group_name: e.target.value }))}>
                                            {['MDFs', 'Fitas', 'Químicos', 'Ferragens', 'Componentes', 'Vidros', 'Outros', 'Serviços'].map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div></div>
                                </div>

                                {/* Status — toggle switch */}
                                <div
                                    onClick={() => setNewProduct(p => ({ ...p, status: p.status === 1 ? 0 : 1 }))}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', padding: '12px 16px', background: newProduct.status === 1 ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: '10px', border: `1px solid ${newProduct.status === 1 ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.25s', userSelect: 'none' }}
                                >
                                    <div>
                                        <div style={{ fontWeight: '700', fontSize: '0.88rem', color: newProduct.status === 1 ? '#10b981' : 'var(--text-muted)' }}>
                                            Ativado no Catálogo
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {newProduct.status === 1 ? 'Produto visível e disponível para orçamentos' : 'Produto oculto do catálogo'}
                                        </div>
                                    </div>
                                    {/* Toggle pill */}
                                    <div style={{ position: 'relative', width: '44px', height: '24px', borderRadius: '12px', background: newProduct.status === 1 ? '#10b981' : 'rgba(255,255,255,0.15)', transition: 'background 0.25s', flexShrink: 0 }}>
                                        <div style={{ position: 'absolute', top: '3px', left: newProduct.status === 1 ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)', transition: 'left 0.25s' }} />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="button" onClick={closeProductModal} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                                    <button type="submit" className="btn-premium" disabled={newProductSaving || newProductUploading} style={{ flex: 1 }}>
                                        {newProductSaving ? 'Salvando...' : editingProduct ? 'Salvar Alterações' : 'Salvar no Catálogo'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* DIVERGENCES WARNING MODAL */}
                {showDivergencesModal && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300000, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px' }}>
                        <div style={{ background: '#0f172a', border: '2.5px solid #ef4444', padding: '2rem', borderRadius: '16px', width: '650px', maxWidth: '95%', boxShadow: '0 0 50px rgba(239,68,68,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                <AlertCircle size={32} color="#ef4444" />
                                <h3 style={{ margin: 0, color: '#ef4444', fontSize: '1.4rem' }}>
                                    Divergências no Orçamento
                                </h3>
                            </div>
                            
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                Os seguintes itens estão em desacordo com as regras comerciais do ERP. Por favor, corrija-os antes de gerar a proposta:
                            </p>

                            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', padding: '15px', maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                                {divergences.map((div, index) => (
                                    <div key={index} style={{ borderBottom: index < divergences.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: '12px', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.95rem' }}>
                                                {div.itemName}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                {div.type}
                                            </span>
                                        </div>
                                        <div style={{ color: 'var(--text)', fontSize: '0.85rem', paddingLeft: '8px', borderLeft: '2px solid #ef4444' }}>
                                            {div.message}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button 
                                    onClick={() => setShowDivergencesModal(false)} 
                                    className="btn-premium" 
                                    style={{ padding: '10px 24px', background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                                >
                                    Voltar e Corrigir
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            Orçamento
                            <button onClick={handleOpenCreateModal} title="Adicionar Item/Ambiente" style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', marginLeft: '50px' }}>
                                <PackagePlus size={16} /> Novo Item/Ambiente
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
                                paddingBottom: '1px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                Total: {maskCurrency(budgetTotal)}
                                {hasOutdatedParams && <AlertCircle size={18} color="#eab308" title="Parâmetros de preço desatualizados. Abra a formação de preço para atualizar." />}
                                {isAdm && <span style={{ fontSize: '0.6rem', color: '#64748b', verticalAlign: 'middle' }}>ADM ▸</span>}
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
                                        <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>📐 Formação de Preço</div>
                                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Parâmetros do cálculo desta proposta</div>
                                            </div>
                                            {hasOutdatedParams && (
                                                <button onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm("Isso irá recalcular os preços de todos os itens do orçamento para os parâmetros atuais da empresa. Deseja continuar?")) {
                                                        setPricingSnapshot(globalParams);
                                                        setHasOutdatedParams(false);
                                                        
                                                        try {
                                                            const itemsToSave = [...budgetItems];
                                                            let totalFab = 0; let totalAss = 0;
                                                            itemsToSave.forEach(item => {
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
                                                            const totalValue = itemsToSave.reduce((acc, item) => {
                                                                const itemCost = item.products.reduce((acc2, p) => acc2 + p.total, 0);
                                                                const comm = globalParams.commission / 100;
                                                                const taxes = globalParams.taxes / 100;
                                                                const financeCost = globalParams.financeCost / 100;
                                                                const markup = globalParams.markup / 100;
                                                                const denominator = 1 - (comm + taxes + financeCost + markup);
                                                                return acc + (denominator <= 0 ? itemCost : itemCost / denominator);
                                                            }, 0);
                                                            
                                                            await api.put(`/proposals/${proposal.id}`, {
                                                                budget_data: JSON.stringify(itemsToSave),
                                                                pricing_snapshot: JSON.stringify(globalParams),
                                                                value: totalValue,
                                                                fabrication_days: totalFab,
                                                                assembly_days: totalAss
                                                            });
                                                            proposal.value = totalValue;
                                                        } catch (err) {
                                                            console.error('Failed to update pricing snapshot:', err);
                                                        }
                                                    }
                                                }} style={{ background: '#eab308', color: '#000', padding: '6px', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Atualizar Preços">
                                                    <AlertCircle size={18} />
                                                </button>
                                            )}
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
                    
                    {/* LEFT COLUMN: AVAILABLE PRODUCTS */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h4 style={{ color: 'var(--primary)', margin: 0 }}>Produtos/Serviços Disponíveis</h4>
                            <button onClick={() => setShowProductModal(true)} title="Novo Produto" style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <PlusCircle size={20} />
                            </button>
                        </div>
                        
                        {/* Sequence filter bar */}
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            marginBottom: '15px', 
                            background: 'rgba(255,255,255,0.02)', 
                            padding: '8px 10px', 
                            borderRadius: '12px', 
                            border: '1.5px solid var(--border)',
                            overflowX: 'auto',
                            gap: '4px'
                        }}>
                            {GROUP_SEQUENCE.map((group, idx) => {
                                const Icon = group.icon;
                                const isActive = selectedGroup === group.key;
                                return (
                                    <React.Fragment key={group.key}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedGroup(group.key);
                                                setSearch('');
                                            }}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '4px',
                                                background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                                border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                                                borderRadius: '8px',
                                                padding: '6px 8px',
                                                cursor: 'pointer',
                                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                                transition: 'all 0.2s',
                                                flex: 1,
                                                minWidth: '55px',
                                                outline: 'none'
                                            }}
                                            title={group.label}
                                        >
                                            <Icon size={18} />
                                            <span style={{ fontSize: '0.65rem', fontWeight: isActive ? '700' : '500', whiteSpace: 'nowrap' }}>{group.label}</span>
                                        </button>
                                        {idx < GROUP_SEQUENCE.length - 1 && (
                                            <span style={{ color: 'rgba(255,255,255,0.08)', fontSize: '0.75rem', userSelect: 'none' }}>➔</span>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        <div style={{ position: 'relative', marginBottom: '10px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input placeholder="Buscar produto..." style={{ paddingLeft: '38px', marginBottom: 0 }} value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                            {loading ? (
                                <p style={{padding: '10px', textAlign: 'center'}}>Carregando...</p>
                            ) : !activeItem ? (
                                <p style={{padding: '10px', textAlign: 'center', color:'var(--text-muted)'}}>Selecione um item acima</p>
                            ) : (
                                <>
                                    {selectedGroup === 'Fitas' && suggestedEdgeBands.length > 0 && (
                                        <div style={{ background: 'rgba(167,139,250,0.06)', borderBottom: '1.5px solid rgba(167,139,250,0.2)', padding: '10px 12px', marginBottom: '8px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#a78bfa', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span>✨ Fitas de Borda Recomendadas</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {suggestedEdgeBands.map(p => {
                                                    const currentPriceStr = customPriceInput[p.id] !== undefined ? customPriceInput[p.id] : maskCurrency(p.value);
                                                    return (
                                                        <div key={`sug-${p.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                                    {p.photo ? (
                                                                        <img src={p.photo} alt={p.name} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                                                                    ) : (
                                                                        <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'rgba(167,139,250,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                            <Package size={12} color="#a78bfa" />
                                                                        </div>
                                                                    )}
                                                                    <div style={{ fontWeight: '600', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                                                </div>
                                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '32px' }}>
                                                                    {editingPriceId === p.id ? (
                                                                        <input 
                                                                            type="text" 
                                                                            value={currentPriceStr}
                                                                            onChange={e => setCustomPriceInput({...customPriceInput, [p.id]: maskCurrency(e.target.value)})}
                                                                            onBlur={() => setEditingPriceId(null)}
                                                                            onKeyDown={e => e.key === 'Enter' && setEditingPriceId(null)}
                                                                            autoFocus
                                                                            style={{ width: '80px', padding: '2px 4px', fontSize: '0.70rem', marginBottom: 0 }}
                                                                        />
                                                                    ) : (
                                                                        <div 
                                                                            className="editable-field"
                                                                            onClick={() => setEditingPriceId(p.id)} 
                                                                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                        >
                                                                            {currentPriceStr}
                                                                            <Pencil size={8} />
                                                                        </div>
                                                                    )}
                                                                    <span>/ {p.unit}</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                <input 
                                                                    type="number" 
                                                                    min="0.1" 
                                                                    step="any"
                                                                    placeholder="Qtd" 
                                                                    value={quantityInput[p.id] || ''}
                                                                    onChange={e => setQuantityInput({...quantityInput, [p.id]: e.target.value})}
                                                                    style={{ width: '50px', padding: '2px 4px', marginBottom: 0, fontSize: '0.75rem', height: '26px' }}
                                                                />
                                                                <button onClick={() => handleAddProduct(p)} style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', height: '26px', display: 'flex', alignItems: 'center' }}>
                                                                    <Plus size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {availableProducts.length === 0 ? (
                                        <p style={{padding: '20px', textAlign: 'center', color:'var(--text-muted)', fontSize:'0.85rem'}}>
                                            Nenhum produto cadastrado no grupo "{GROUP_SEQUENCE.find(g => g.key === selectedGroup)?.label || selectedGroup}"{search ? ` correspondente a "${search}"` : ''}.
                                        </p>
                                    ) : (
                                        availableProducts.map(p => {
                                const currentPriceStr = customPriceInput[p.id] !== undefined ? customPriceInput[p.id] : maskCurrency(p.value);
                                return (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Name row with photo thumbnail */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            {p.photo ? (
                                                <img src={p.photo} alt={p.name} style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                                            ) : (
                                                <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <Package size={14} color="var(--primary)" />
                                                </div>
                                            )}
                                            <div style={{ fontWeight: '600', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '38px' }}>
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
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                        {/* Edit product button */}
                                        <button
                                            title="Editar produto"
                                            onClick={() => handleOpenEditProduct(p)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                        >
                                            <Pencil size={14} />
                                        </button>
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
                            )}
                                </>
                            )}
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
                             [...activeItem.products].sort((a, b) => a.product.name.localeCompare(b.product.name)).map(sp => (
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
                            const divs = checkDivergences();
                            if (divs.length > 0) {
                                setDivergences(divs);
                                setShowDivergencesModal(true);
                            } else {
                                setPrintType('PROPOSAL'); 
                                setShowPrint(true); 
                            }
                        }} 
                        style={{ padding: '10px 20px', borderRadius: '8px', border: '2px solid #eab308', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', cursor: 'pointer', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        Gerar Proposta <LayoutGrid size={18} />
                    </button>
                    <button 
                        onClick={() => setShowPresentationModal(true)} 
                        style={{ padding: '10px 20px', borderRadius: '8px', border: '2px solid #10b981', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', cursor: 'pointer', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        Apresentação <Image size={18} />
                    </button>
                    <button onClick={() => { setPrintType('MATERIALS'); setShowPrint(true); }} style={{ padding: '10px 20px', borderRadius: '8px', border: '2px solid #6366f1', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', cursor: 'pointer', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Lista de Materiais <ClipboardList size={18} />
                    </button>
                    <button onClick={handleClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: '600' }}>Fechar / Cancelar</button>
                </div>

                {/* PRINT PREVIEW OVERLAY */}
                {showPrint && createPortal(
                    <div className="print-overlay-container" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#fff', color: '#000', zIndex: 20000, overflowY: 'auto', padding: '40px' }}>
                        <style>{`
                            @media print {
                                #root, .modal-overlay {
                                    display: none !important;
                                }
                                body {
                                    margin: 0;
                                    background: white !important;
                                    overflow: visible !important;
                                }
                                .print-overlay-container {
                                    position: static !important;
                                    width: 100% !important;
                                    height: auto !important;
                                    overflow: visible !important;
                                    padding: 0 !important;
                                    background: white !important;
                                    color: #000 !important;
                                }
                                .no-print { display: none !important; }
                                .print-container {
                                    padding: 0 !important;
                                    width: 100% !important;
                                    max-width: 100% !important;
                                    margin: 0 !important;
                                }
                                ${printType === 'PRESENTATION' ? `
                                @page {
                                    size: landscape;
                                    margin: 0;
                                }
                                body {
                                    -webkit-print-color-adjust: exact;
                                    print-color-adjust: exact;
                                }
                                .presentation-slide {
                                    height: 100vh !important;
                                    max-height: 100vh !important;
                                    page-break-after: always !important;
                                    break-after: page !important;
                                    box-sizing: border-box !important;
                                    margin: 0 !important;
                                    border: none !important;
                                    box-shadow: none !important;
                                    background: #ffffff !important;
                                }
                                .presentation-slide-body {
                                    display: flex !important;
                                    flex-direction: row !important;
                                    gap: 40px !important;
                                    flex: 1 !important;
                                    margin: 20px 0 !important;
                                    min-height: 0 !important;
                                }
                                .presentation-slide-image-box {
                                    height: calc(100vh - 170px) !important;
                                    max-height: calc(100vh - 170px) !important;
                                    display: flex !important;
                                    justify-content: center !important;
                                    align-items: center !important;
                                    overflow: hidden !important;
                                }
                                .presentation-slide-image {
                                    max-width: 100% !important;
                                    max-height: 100% !important;
                                    width: auto !important;
                                    height: auto !important;
                                    object-fit: contain !important;
                                }
                                ` : ''}
                            }
                        `}</style>
                        
                        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 'bold', color: '#1e293b' }}>Visualização de Impressão</div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={handlePrint} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    {printType === 'PRESENTATION' ? 'Salvar Apresentação (PDF)' : 'Imprimir Agora'}
                                </button>
                                <button onClick={() => autoShowPrint ? onClose() : setShowPrint(false)} style={{ background: '#64748b', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Fechar</button>
                            </div>
                        </div>

                        <div className="print-container" style={{ maxWidth: printType === 'PRESENTATION' ? '100%' : '850px', margin: '0 auto', fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#1e293b' }}>
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
                                                <User size={14} /> <strong>Responsável:</strong> {user?.name || 'Não identificado'}{user?.phone ? ` - ${maskPhone(user.phone)}` : ''}
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
                                                            <th style={{ padding: '10px', fontSize: '11px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', width: '52px' }}>FOTO</th>
                                                            <th style={{ padding: '10px', fontSize: '11px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>DESCRIÇÃO</th>
                                                            <th style={{ padding: '10px', fontSize: '11px', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>QTD</th>
                                                            <th style={{ padding: '10px', fontSize: '11px', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>CUSTO UN.</th>
                                                            <th style={{ padding: '10px', fontSize: '11px', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>TOTAL</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {materials.length > 0 && (
                                                            <>
                                                                <tr style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '5px 10px', fontSize: '10px', fontWeight: '900', color: '#6366f1' }}>MATERIAIS</td></tr>
                                                                {GROUP_SEQUENCE.filter(g => g.key !== 'Serviços').map(group => {
                                                                    const groupMaterials = materials.filter(sp => (sp.product.group_name || 'Outros') === group.key);
                                                                    if (groupMaterials.length === 0) return null;
                                                                    return (
                                                                        <React.Fragment key={group.key}>
                                                                            <tr style={{ background: '#f1f5f9' }}><td colSpan="5" style={{ padding: '5px 10px', fontSize: '9px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>{group.label}</td></tr>
                                                                            {groupMaterials.map((sp, idx) => (
                                                                                <tr key={`mat-${group.key}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                                    <td style={{ padding: '6px 8px', textAlign: 'center', width: '52px' }}>
                                                                                        {sp.product.photo ? (
                                                                                            <img
                                                                                                src={sp.product.photo}
                                                                                                alt={sp.product.name}
                                                                                                style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'block', margin: '0 auto' }}
                                                                                            />
                                                                                        ) : (
                                                                                            <div style={{ width: '38px', height: '38px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                                                                                <span style={{ fontSize: '18px', color: '#94a3b8' }}>📦</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 10px', fontSize: '12px' }}>{sp.product.name}</td>
                                                                                    <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'center' }}>{sp.quantity} {sp.product.unit}</td>
                                                                                    <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right' }}>{maskCurrency(sp.product.value)}</td>
                                                                                    <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right' }}>{maskCurrency(sp.total)}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </React.Fragment>
                                                                    );
                                                                })}
                                                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                                                    <td colSpan="4" style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Subtotal Materiais:</td>
                                                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '12px', fontWeight: '800' }}>{maskCurrency(subTotalMaterial)}</td>
                                                                </tr>
                                                            </>
                                                        )}
                                                        {services.length > 0 && (
                                                            <>
                                                                <tr style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '5px 10px', fontSize: '10px', fontWeight: '900', color: '#6366f1' }}>SERVIÇOS</td></tr>
                                                                {services.map((sp, idx) => (
                                                                    <tr key={`ser-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                        <td style={{ padding: '6px 8px', textAlign: 'center', width: '52px' }}>
                                                                            {sp.product.photo ? (
                                                                                <img
                                                                                    src={sp.product.photo}
                                                                                    alt={sp.product.name}
                                                                                    style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'block', margin: '0 auto' }}
                                                                                />
                                                                            ) : (
                                                                                <div style={{ width: '38px', height: '38px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                                                                    <span style={{ fontSize: '18px', color: '#94a3b8' }}>⚙️</span>
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px' }}>{sp.product.name}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'center' }}>{sp.quantity} {sp.product.unit}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right' }}>{maskCurrency(sp.product.value)}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right' }}>{maskCurrency(sp.total)}</td>
                                                                    </tr>
                                                                ))}
                                                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                                                    <td colSpan="4" style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Subtotal Serviços:</td>
                                                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '12px', fontWeight: '800' }}>{maskCurrency(subTotalService)}</td>
                                                                </tr>
                                                            </>
                                                        )}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr style={{ background: '#f8fafc' }}>
                                                            <td colSpan="4" style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold' }}>CUSTO TOTAL DO AMBIENTE:</td>
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
                            ) : printType === 'PRESENTATION' ? (
                                <>
                                    {/* SLIDE 1: COVER PAGE */}
                                    <div className="presentation-slide" style={{
                                        height: '100vh',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        padding: '60px 80px',
                                        boxSizing: 'border-box',
                                        pageBreakAfter: 'always',
                                        background: '#fafbfc',
                                        fontFamily: "'Inter', sans-serif",
                                        position: 'relative',
                                        border: '1px solid #e2e8f0',
                                        gap: '60px'
                                    }}>
                                        {/* Thin Elegant Top Accent Line */}
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '4px',
                                            background: '#10b981'
                                        }} />
                                        
                                        {/* Cover Header (Logo) */}
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '60px' }}>
                                            {liveSettings?.tenant?.logo_url || user?.logo_url ? (
                                                <img 
                                                    src={liveSettings?.tenant?.logo_url || user?.logo_url} 
                                                    alt="Logo" 
                                                    style={{ maxHeight: '112px', maxWidth: '336px', objectFit: 'contain' }} 
                                                />
                                            ) : (
                                                <div style={{ fontSize: '30px', fontWeight: '300', color: '#10b981', letterSpacing: '4px', textTransform: 'uppercase' }}>
                                                    {liveSettings?.tenant?.name || 'ERP MÓVEIS'}
                                                </div>
                                            )}
                                        </div>

                                        {/* Cover Body (Client Name & Subtitles) */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' }}>
                                            <div style={{ fontSize: '30px', fontWeight: '800', color: '#10b981', letterSpacing: '3px', textTransform: 'uppercase' }}>
                                                APRESENTAÇÃO DE PROJETO
                                            </div>
                                            <h1 style={{ fontSize: '50px', fontWeight: '300', margin: 0, color: '#1e293b', lineHeight: '1.2' }}>
                                                {proposal.partner_name}
                                            </h1>
                                            <div style={{ height: '1px', width: '120px', background: '#cbd5e1', margin: '15px 0' }} />
                                            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
                                                {(() => {
                                                    const now = new Date();
                                                    const dStr = now.toLocaleDateString('pt-BR');
                                                    const tStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                                    return `${dStr} | ${tStr}`;
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* SLIDES 2 to N: ENVIRONMENT IMAGES */}
                                    {(() => {
                                        const isImageAtt = (a) =>
                                            (a.type && a.type.includes('image')) ||
                                            /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(a.url || a.name || '');

                                        const allImageSlides = [];
                                        budgetItems.forEach(item => {
                                            const atts = Array.isArray(item.attachments) ? item.attachments : [];
                                            const images = atts.filter(isImageAtt);
                                            images.forEach((img, idx) => {
                                                allImageSlides.push({
                                                    item,
                                                    img,
                                                    index: idx + 1,
                                                    total: images.length
                                                });
                                            });
                                        });

                                        if (allImageSlides.length === 0) {
                                            return (
                                                <div style={{
                                                    height: '100vh',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    padding: '60px',
                                                    boxSizing: 'border-box',
                                                    background: '#ffffff',
                                                    fontFamily: "'Inter', sans-serif",
                                                    border: '1px solid #e2e8f0',
                                                    pageBreakAfter: 'always'
                                                }}>
                                                    <span style={{ fontSize: '48px', marginBottom: '20px' }}>🖼️</span>
                                                    <h3 style={{ margin: '0 0 10px', color: '#475569' }}>Sem imagens anexadas</h3>
                                                    <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>
                                                        Para gerar a apresentação, adicione fotos ou projetos aos ambientes no orçamento.
                                                    </p>
                                                </div>
                                            );
                                        }

                                        return allImageSlides.map(({ item, img, index, total }, idx) => (
                                            <div key={`${item.id}-img-${idx}`} className="presentation-slide" style={{
                                                height: '100vh',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                padding: '40px 60px',
                                                boxSizing: 'border-box',
                                                pageBreakAfter: 'always',
                                                background: '#ffffff',
                                                fontFamily: "'Inter', sans-serif",
                                                border: '1px solid #e2e8f0'
                                            }}>
                                                {/* Slide Body: info on left, image on right */}
                                                <div className="presentation-slide-body" style={{ display: 'flex', gap: '40px', flex: 1, margin: '20px 0', minHeight: 0, position: 'relative' }}>
                                                    {/* Left Column: Info */}
                                                    <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left', borderRight: '1px solid #f1f5f9', paddingRight: '20px', paddingTop: '10px' }}>
                                                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#10b981', letterSpacing: '2px', textTransform: 'uppercase' }}>
                                                            {item.name}
                                                        </div>
                                                        {item.description && (
                                                            <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                                                {item.description}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right Column: Image Box */}
                                                    <div className="presentation-slide-image-box" style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        overflow: 'hidden',
                                                        position: 'relative'
                                                    }}>
                                                        <img 
                                                            className="presentation-slide-image"
                                                            src={img.url} 
                                                            alt={`${item.name} - ${index}`} 
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                maxHeight: 'calc(100vh - 170px)',
                                                                objectFit: 'contain',
                                                                borderRadius: '6px',
                                                                background: '#f8fafc',
                                                                border: '1px solid #f1f5f9'
                                                            }} 
                                                        />
                                                    </div>
                                                </div>

                                                {/* Slide Footer */}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', fontSize: '11px', color: '#94a3b8' }}>
                                                    <span>
                                                        Página {idx + 2}
                                                    </span>
                                                </div>
                                            </div>
                                        ));
                                    })()}

                                    {/* FINAL SLIDE: THANK YOU & CONTACTS */}
                                    <div className="presentation-slide" style={{
                                        height: '100vh',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        padding: '60px 80px',
                                        boxSizing: 'border-box',
                                        background: '#fafbfc',
                                        fontFamily: "'Inter', sans-serif",
                                        position: 'relative',
                                        border: '1px solid #e2e8f0',
                                        gap: '40px'
                                    }}>
                                        {/* Middle Thank You */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', textAlign: 'center' }}>
                                            <h1 style={{ fontSize: '36px', fontWeight: '300', color: '#1e293b', margin: 0, letterSpacing: '4px', textTransform: 'uppercase' }}>
                                                Agradecemos a Parceria!
                                            </h1>
                                            <div style={{ height: '2px', width: '60px', background: '#10b981', margin: '5px 0' }} />
                                            <p style={{ fontSize: '16px', color: '#64748b', fontWeight: '400', margin: 0, maxWidth: '500px', lineHeight: '1.5' }}>
                                                Estamos comprometidos em transformar seu espaço com o máximo de excelência, sofisticação e cuidado.
                                            </p>
                                        </div>

                                        {/* Center-aligned Contacts - 2 lines below the thank you details */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '30px', maxWidth: '600px', width: '100%' }}>
                                            {/* Responsible contact centered */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', textAlign: 'center' }}>
                                                <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' }}>CONTATO DO RESPONSÁVEL</div>
                                                <div style={{ fontSize: '15px', fontWeight: '700', color: '#334155' }}>{user?.name || 'Não identificado'}</div>
                                                <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {user?.phone ? (
                                                        <div>📞 {maskPhone(user.phone)}</div>
                                                    ) : liveSettings?.tenant?.phone ? (
                                                        <div>📞 {maskPhone(liveSettings.tenant.phone)}</div>
                                                    ) : (
                                                        <div>Contato não informado</div>
                                                    )}
                                                    <div>✉️ {user?.email}</div>
                                                </div>
                                            </div>

                                            {/* Company site and Instagram below */}
                                            {(liveSettings?.tenant?.website || liveSettings?.tenant?.instagram) && (
                                                <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '15px', width: '100%', justifyContent: 'center' }}>
                                                    {liveSettings?.tenant?.website && <div>🌐 {liveSettings.tenant.website}</div>}
                                                    {liveSettings?.tenant?.instagram && <div>📸 {liveSettings.tenant.instagram}</div>}
                                                </div>
                                            )}
                                        </div>
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
                                                <User size={14} /> <strong>Responsável:</strong> {user?.name || 'Não identificado'}{user?.phone ? ` - ${maskPhone(user.phone)}` : ''}
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
                                                                    {/* Anexos do Item (Apenas Documentos/Arquivos - Sem Fotos) */}
                                                                    {(() => {
                                                                        const nonImageAtts = (item.attachments || []).filter(att => {
                                                                            const isImage = att.type?.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url || '');
                                                                            return !isImage;
                                                                        });
                                                                        if (nonImageAtts.length === 0) return null;

                                                                        return (
                                                                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                                                                                {nonImageAtts.map((att, iidx) => (
                                                                                    <div 
                                                                                        key={iidx} 
                                                                                        onClick={() => window.open(att.url, '_blank')}
                                                                                        style={{ width: '36px', height: '36px', borderRadius: '4px', border: '1px solid #e2e8f0', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.02)' }}
                                                                                        title={att.name}
                                                                                    >
                                                                                        <Paperclip size={16} color="var(--primary)" />
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                    
                                                                    {/* Materiais e Acessórios (MDF, Ferragens, Vidros) */}
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
                                                                            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px', marginTop: '15px' }}>
                                                                                <div style={{ fontSize: '10px', fontWeight: '800', color: '#6366f1', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                                                    Materiais e Acessórios Utilizados:
                                                                                </div>
                                                                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                                                    {displayProducts.map((hp, hIdx) => (
                                                                                        <div key={hIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                            <img 
                                                                                                src={hp.product.photo} 
                                                                                                alt={hp.product.name} 
                                                                                                title={hp.product.name}
                                                                                                style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }} 
                                                                                            />
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
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
                                                        return activeMethod.conditions.map((cond, idx) => {
                                                            const total        = budgetTotal;
                                                            const installments = cond.installments !== undefined ? Number(cond.installments) : 1;
                                                            const isAVista     = installments === 0;

                                                            const totalDiscountPct    = cond.discount_percentage || 0;

                                                            const discountedTotal  = total * (1 - totalDiscountPct / 100);
                                                            const financedTotal    = discountedTotal * (1 + (cond.finance_cost_percentage || 0) / 100);
                                                            const downPct          = cond.down_payment_percentage || 0;
                                                            const downValue        = financedTotal * (downPct / 100);
                                                            const remaining        = financedTotal - downValue;
                                                            const installAmt       = installments > 0
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
                                                                        Opção {idx + 1}{cond.title ? ` - ${cond.title}` : ''}
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
                                                                        const discPct = cond.discount_percentage || 0;
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
                                            <div style={{ textAlign: 'right', borderRight: '1px solid #cbd5e1', paddingRight: '30px', display: 'flex', alignItems: 'center' }}>
                                                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 'bold' }}>
                                                    Prazo de entrega: <span style={{ color: '#10b981' }}>Em até 30 dias úteis</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600' }}>VALOR TOTAL DO INVESTIMENTO</div>
                                                <div style={{ fontSize: '32px', fontWeight: '900', color: '#10b981' }}>{maskCurrency(budgetTotal)}</div>
                                            </div>
                                        </div>
                                        
                                        <div style={{ marginTop: '24px', textAlign: 'center' }}>
                                            <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: '600' }}>Validade da proposta: 10 dias corridos.</span>
                                        </div>

                                        <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center', marginTop: '24px' }}>
                                            <div style={{ borderBottom: '1px solid #94a3b8', margin: '30px 40px 10px' }}></div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>Aceite do Cliente</div>
                                        </div>
                                        
                                        {(() => {
                                            const isImageAtt = (a) =>
                                                (a.type && a.type.includes('image')) ||
                                                /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(a.url || a.name || '');

                                            const itemsWithImages = budgetItems.filter(item => {
                                                const atts = Array.isArray(item.attachments) ? item.attachments : [];
                                                return atts.some(isImageAtt);
                                            });

                                            return (
                                                <>
                                                    <div style={{ marginTop: '40px', fontSize: '11px', color: '#94a3b8', textAlign: 'center', pageBreakAfter: itemsWithImages.length > 0 ? 'always' : 'auto' }}>
                                                        Documento gerado eletronicamente em {new Date().toLocaleString('pt-BR')} por {user?.name}.
                                                    </div>

                                                    {itemsWithImages.length > 0 && (
                                                        <div style={{ marginTop: '40px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px' }}>
                                                                <div style={{ height: '3px', flex: 1, background: 'linear-gradient(90deg, #6366f1, transparent)' }} />
                                                                <div style={{ fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6366f1', whiteSpace: 'nowrap' }}>
                                                                    IMAGENS DO PROJETO
                                                                </div>
                                                                <div style={{ height: '3px', flex: 1, background: 'linear-gradient(270deg, #6366f1, transparent)' }} />
                                                            </div>
                                                            
                                                            {itemsWithImages.map(item => {
                                                                const atts = Array.isArray(item.attachments) ? item.attachments : [];
                                                                const images = atts.filter(isImageAtt);
                                                                
                                                                return (
                                                                    <div key={item.id} style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
                                                                        <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px', marginBottom: '16px', textTransform: 'uppercase' }}>
                                                                            {item.name}
                                                                        </h3>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                                            {images.map((img, idx) => (
                                                                                <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', background: '#f8fafc', pageBreakInside: 'avoid' }}>
                                                                                    <img 
                                                                                        src={img.url} 
                                                                                        alt={`${item.name} - ${idx}`} 
                                                                                        style={{ width: '100%', maxHeight: '600px', objectFit: 'contain', borderRadius: '8px' }} 
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}

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
                                </>
                            )}
                        </div>
                    </div>,
                    document.body
                )}
                {showPresentationModal && (
                    <BuildPresentationModal
                        proposal={proposal}
                        user={user}
                        onClose={() => {
                            setShowPresentationModal(false);
                            loadProposalData();
                        }}
                    />
                )}
            </div>
        </div>,
        document.body
    );
};

export default BudgetModal;
