import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { 
    X, ChevronUp, ChevronDown, Plus, Trash2, Image, Printer, Loader2, 
    Paperclip, Settings, Eye, Check, AlertCircle, Upload, EyeOff, LayoutGrid, FileText, Share2, Copy, History 
} from 'lucide-react';
import { maskPhone } from '../utils/masks';

const BuildPresentationModal = ({ proposal, user, onClose }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeAnnotationId, setActiveAnnotationId] = useState(null);
    const [uploadingItem, setUploadingItem] = useState(null);
    const [showDivergencesModal, setShowDivergencesModal] = useState(false);
    const [divergences, setDivergences] = useState([]);
    const [liveSettings, setLiveSettings] = useState(null);
    
    // Cover Slide States
    const [coverTitle, setCoverTitle] = useState('APRESENTAÇÃO DE PROJETO');
    const [coverSubtitle, setCoverSubtitle] = useState(proposal?.partner_name || '');
    const [showLogo, setShowLogo] = useState(true);
    const [showDate, setShowDate] = useState(true);

    // Closing Slide States
    const [closingTitle, setClosingTitle] = useState('Agradecemos a Parceria!');
    const [closingText, setClosingText] = useState('Estamos comprometidos em transformar seu espaço com o máximo de excelência, sofisticação e cuidado.');
    const [showContacts, setShowContacts] = useState(true);
    const [contactName, setContactName] = useState(user?.name || '');
    const [contactPhone, setContactPhone] = useState(user?.phone || '');
    const [contactEmail, setContactEmail] = useState(user?.email || '');
    const [contactWebsite, setContactWebsite] = useState('');
    const [contactInstagram, setContactInstagram] = useState('');

    // Preview state
    const [showPrint, setShowPrint] = useState(false);

    // Mini-modal for creating a new item/environment
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemDescription, setNewItemDescription] = useState('');
    const [newItemAttachments, setNewItemAttachments] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    // Publish state
    const [publishData, setPublishData] = useState(null);
    const [publishHistory, setPublishHistory] = useState([]);
    const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(true);
    const [isPublishing, setIsPublishing] = useState(false);

    useEffect(() => {
        if (!proposal?.id) return;

        // Fetch proposal details
        const loadProposal = async () => {
            try {
                const res = await api.get(`/proposals/${proposal.id}`);
                const data = res.data;
                if (data.budget_data) {
                    try {
                        const parsed = JSON.parse(data.budget_data);
                        if (Array.isArray(parsed)) {
                            setItems(parsed);
                        }
                    } catch (e) {
                        console.error('Erro ao converter budget_data:', e);
                    }
                }
            } catch (err) {
                console.error('Erro ao buscar proposta:', err);
            } finally {
                setLoading(false);
            }
        };

        // Fetch company settings for contact info
        api.get('/settings')
            .then(res => {
                setLiveSettings(res.data);
                const tenant = res.data?.tenant;
                if (tenant) {
                    if (tenant.phone && !user?.phone) {
                        setContactPhone(tenant.phone);
                    }
                    setContactWebsite(tenant.website || '');
                    setContactInstagram(tenant.instagram || '');
                }
            })
            .catch(err => console.error('Erro ao carregar settings:', err));

        loadProposal();
    }, [proposal]);

    useEffect(() => {
        if (items.length > 0 && items.some(item => typeof item.includeInPresentation === 'undefined')) {
            const initItems = items.map(item => {
                if (typeof item.includeInPresentation === 'undefined') {
                    return { ...item, includeInPresentation: true };
                }
                return item;
            });
            setItems(initItems);
        }
    }, [items, setItems]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await api.get(`/proposals/${proposal.id}/events`);
                const data = response.data;
                const pubs = data.filter(e => e.type === 'Publicação');
                setPublishHistory(pubs);
            } catch (err) {
                console.error("Erro ao buscar histórico de publicações:", err);
            }
        };
        if (proposal?.id) fetchHistory();
    }, [proposal, publishData]);

    const saveBudgetData = async (updatedItems) => {
        setSaving(true);
        try {
            await api.put(`/proposals/${proposal.id}`, {
                budget_data: JSON.stringify(updatedItems)
            });
        } catch (err) {
            console.error('Erro ao salvar proposta:', err);
            alert('Falha ao salvar alterações no servidor.');
        } finally {
            setSaving(false);
        }
    };

    // Environment/Slide Actions
    const handleItemToggleInclusion = async (itemId) => {
        const updated = items.map(item => {
            if (item.id === itemId) {
                return { ...item, includeInPresentation: item.includeInPresentation === false ? true : false };
            }
            return item;
        });
        setItems(updated);
        await saveBudgetData(updated);
    };

    const handleItemDescriptionChange = (itemId, val) => {
        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                return { ...item, description: val };
            }
            return item;
        }));
    };

    const handleDescriptionBlur = async (itemId) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
            await saveBudgetData(items);
        }
    };



    const handleAddImageAnnotation = async (itemId, imgUrl, x, y) => {
        const newAnnotation = {
            id: Date.now().toString(),
            text: '',
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10
        };

        const updated = items.map(item => {
            if (item.id === itemId) {
                const currentAttachments = Array.isArray(item.attachments) ? item.attachments : [];
                return {
                    ...item,
                    attachments: currentAttachments.map(a => {
                        if (a.url === imgUrl) {
                            const currentAnnotations = Array.isArray(a.annotations) ? a.annotations : [];
                            return {
                                ...a,
                                annotations: [...currentAnnotations, newAnnotation]
                            };
                        }
                        return a;
                    })
                };
            }
            return item;
        });

        setItems(updated);
        setActiveAnnotationId(newAnnotation.id);
        await saveBudgetData(updated);
    };

    const handleUpdateImageAnnotation = (itemId, imgUrl, annotationId, text) => {
        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const currentAttachments = Array.isArray(item.attachments) ? item.attachments : [];
                return {
                    ...item,
                    attachments: currentAttachments.map(a => {
                        if (a.url === imgUrl) {
                            const currentAnnotations = Array.isArray(a.annotations) ? a.annotations : [];
                            return {
                                ...a,
                                annotations: currentAnnotations.map(ann => 
                                    ann.id === annotationId ? { ...ann, text } : ann
                                )
                            };
                        }
                        return a;
                    })
                };
            }
            return item;
        }));
    };

    const handleAnnotationSave = async () => {
        await saveBudgetData(items);
    };

    const handleDeleteImageAnnotation = async (itemId, imgUrl, annotationId) => {
        const updated = items.map(item => {
            if (item.id === itemId) {
                const currentAttachments = Array.isArray(item.attachments) ? item.attachments : [];
                return {
                    ...item,
                    attachments: currentAttachments.map(a => {
                        if (a.url === imgUrl) {
                            const currentAnnotations = Array.isArray(a.annotations) ? a.annotations : [];
                            return {
                                ...a,
                                annotations: currentAnnotations.filter(ann => ann.id !== annotationId)
                            };
                        }
                        return a;
                    })
                };
            }
            return item;
        });
        setItems(updated);
        setActiveAnnotationId(null);
        await saveBudgetData(updated);
    };

    const handleImageClick = (e, itemId, imgUrl) => {
        if (e.target.closest('.interactive-pin') || e.target.closest('.pin-popover')) {
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        handleAddImageAnnotation(itemId, imgUrl, x, y);
    };

    const checkDivergences = () => {
        const list = [];
        items.forEach(item => {
            if (item.includeInPresentation === false) return;
            const hasService = Array.isArray(item.products) && item.products.some(p => p.product.group_name === 'Serviços');
            if (!hasService) {
                list.push({
                    itemName: item.name,
                    type: 'Serviço',
                    message: 'Falta custo de serviço. Este item não possui nenhum serviço/diária adicionado.'
                });
            }

            // Check Product Prices
            if (Array.isArray(item.products)) {
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
        });
        return list;
    };

    const moveItem = async (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= items.length) return;

        const updated = [...items];
        const temp = updated[index];
        updated[index] = updated[newIndex];
        updated[newIndex] = temp;

        setItems(updated);
        await saveBudgetData(updated);
    };

    // New Environment Mini-Modal Actions
    const handleOpenCreateModal = () => {
        setNewItemName('');
        setNewItemDescription('');
        setNewItemAttachments([]);
        setShowCreateModal(true);
    };

    const handleFileUploadItem = async (e) => {
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
            setNewItemAttachments(prev => [...prev, fileData]);
        } catch (err) {
            alert('Erro ao fazer upload do arquivo');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteAttachmentItem = (idx) => {
        setNewItemAttachments(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSaveItemInfo = async () => {
        if (!newItemName.trim()) {
            setDivergences([{
                itemName: 'Novo Ambiente',
                type: 'Campos Obrigatórios',
                message: 'Informe o nome do item antes de salvar.'
            }]);
            setShowDivergencesModal(true);
            return;
        }
        
        const newItem = {
            id: Date.now().toString(),
            name: newItemName,
            description: newItemDescription,
            attachments: newItemAttachments,
            products: [],
            includeInPresentation: true
        };
        
        const updatedItems = [...items, newItem];
        setItems(updatedItems);
        await saveBudgetData(updatedItems);
        setShowCreateModal(false);
    };

    // Attachment Actions
    const handleImageUpload = async (e, itemId) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingItem(itemId);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const newImg = { 
                name: file.name, 
                url: res.data.url, 
                type: file.type,
                excludeFromPresentation: false
            };

            const updated = items.map(item => {
                if (item.id === itemId) {
                    const currentAttachments = Array.isArray(item.attachments) ? item.attachments : [];
                    return { ...item, attachments: [...currentAttachments, newImg] };
                }
                return item;
            });

            setItems(updated);
            await saveBudgetData(updated);
        } catch (err) {
            console.error(err);
            alert('Erro ao fazer upload da imagem.');
        } finally {
            setUploadingItem(null);
        }
    };

    const handleImageDelete = async (itemId, imgUrl) => {
        if (!confirm('Deseja realmente remover esta imagem deste ambiente?')) return;
        const updated = items.map(item => {
            if (item.id === itemId) {
                const currentAttachments = Array.isArray(item.attachments) ? item.attachments : [];
                return { ...item, attachments: currentAttachments.filter(a => a.url !== imgUrl) };
            }
            return item;
        });
        setItems(updated);
        await saveBudgetData(updated);
    };

    const handleImageToggleExclusion = async (itemId, imgUrl) => {
        const updated = items.map(item => {
            if (item.id === itemId) {
                const currentAttachments = Array.isArray(item.attachments) ? item.attachments : [];
                return {
                    ...item,
                    attachments: currentAttachments.map(a => 
                        a.url === imgUrl ? { ...a, excludeFromPresentation: !a.excludeFromPresentation } : a
                    )
                };
            }
            return item;
        });
        setItems(updated);
        await saveBudgetData(updated);
    };

    const handlePrint = () => {
        const oldTitle = document.title;
        const proposalNum = String(proposal.id).padStart(4, '0');
        const clientName = proposal.partner_name || '';
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '-');
        const version = `${dateStr}_${timeStr}`;
        document.title = `Apresentacao_${proposalNum}_v${version}-${clientName}`;
        
        window.print();
        document.title = oldTitle;
    };

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            const res = await api.post(`/proposals/${proposal.id}/publish`);
            setPublishData({
                token: res.data.token,
                link: window.location.origin + res.data.link
            });
        } catch (err) {
            console.error('Erro ao publicar:', err);
            alert('Falha ao gerar o link de apresentação.');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleCopyLink = () => {
        if (publishData?.link) {
            navigator.clipboard.writeText(`Acesse a apresentação do seu projeto aqui: ${publishData.link} \nSeu Token de Acesso: ${publishData.token}`);
            alert('Link e token copiados para a área de transferência!');
        }
    };

    if (loading) {
        return createPortal(
            <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.85)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                    <Loader2 size={40} className="spin" style={{ color: 'var(--primary)' }} />
                    <span style={{ color: 'white', fontWeight: '600' }}>Carregando dados da apresentação...</span>
                </div>
            </div>,
            document.body
        );
    }

    const isImageAtt = (a) =>
        (a.type && a.type.includes('image')) ||
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(a.url || a.name || '');

    // Filter and build slides list for printing
    const activeImageSlides = [];
    items.forEach(item => {
        if (item.includeInPresentation === false) return;
        const atts = Array.isArray(item.attachments) ? item.attachments : [];
        const images = atts.filter(a => isImageAtt(a) && a.excludeFromPresentation !== true);
        images.forEach((img, idx) => {
            activeImageSlides.push({
                item,
                img,
                index: idx + 1,
                total: images.length
            });
        });
    });

    return createPortal(
        <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.85)' }}>
            <div className="modal-content" style={{ 
                maxWidth: '1350px', 
                width: '96vw', 
                height: '92vh', 
                display: 'flex', 
                flexDirection: 'column', 
                padding: '1.5rem', 
                position: 'relative',
                background: '#0b0f19',
                borderColor: 'var(--primary)'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                    <div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Image size={24} style={{ color: 'var(--primary)' }} /> Montar Apresentação
                        </h2>
                        <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', marginTop: '2px' }}>
                            Configure a capa, organize os slides dos ambientes e prepare o PDF para o cliente ({proposal.partner_name})
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button 
                            onClick={handlePublish}
                            disabled={isPublishing}
                            className="btn-premium"
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: '8px', 
                                padding: '8px 16px', borderRadius: '8px',
                                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                                color: 'white', border: 'none', cursor: 'pointer', fontWeight: '700'
                            }}
                        >
                            {isPublishing ? <Loader2 size={18} className="spin" /> : <Share2 size={18} />}
                            Publicar Web
                        </button>
                        <button onClick={onClose} className="btn-icon"><X size={20} /></button>
                    </div>
                </div>

                {/* Publish Info Alert */}
                {publishData && (
                    <div style={{ 
                        background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', 
                        borderRadius: '12px', padding: '16px', marginBottom: '20px',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px'
                    }}>
                        <div>
                            <h4 style={{ color: '#10b981', fontSize: '1rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Check size={18} /> Apresentação Publicada com Sucesso!
                            </h4>
                            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginBottom: '4px' }}>
                                O link exclusivo e o token de acesso foram gerados. Eles expiram em 8 horas.
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px' }}>
                                <div>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Link</span>
                                    <a href={publishData.link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                                        {publishData.link}
                                    </a>
                                </div>
                                <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }}></div>
                                <div>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Token</span>
                                    <span style={{ color: 'white', fontWeight: '800', fontSize: '1.2rem', letterSpacing: '2px' }}>{publishData.token}</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={handleCopyLink}
                            style={{ 
                                background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', 
                                padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        >
                            <Copy size={16} /> Copiar para Cliente
                        </button>
                    </div>
                )}

                {/* Publish History Box */}
                {publishHistory.length > 0 && !publishData && (
                    <div style={{ 
                        background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '12px', padding: '16px', marginBottom: '20px'
                    }}>
                        <div 
                            onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
                            style={{ 
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                cursor: 'pointer', userSelect: 'none'
                            }}
                        >
                            <h4 style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                <History size={16} /> Histórico de Publicações ({publishHistory.length})
                            </h4>
                            <div style={{ color: 'rgba(255,255,255,0.6)' }}>
                                {isHistoryCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                            </div>
                        </div>

                        {!isHistoryCollapsed && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '180px', overflowY: 'auto', marginTop: '16px' }}>
                                {[...publishHistory].reverse().map((pub, idx) => {
                                    const tokenMatch = pub.description.match(/Token de Acesso:\s*([A-Z0-9]+)/);
                                    const pubToken = tokenMatch ? tokenMatch[1] : '---';
                                    
                                    const expireMatch = pub.description.match(/Expira em:\s*(.+)/);
                                    const expireText = expireMatch ? expireMatch[1] : null;

                                    const linkMatch = pub.description.match(/Link:\s*([^\s]+)/);
                                    const linkHref = linkMatch ? linkMatch[1] : `/presentation/view/${pub.proposal_id}`;
                                    
                                    const isActive = (proposal.presentation_token && pubToken === proposal.presentation_token);

                                    return (
                                        <div key={pub.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0,0,0,0.2)', borderRadius: '6px', border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {pub.event_date} às {pub.event_time}
                                                    {isActive ? (
                                                        <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '800' }}>Último (Ativo)</span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '800' }}>Inativo</span>
                                                    )}
                                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 'normal' }}>
                                                        (Por: {pub.creator_name || 'Usuário'})
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', display: 'flex', gap: '12px' }}>
                                                    <span>
                                                        <strong style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 'normal' }}>Link: </strong>
                                                        <a href={linkHref} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                                            {linkHref}
                                                        </a>
                                                    </span>
                                                    {expireText && (
                                                        <span>
                                                            <strong style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 'normal' }}>Expira: </strong>
                                                            {expireText}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Token</div>
                                                <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '1px' }}>{pubToken}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Main Content Split Panels */}
                <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    
                    {/* Left Column: Customizations */}
                    <div style={{ 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '16px', 
                        padding: '1.25rem', 
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        {/* Cover Customization */}
                        <div>
                            <h3 style={{ fontSize: '0.95rem', color: 'var(--primary)', fontWeight: '800', borderBottom: '1px dashed var(--border)', paddingBottom: '8px', marginBottom: '12px', letterSpacing: '0.5px' }}>
                                1. CAPA DA APRESENTAÇÃO
                            </h3>
                            
                            <label>Título da Capa</label>
                            <input 
                                type="text" 
                                value={coverTitle} 
                                onChange={e => setCoverTitle(e.target.value)} 
                                placeholder="Título principal..." 
                                style={{ marginBottom: '12px' }}
                            />

                            <label>Subtítulo (Cliente / Projeto)</label>
                            <input 
                                type="text" 
                                value={coverSubtitle} 
                                onChange={e => setCoverSubtitle(e.target.value)} 
                                placeholder="Subtítulo..." 
                                style={{ marginBottom: '16px' }}
                            />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', textTransform: 'none', fontWeight: '600' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={showLogo} 
                                        onChange={e => setShowLogo(e.target.checked)} 
                                        style={{ width: '18px', height: '18px', marginBottom: 0, cursor: 'pointer' }}
                                    />
                                    Mostrar logotipo da empresa
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', textTransform: 'none', fontWeight: '600' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={showDate} 
                                        onChange={e => setShowDate(e.target.checked)} 
                                        style={{ width: '18px', height: '18px', marginBottom: 0, cursor: 'pointer' }}
                                    />
                                    Mostrar data de geração
                                </label>
                            </div>
                        </div>

                        {/* Closing Customization */}
                        <div>
                            <h3 style={{ fontSize: '0.95rem', color: 'var(--primary)', fontWeight: '800', borderBottom: '1px dashed var(--border)', paddingBottom: '8px', marginBottom: '12px', letterSpacing: '0.5px' }}>
                                2. SLIDE FINAL / CONTATOS
                            </h3>

                            <label>Título de Agradecimento</label>
                            <input 
                                type="text" 
                                value={closingTitle} 
                                onChange={e => setClosingTitle(e.target.value)} 
                                placeholder="Título final..." 
                                style={{ marginBottom: '12px' }}
                            />

                            <label>Mensagem de Fechamento</label>
                            <textarea 
                                value={closingText} 
                                onChange={e => setClosingText(e.target.value)} 
                                placeholder="Mensagem..." 
                                style={{ minHeight: '80px', fontSize: '0.85rem', marginBottom: '16px' }}
                            />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', textTransform: 'none', fontWeight: '600' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={showContacts} 
                                        onChange={e => setShowContacts(e.target.checked)} 
                                        style={{ width: '18px', height: '18px', marginBottom: 0, cursor: 'pointer' }}
                                    />
                                    Exibir informações de contato
                                </label>
                            </div>

                            {showContacts && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px', borderLeft: '2px solid var(--primary)' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem' }}>Responsável</label>
                                        <input 
                                            type="text" 
                                            value={contactName} 
                                            onChange={e => setContactName(e.target.value)} 
                                            style={{ marginBottom: '6px', padding: '6px 10px', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem' }}>Telefone</label>
                                        <input 
                                            type="text" 
                                            value={contactPhone} 
                                            onChange={e => setContactPhone(maskPhone(e.target.value))} 
                                            style={{ marginBottom: '6px', padding: '6px 10px', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem' }}>E-mail</label>
                                        <input 
                                            type="email" 
                                            value={contactEmail} 
                                            onChange={e => setContactEmail(e.target.value)} 
                                            style={{ marginBottom: '6px', padding: '6px 10px', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem' }}>Website</label>
                                        <input 
                                            type="text" 
                                            value={contactWebsite} 
                                            onChange={e => setContactWebsite(e.target.value)} 
                                            style={{ marginBottom: '6px', padding: '6px 10px', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem' }}>Instagram</label>
                                        <input 
                                            type="text" 
                                            value={contactInstagram} 
                                            onChange={e => setContactInstagram(e.target.value)} 
                                            style={{ marginBottom: 0, padding: '6px 10px', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Slide/Environment Manager */}
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                Ambientes da Apresentação ({items.filter(i => i.includeInPresentation !== false).length} inclusos)
                                <button 
                                    onClick={handleOpenCreateModal} 
                                    style={{ 
                                        background: 'var(--primary)', 
                                        border: 'none', 
                                        color: 'white', 
                                        padding: '4px 10px', 
                                        borderRadius: '6px', 
                                        cursor: 'pointer', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        fontSize: '0.75rem',
                                        fontWeight: '700'
                                    }}
                                >
                                    <Plus size={14} /> Novo Ambiente
                                </button>
                            </h3>
                            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                {saving ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Loader2 size={14} className="spin" /> Salvando...
                                    </span>
                                ) : '✓ Sincronizado'}
                            </span>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                            {items.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1.5px dashed var(--border)' }}>
                                    <AlertCircle size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.5 }} />
                                    <p style={{ fontWeight: '600' }}>Nenhum ambiente encontrado neste orçamento.</p>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginTop: '4px' }}>
                                        Adicione itens no orçamento da proposta antes de montar a apresentação.
                                    </p>
                                </div>
                            ) : (
                                items.map((item, index) => {
                                    const isIncluded = item.includeInPresentation !== false;
                                    const attachments = Array.isArray(item.attachments) ? item.attachments : [];
                                    const images = attachments.filter(isImageAtt);

                                    return (
                                        <div 
                                            key={item.id} 
                                            style={{ 
                                                background: isIncluded ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)', 
                                                border: '1px solid',
                                                borderColor: isIncluded ? 'var(--border)' : 'rgba(255,255,255,0.1)',
                                                borderRadius: '12px', 
                                                padding: '16px', 
                                                marginBottom: '16px',
                                                transition: 'all 0.2s',
                                                opacity: isIncluded ? 1 : 0.6
                                            }}
                                        >
                                            {/* Top bar of Environment Card */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {/* Reorder actions */}
                                                    <button 
                                                        disabled={index === 0} 
                                                        onClick={() => moveItem(index, -1)}
                                                        className="btn-icon" 
                                                        style={{ padding: '4px', borderRadius: '4px' }}
                                                        title="Mover para Cima"
                                                    >
                                                        <ChevronUp size={16} />
                                                    </button>
                                                    <button 
                                                        disabled={index === items.length - 1} 
                                                        onClick={() => moveItem(index, 1)}
                                                        className="btn-icon" 
                                                        style={{ padding: '4px', borderRadius: '4px' }}
                                                        title="Mover para Baixo"
                                                    >
                                                        <ChevronDown size={16} />
                                                    </button>
                                                    
                                                    {/* Title */}
                                                    <span style={{ fontWeight: '700', fontSize: '1.05rem', color: isIncluded ? 'white' : 'rgba(255,255,255,0.4)', marginLeft: '6px' }}>
                                                        {item.name}
                                                    </span>
                                                </div>

                                                {/* Inclusion Toggle */}
                                                <button 
                                                    onClick={() => handleItemToggleInclusion(item.id)}
                                                    className="btn-premium"
                                                    style={{ 
                                                        padding: '6px 14px', 
                                                        fontSize: '0.75rem',
                                                        borderRadius: '6px',
                                                        background: isIncluded ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.05)',
                                                        boxShadow: isIncluded ? '0 2px 8px rgba(16, 185, 129, 0.2)' : 'none',
                                                        border: isIncluded ? 'none' : '1px solid var(--border)',
                                                        color: isIncluded ? 'white' : 'rgba(255,255,255,0.6)'
                                                    }}
                                                >
                                                    {isIncluded ? '✓ Incluso na Apresentação' : 'Excluído'}
                                                </button>
                                            </div>

                                            {isIncluded && (
                                                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px', marginTop: '12px' }}>
                                                    {/* Left side: Description */}
                                                    <div>
                                                        <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>Texto do Slide</label>
                                                        <textarea 
                                                            value={item.description || ''} 
                                                            onChange={e => handleItemDescriptionChange(item.id, e.target.value)}
                                                            onBlur={() => handleDescriptionBlur(item.id)}
                                                            placeholder="Descreva as especificações ou conceitos para este ambiente..."
                                                            style={{ width: '100%', minHeight: '110px', fontSize: '0.85rem', marginBottom: 0, resize: 'vertical' }}
                                                        />
                                                    </div>

                                                    {/* Right side: Images Manager */}
                                                    <div>
                                                        <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>
                                                            Imagens do Ambiente ({images.filter(img => img.excludeFromPresentation !== true).length} visíveis)
                                                        </label>
                                                        
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
                                                            {images.map((img, imgIdx) => {
                                                                const isExcluded = img.excludeFromPresentation === true;
                                                                return (
                                                                    <div 
                                                                        key={imgIdx} 
                                                                        style={{ 
                                                                            width: '100px', 
                                                                            height: '100px', 
                                                                            borderRadius: '8px', 
                                                                            border: '1px solid',
                                                                            borderColor: isExcluded ? '#ef4444' : 'var(--border)',
                                                                            position: 'relative',
                                                                            overflow: 'hidden',
                                                                            background: '#000',
                                                                            opacity: isExcluded ? 0.4 : 1,
                                                                            transition: 'opacity 0.2s'
                                                                        }}
                                                                    >
                                                                        <img 
                                                                            src={img.url} 
                                                                            alt="Anexo" 
                                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                                        />

                                                                        {/* Delete action overlay */}
                                                                        <button 
                                                                            onClick={() => handleImageDelete(item.id, img.url)}
                                                                            style={{ 
                                                                                position: 'absolute', 
                                                                                top: '4px', 
                                                                                right: '4px', 
                                                                                background: 'rgba(239, 68, 68, 0.85)', 
                                                                                border: 'none', 
                                                                                borderRadius: '4px', 
                                                                                color: 'white', 
                                                                                cursor: 'pointer', 
                                                                                padding: '3px' 
                                                                            }}
                                                                            title="Excluir Imagem"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>

                                                                        {/* Inclusion toggle overlay (eye icon) */}
                                                                        <button 
                                                                            onClick={() => handleImageToggleExclusion(item.id, img.url)}
                                                                            style={{ 
                                                                                position: 'absolute', 
                                                                                bottom: '4px', 
                                                                                left: '4px', 
                                                                                background: isExcluded ? 'rgba(239, 68, 68, 0.85)' : 'rgba(16, 185, 129, 0.85)', 
                                                                                border: 'none', 
                                                                                borderRadius: '4px', 
                                                                                color: 'white', 
                                                                                cursor: 'pointer', 
                                                                                padding: '3px' 
                                                                            }}
                                                                            title={isExcluded ? "Excluído da Apresentação" : "Incluso na Apresentação"}
                                                                        >
                                                                            {isExcluded ? <EyeOff size={12} /> : <Eye size={12} />}
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}

                                                            {/* Upload Button Box */}
                                                            <div 
                                                                onClick={() => document.getElementById(`file-upload-${item.id}`).click()}
                                                                style={{ 
                                                                    width: '100px', 
                                                                    height: '100px', 
                                                                    borderRadius: '8px', 
                                                                    border: '1.5px dashed var(--border)', 
                                                                    display: 'flex', 
                                                                    flexDirection: 'column', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'center', 
                                                                    cursor: 'pointer',
                                                                    background: 'rgba(255,255,255,0.02)',
                                                                    transition: 'border-color 0.2s',
                                                                    gap: '6px'
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                                            >
                                                                {uploadingItem === item.id ? (
                                                                    <Loader2 size={20} className="spin" style={{ color: 'var(--primary)' }} />
                                                                ) : (
                                                                    <>
                                                                        <Upload size={20} style={{ color: 'rgba(255,255,255,0.4)' }} />
                                                                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '0 4px' }}>Adicionar</span>
                                                                    </>
                                                                )}
                                                                <input 
                                                                    id={`file-upload-${item.id}`} 
                                                                    type="file" 
                                                                    hidden 
                                                                    accept="image/*"
                                                                    onChange={(e) => handleImageUpload(e, item.id)} 
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                            Slides gerados: <strong>{activeImageSlides.length + 2}</strong> (Capa + {activeImageSlides.length} de projetos + 1 final)
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onClose} className="btn-secondary" style={{ padding: '10px 20px' }}>
                            Fechar
                        </button>
                        
                        <button 
                            onClick={() => {
                                const divs = [];
                                
                                if (activeImageSlides.length === 0) {
                                    divs.push({
                                        itemName: 'Estrutura da Apresentação',
                                        type: 'Configuração',
                                        message: 'Para visualizar a apresentação, inclua pelo menos um ambiente e uma foto ativa.'
                                    });
                                }
                                
                                const budgetDivs = checkDivergences();
                                divs.push(...budgetDivs);

                                if (divs.length > 0) {
                                    setDivergences(divs);
                                    setShowDivergencesModal(true);
                                } else {
                                    setShowPrint(true);
                                }
                            }}
                            className="btn-premium"
                            style={{ 
                                padding: '10px 24px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px'
                            }}
                        >
                            Visualizar Apresentação <Eye size={18} />
                        </button>
                    </div>
                </div>

                {/* Print Layout Overlay inside the Portal */}
                {showPrint && createPortal(
                    <div className="print-overlay-container" style={{ 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        width: '100vw', 
                        height: '100vh', 
                        background: '#fff', 
                        color: '#000', 
                        zIndex: 200000, 
                        overflowY: 'auto', 
                        padding: '40px' 
                    }}>
                        {/* CSS Print Rules */}
                        <style>{`
                            @media screen {
                                .only-print {
                                    display: none !important;
                                }
                            }
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
                                .only-print { display: block !important; }
                                .print-container {
                                    padding: 0 !important;
                                    width: 100% !important;
                                    max-width: 100% !important;
                                    margin: 0 !important;
                                }
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
                            }
                        `}</style>
                        
                        {/* Control bar */}
                        <div className="no-print" style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            marginBottom: '30px', 
                            background: '#f8fafc', 
                            padding: '15px', 
                            borderRadius: '12px', 
                            border: '1px solid #e2e8f0' 
                        }}>
                            <div style={{ fontWeight: 'bold', color: '#1e293b' }}>Visualização da Apresentação (Modo Paisagem/PDF)</div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={handlePrint} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Printer size={16} /> Imprimir / Salvar PDF
                                </button>
                                <button onClick={() => setShowPrint(false)} style={{ background: '#64748b', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    Voltar para Configuração
                                </button>
                            </div>
                        </div>

                        <div className="print-container" style={{ maxWidth: '100%', margin: '0 auto', fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#1e293b' }}>
                            
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
                                position: 'relative',
                                border: '1px solid #e2e8f0',
                                gap: '60px'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '4px',
                                    background: '#10b981'
                                }} />
                                
                                {/* Cover Header (Logo) */}
                                {showLogo && (
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
                                )}

                                {/* Cover Body */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', letterSpacing: '3px', textTransform: 'uppercase' }}>
                                        {coverTitle}
                                    </div>
                                    <h1 style={{ fontSize: '48px', fontWeight: '300', margin: 0, color: '#1e293b', lineHeight: '1.2' }}>
                                        {coverSubtitle}
                                    </h1>
                                    <div style={{ height: '1px', width: '120px', background: '#cbd5e1', margin: '15px 0' }} />
                                    {showDate && (
                                        <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
                                            {new Date().toLocaleDateString('pt-BR')} | {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ENVIRONMENT SLIDES */}
                            {activeImageSlides.map(({ item, img, index: imgIndex, total: imgTotal }, idx) => {
                                const annotations = Array.isArray(img.annotations) ? img.annotations : [];
                                return (
                                    <div key={`${item.id}-img-${idx}`} className="presentation-slide" style={{
                                    height: '100vh',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    padding: '40px 60px',
                                    boxSizing: 'border-box',
                                    pageBreakAfter: 'always',
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    <div className="presentation-slide-body" style={{ display: 'flex', gap: '40px', flex: 1, margin: '20px 0', minHeight: 0, position: 'relative' }}>
                                        {/* Left Info Column */}
                                        <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left', borderRight: '1px solid #f1f5f9', paddingRight: '20px', paddingTop: '10px' }}>
                                            <div style={{ fontSize: '16px', fontWeight: '800', color: '#10b981', letterSpacing: '2px', textTransform: 'uppercase' }}>
                                                {item.name}
                                            </div>
                                            {item.description && (
                                                <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                                    {item.description}
                                                </div>
                                            )}
                                            
                                            {/* Post-it Image Annotations list */}
                                            {annotations.length > 0 && (
                                                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
                                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                                        Anotações da Foto:
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                                                        {annotations.map((ann, annIdx) => (
                                                            <div key={ann.id} style={{ display: 'flex', gap: '6px', fontSize: '12px', lineHeight: '1.4' }}>
                                                                <span style={{ 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'center', 
                                                                    minWidth: '18px', 
                                                                    height: '18px', 
                                                                    borderRadius: '50%', 
                                                                    background: '#eab308', 
                                                                    color: '#000', 
                                                                    fontWeight: 'bold', 
                                                                    fontSize: '10px' 
                                                                }}>
                                                                    {annIdx + 1}
                                                                </span>
                                                                <span style={{ color: '#475569', fontStyle: 'italic', flex: 1, whiteSpace: 'pre-wrap' }}>
                                                                    {ann.text || '(Clique no pin para preencher)'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Image Column */}
                                        <div 
                                            className="presentation-slide-image-box" 
                                            style={{
                                                flex: 1,
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                overflow: 'hidden',
                                                background: '#f8fafc',
                                                border: '1px solid #f1f5f9',
                                                borderRadius: '6px'
                                            }}
                                            title="Clique em qualquer lugar da imagem para adicionar um post-it"
                                        >
                                            <div 
                                                style={{ position: 'relative', display: 'inline-block', cursor: 'crosshair' }} 
                                                onClick={(e) => handleImageClick(e, item.id, img.url)}
                                            >
                                                <img 
                                                    className="presentation-slide-image"
                                                    src={img.url} 
                                                    alt={`${item.name} - ${imgIndex}`} 
                                                    style={{
                                                        maxWidth: '100%',
                                                        maxHeight: 'calc(100vh - 170px)',
                                                        display: 'block',
                                                        pointerEvents: 'none',
                                                        userSelect: 'none'
                                                    }} 
                                                />

                                                {/* Render Screen Pins and Popovers */}
                                                {annotations.map((ann, annIdx) => (
                                                    <React.Fragment key={ann.id}>
                                                        {/* Screen Pin */}
                                                        <div 
                                                            className="interactive-pin no-print"
                                                            onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveAnnotationId(activeAnnotationId === ann.id ? null : ann.id);
                                                        }}
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${ann.x}%`,
                                                            top: `${ann.y}%`,
                                                            transform: 'translate(-50%, -50%)',
                                                            width: '26px',
                                                            height: '26px',
                                                            borderRadius: '50%',
                                                            background: '#eab308',
                                                            color: '#000',
                                                            fontWeight: 'bold',
                                                            fontSize: '13px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                                            cursor: 'pointer',
                                                            border: '2px solid #ffffff',
                                                            zIndex: 100,
                                                            transition: 'transform 0.15s ease'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.15)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%)'}
                                                    >
                                                        {annIdx + 1}
                                                    </div>

                                                    {/* Print Pin */}
                                                    <div 
                                                        className="only-print"
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${ann.x}%`,
                                                            top: `${ann.y}%`,
                                                            transform: 'translate(-50%, -50%)',
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            background: '#eab308',
                                                            color: '#000',
                                                            fontWeight: 'bold',
                                                            fontSize: '11px',
                                                            display: 'none',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            border: '1.5px solid #000',
                                                            zIndex: 50
                                                        }}
                                                    >
                                                        {annIdx + 1}
                                                    </div>

                                                    {/* Screen Popover / Post-it Editor */}
                                                    {activeAnnotationId === ann.id && (() => {
                                                        const isBottom = ann.y > 65;
                                                        let transformX = '-50%';
                                                        if (ann.x < 15) transformX = '-10%';
                                                        else if (ann.x > 85) transformX = '-90%';

                                                        return (
                                                            <div 
                                                                className="pin-popover no-print"
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: `${ann.x}%`,
                                                                    ...(isBottom ? { bottom: `${100 - ann.y + 4}%` } : { top: `${ann.y + 4}%` }),
                                                                    transform: `translateX(${transformX})`,
                                                                    background: '#fef08a',
                                                                border: '1px solid #facc15',
                                                                borderRadius: '8px',
                                                                padding: '10px',
                                                                width: '220px',
                                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
                                                                zIndex: 200,
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '8px'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(234, 179, 8, 0.3)', paddingBottom: '4px' }}>
                                                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#854d0e', textTransform: 'uppercase' }}>
                                                                    Anotação #{annIdx + 1}
                                                                </span>
                                                                <button 
                                                                    onClick={() => handleDeleteImageAnnotation(item.id, img.url, ann.id)}
                                                                    style={{ 
                                                                        background: 'transparent', 
                                                                        border: 'none', 
                                                                        color: '#ef4444', 
                                                                        cursor: 'pointer',
                                                                        padding: '2px',
                                                                        display: 'flex',
                                                                        alignItems: 'center'
                                                                    }}
                                                                    title="Excluir anotação"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                            <textarea
                                                                autoFocus
                                                                value={ann.text}
                                                                onChange={(e) => handleUpdateImageAnnotation(item.id, img.url, ann.id, e.target.value)}
                                                                onBlur={handleAnnotationSave}
                                                                placeholder="Escreva sua anotação..."
                                                                style={{
                                                                    width: '100%',
                                                                    minHeight: '80px',
                                                                    fontSize: '12px',
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    color: '#1c1917',
                                                                    resize: 'none',
                                                                    outline: 'none',
                                                                    fontFamily: 'inherit',
                                                                    lineHeight: '1.4'
                                                                }}
                                                            />
                                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                                <button 
                                                                    onClick={() => setActiveAnnotationId(null)}
                                                                    style={{ 
                                                                        background: '#854d0e', 
                                                                        color: '#fff', 
                                                                        border: 'none', 
                                                                        padding: '3px 8px', 
                                                                        borderRadius: '4px', 
                                                                        fontSize: '10px', 
                                                                        fontWeight: 'bold', 
                                                                        cursor: 'pointer' 
                                                                    }}
                                                                >
                                                                    OK
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                                </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', fontSize: '11px', color: '#94a3b8' }}>
                                        <span>{proposal.partner_name} - Proposta Ref: #{String(proposal.id).padStart(4, '0')}</span>
                                        <span>
                                            Slide {idx + 2} de {activeImageSlides.length + 2}
                                        </span>
                                    </div>
                                </div>
                                );
                            })}

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
                                position: 'relative',
                                border: '1px solid #e2e8f0',
                                gap: '40px'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', textAlign: 'center' }}>
                                    <h1 style={{ fontSize: '32px', fontWeight: '300', color: '#1e293b', margin: 0, letterSpacing: '4px', textTransform: 'uppercase' }}>
                                        {closingTitle}
                                    </h1>
                                    <div style={{ height: '2px', width: '60px', background: '#10b981', margin: '5px 0' }} />
                                    <p style={{ fontSize: '15px', color: '#64748b', fontWeight: '400', margin: 0, maxWidth: '550px', lineHeight: '1.6', textAlign: 'center' }}>
                                        {closingText}
                                    </p>
                                </div>

                                {showContacts && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '30px', maxWidth: '600px', width: '100%' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', textAlign: 'center' }}>
                                            <div style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' }}>CONTATO DO RESPONSÁVEL</div>
                                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#334155' }}>{contactName}</div>
                                            <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {contactPhone && <div>📞 {contactPhone}</div>}
                                                {contactEmail && <div>✉️ {contactEmail}</div>}
                                            </div>
                                        </div>

                                        {(contactWebsite || contactInstagram) && (
                                            <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '15px', width: '100%', justifyContent: 'center' }}>
                                                {contactWebsite && <div>🌐 {contactWebsite}</div>}
                                                {contactInstagram && <div>📸 {contactInstagram}</div>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>,
                    document.body
                )}
                {showCreateModal && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px' }}>
                        <div style={{ background: '#0f172a', border: '2.5px solid var(--primary)', padding: '2rem', borderRadius: '16px', width: '600px', maxWidth: '95%', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>
                            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>
                                Criar Novo Ambiente
                            </h3>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label>Nome (Ex: Cozinha, Banheiro) *</label>
                                <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Nome do ambiente..." style={{ width: '100%' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '1.5rem' }}>
                                <div>
                                    <label>Descrição (Ficará visível no slide)</label>
                                    <textarea 
                                        value={newItemDescription} 
                                        onChange={e => setNewItemDescription(e.target.value)} 
                                        placeholder="Digite aqui as especificações deste ambiente..."
                                        style={{ width: '100%', minHeight: '150px', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', outline: 'none', resize: 'vertical', fontSize: '0.9rem', lineHeight: '1.5' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        Fotos do Ambiente
                                        <button 
                                            onClick={() => document.getElementById('new-item-file-input').click()}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <Plus size={14}/> Anexar
                                        </button>
                                    </label>
                                    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', height: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px' }}>
                                        {newItemAttachments.length === 0 ? (
                                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                {isUploading ? <Loader2 size={24} className="spin" style={{ color: 'var(--primary)' }} /> : <Paperclip size={24} style={{ marginBottom: '8px', opacity: 0.5 }}/>}
                                                {isUploading ? 'Fazendo upload...' : 'Nenhuma imagem anexada'}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {newItemAttachments.map((att, idx) => (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px', fontSize: '0.8rem' }}>
                                                        {att.type?.includes('image') ? <Image size={14} color="#10b981"/> : <FileText size={14} color="var(--primary)"/>}
                                                        <a href={att.url} target="_blank" rel="noreferrer" style={{ flex: 1, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</a>
                                                        <button onClick={() => handleDeleteAttachmentItem(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <input id="new-item-file-input" type="file" hidden onChange={handleFileUploadItem} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ padding: '8px 16px' }}>Cancelar</button>
                                <button onClick={handleSaveItemInfo} className="btn-premium" style={{ padding: '8px 20px' }}>Criar Ambiente</button>
                            </div>
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
                            
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                Os seguintes itens estão em desacordo com as regras comerciais do ERP. Por favor, corrija-os antes de visualizar a apresentação:
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
                                        <div style={{ color: 'white', fontSize: '0.85rem', paddingLeft: '8px', borderLeft: '2px solid #ef4444' }}>
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
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default BuildPresentationModal;
