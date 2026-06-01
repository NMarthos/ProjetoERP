import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Loader2, AlertCircle, Image, Check, FileEdit, X, MessageSquare, ClipboardCheck } from 'lucide-react';

const PublicPresentationView = () => {
    const { id } = useParams();
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [presentationData, setPresentationData] = useState(null);
    const [items, setItems] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    
    // Negotiation state
    const [showNegotiation, setShowNegotiation] = useState(false);
    const [selectedCondIdx, setSelectedCondIdx] = useState(null);
    const [paymentMethodsText, setPaymentMethodsText] = useState('');
    
    // Annotation state
    const [activeAnnotationId, setActiveAnnotationId] = useState(null);
    const [hoveredImage, setHoveredImage] = useState(null);
    const [hoveredHardware, setHoveredHardware] = useState(null);

    const handleVerifyToken = async (e) => {
        e.preventDefault();
        if (!token.trim()) return;

        setLoading(true);
        setError('');
        
        try {
            const res = await fetch(`http://localhost:3001/api/public/proposals/${id}/verify-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token.trim().toUpperCase() })
            });

            if (!res.ok) {
                const errData = await res.json();
                if (res.status === 401) {
                    throw new Error('Este token expirou ou é inválido. Por favor, solicite um novo token para a pessoa que o está atendendo.');
                } else {
                    throw new Error(errData.error || 'Erro ao carregar apresentação.');
                }
            }

            const data = await res.json();
            setPresentationData(data);
            
            if (data.budget_data) {
                try {
                    setItems(JSON.parse(data.budget_data));
                } catch (e) {
                    console.error('Erro ao converter budget_data:', e);
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const hasAnyAnnotations = () => {
        return items.some(item => 
            Array.isArray(item.attachments) && 
            item.attachments.some(att => Array.isArray(att.annotations) && att.annotations.length > 0)
        );
    };

    const handleImageClick = (e, itemIndex, attIndex) => {
        e.preventDefault();
        if (submitting || successMessage) return;
        // Don't trigger if clicking inside an active annotation
        if (e.target.closest('.annotation-popup')) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        const newId = Date.now().toString();
        const newAnnotation = {
            id: newId,
            text: '',
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10
        };

        const newItems = [...items];
        const newItem = { ...newItems[itemIndex] };
        const atts = [...newItem.attachments];
        const newAtt = { ...atts[attIndex] };
        
        if (!newAtt.annotations) newAtt.annotations = [];
        newAtt.annotations = [...newAtt.annotations, newAnnotation];
        
        atts[attIndex] = newAtt;
        newItem.attachments = atts;
        newItems[itemIndex] = newItem;
        
        setItems(newItems);
        setActiveAnnotationId(newId);
    };

    const updateAnnotationText = (itemIndex, attIndex, annId, text) => {
        const newItems = [...items];
        const newItem = { ...newItems[itemIndex] };
        const atts = [...newItem.attachments];
        const newAtt = { ...atts[attIndex] };
        
        if (newAtt.annotations) {
            newAtt.annotations = newAtt.annotations.map(a => 
                a.id === annId ? { ...a, text } : a
            );
        }
        
        atts[attIndex] = newAtt;
        newItem.attachments = atts;
        newItems[itemIndex] = newItem;
        
        setItems(newItems);
    };

    const deleteAnnotation = (e, itemIndex, attIndex, annId) => {
        if (e) e.stopPropagation();
        const newItems = [...items];
        const newItem = { ...newItems[itemIndex] };
        const atts = [...newItem.attachments];
        const newAtt = { ...atts[attIndex] };
        
        if (newAtt.annotations) {
            newAtt.annotations = newAtt.annotations.filter(a => a.id !== annId);
        }
        
        atts[attIndex] = newAtt;
        newItem.attachments = atts;
        newItems[itemIndex] = newItem;
        
        setItems(newItems);
        
        if (activeAnnotationId === annId) {
            setActiveAnnotationId(null);
        }
    };

    const handleSubmitFeedback = async (action) => {
        if (action === 'Aprovar' && !showNegotiation) {
            setShowNegotiation(true);
            return;
        }

        if (action === 'Aprovar' && selectedCondIdx === null) {
            alert('Por favor, selecione uma condição de pagamento.');
            return;
        }

        if (!window.confirm(`Tem certeza que deseja ${action.toLowerCase()} o projeto?`)) return;
        setSubmitting(true);
        try {
            const res = await fetch(`http://localhost:3001/api/public/proposals/${id}/submit-feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: token.trim().toUpperCase(),
                    action: action === 'Encaminhar para revisão' ? 'Revisar' : 'Aprovar',
                    budget_data: JSON.stringify(items),
                    payment_methods: paymentMethodsText
                })
            });

            if (!res.ok) throw new Error('Erro ao salvar feedback');
            
            setSuccessMessage(`Projeto ${action === 'Aprovar' ? 'aprovado' : 'enviado para revisão'} com sucesso! O responsável será notificado.`);
        } catch (err) {
            alert('Falha ao processar solicitação: ' + err.message);
            setSubmitting(false);
        }
    };

    const grandTotal = presentationData?.value || 0;
    const maskCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Allow active to be 1, true, or null (default)
    const availableMethods = presentationData?.payment_methods?.filter(m => m.active !== 0 && m.active !== '0' && m.active !== false) || [];
    // Sort by ID to ensure we get the most recently created active method
    const sortedMethods = [...availableMethods].sort((a, b) => a.id - b.id);
    const activeMethod = sortedMethods.slice(-1)[0];
    const conditions = activeMethod?.conditions || [];

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
        setPaymentMethodsText(text);
        setSelectedCondIdx(idx);
    };

    const getWebsiteUrl = () => {
        let url = presentationData?.tenant?.website;
        if (!url) return 'https://google.com';
        url = url.trim();
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        return url;
    };

    if (successMessage) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', maxWidth: '500px' }}>
                    <div style={{ width: '80px', height: '80px', background: '#10b981', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                        <Check size={40} />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>Tudo Certo!</h2>
                    <p style={{ color: '#475569', fontSize: '1.1rem', marginBottom: '30px' }}>{successMessage}</p>
                    <button 
                        onClick={() => window.location.href = getWebsiteUrl()}
                        style={{ padding: '12px 24px', background: '#0f172a', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Ir para o site
                    </button>
                </div>
            </div>
        );
    }

    if (presentationData) {
        const isImageAtt = (a) =>
            (a.type && a.type.includes('image')) ||
            /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(a.url || a.name || '');

        const activeSlides = [];
        items.forEach((item, itemIndex) => {
            if (item.includeInPresentation === false) return;
            const atts = Array.isArray(item.attachments) ? item.attachments : [];
            const imagesWithIndices = atts
                .map((img, attIndex) => ({ img, attIndex }))
                .filter(({img}) => isImageAtt(img) && img.excludeFromPresentation !== true);
                
            imagesWithIndices.forEach(({ img, attIndex }, idx) => {
                activeSlides.push({
                    item,
                    itemIndex,
                    attIndex,
                    img,
                    index: idx + 1,
                    total: imagesWithIndices.length
                });
            });
        });

        let globalAnnCounter = 1;

        return (
            <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', minHeight: '100vh' }}>
                    {/* Cover Slide - 6 lines equivalent */}
                    <div style={{ padding: '20px 40px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', background: '#0f172a', color: 'white' }}>
                        {presentationData.tenant?.logo_url && (
                            <img src={presentationData.tenant.logo_url} alt="Logo" style={{ maxHeight: '40px', marginBottom: '10px' }} />
                        )}
                        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0 0 5px 0' }}>APRESENTAÇÃO DE PROJETO</h1>
                        <h2 style={{ fontSize: '1.1rem', color: '#94a3b8', fontWeight: '500', margin: '0 0 10px 0' }}>{presentationData.partner_name}</h2>
                        
                        {presentationData.expires && (
                            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '5px' }}>
                                Acesso válido até {new Date(presentationData.expires).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                        )}
                    </div>

                    {/* Slides */}
                    {!showNegotiation && activeSlides.length > 0 ? activeSlides.map((slide, idx) => {
                        const annotations = slide.img.annotations || [];
                        const startIndex = globalAnnCounter;
                        globalAnnCounter += annotations.length;
                        const imageId = `${slide.itemIndex}-${slide.attIndex}`;

                        return (
                            <div key={idx} style={{ padding: '40px', borderBottom: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '30px', alignItems: 'start' }}>
                                    
                                    {/* Left Side: Description and Postits */}
                                    <div>
                                        <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#0f172a', margin: '0 0 5px 0' }}>{slide.item.name}</h3>
                                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '20px' }}>Imagem {slide.index} de {slide.total}</span>
                                        
                                        {slide.item.description && (
                                            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '30px', whiteSpace: 'pre-wrap' }}>
                                                {slide.item.description}
                                            </p>
                                        )}

                                        {annotations.length > 0 && (
                                            <div>
                                                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <MessageSquare size={16} /> Anotações
                                                </h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                    {annotations.map((ann, i) => {
                                                        const annNumber = startIndex + i;
                                                        // Only show in sidebar if not currently active on image
                                                        if (ann.id === activeAnnotationId) return null;
                                                        return (
                                                            <div key={ann.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                                <div style={{ 
                                                                    width: '20px', height: '20px', background: '#eab308', color: 'white', 
                                                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0, marginTop: '2px'
                                                                }}>
                                                                    {annNumber}
                                                                </div>
                                                                <div style={{ flex: 1, fontSize: '0.9rem', color: '#334155', wordBreak: 'break-word' }}>
                                                                    {ann.text || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sem texto</span>}
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                                    <button 
                                                                        onClick={() => setActiveAnnotationId(ann.id)}
                                                                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '2px' }}
                                                                        title="Editar anotação"
                                                                    >
                                                                        <FileEdit size={14} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => deleteAnnotation(e, slide.itemIndex, slide.attIndex, ann.id)}
                                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                                                        title="Remover anotação"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Side: Image and Hardware */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div 
                                            onMouseEnter={() => setHoveredImage(imageId)}
                                            onMouseLeave={() => setHoveredImage(null)}
                                            style={{ 
                                                borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', 
                                                background: '#f1f5f9', position: 'relative', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                        >
                                            <div style={{ position: 'relative', cursor: 'crosshair', display: 'inline-block', margin: '0 auto' }} onClick={(e) => handleImageClick(e, slide.itemIndex, slide.attIndex)}>
                                                <img src={slide.img.url} alt={`Slide ${idx+1}`} style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block' }} />
                                            
                                                {/* Subtle Hover Instruction - Only show if no annotations exist on this image */}
                                                <div style={{
                                                    position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
                                                    background: 'rgba(255, 255, 255, 0.9)', color: '#334155', padding: '8px 16px', borderRadius: '20px',
                                                    fontSize: '0.9rem', fontWeight: '600', pointerEvents: 'none',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #cbd5e1',
                                                    opacity: (hoveredImage === imageId && annotations.length === 0) ? 1 : 0,
                                                    transition: 'opacity 0.3s ease', zIndex: 5
                                                }}>
                                                Clique num ponto da imagem para colar um post-it
                                            </div>

                                            {/* Annotations */}
                                            {annotations.map((ann, i) => {
                                                const isActive = ann.id === activeAnnotationId;
                                                return (
                                                    <React.Fragment key={ann.id}>
                                                        {/* The Pin/Marker (Always visible) */}
                                                        <div 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveAnnotationId(isActive ? null : ann.id);
                                                            }}
                                                            style={{
                                                                position: 'absolute',
                                                                left: `${ann.x}%`,
                                                                top: `${ann.y}%`,
                                                                transform: 'translate(-50%, -50%)',
                                                                width: '26px',
                                                                height: '26px',
                                                                background: '#eab308',
                                                                color: '#000',
                                                                borderRadius: '50%',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontWeight: 'bold',
                                                                fontSize: '13px',
                                                                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                                                border: '2px solid #ffffff',
                                                                cursor: 'pointer',
                                                                zIndex: isActive ? 20 : 10,
                                                                transition: 'transform 0.15s ease'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.15)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%)'}
                                                        >
                                                            {startIndex + i}
                                                        </div>

                                                        {/* The Popover / Post-it Editor */}
                                                        {isActive && (() => {
                                                            const isBottom = ann.y > 65;
                                                            let transformX = '-50%';
                                                            if (ann.x < 15) transformX = '-10%';
                                                            else if (ann.x > 85) transformX = '-90%';

                                                            return (
                                                                <div 
                                                                    className="annotation-popup" 
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
                                                                        Anotação #{startIndex + i}
                                                                    </span>
                                                                    <button 
                                                                        onClick={(e) => deleteAnnotation(e, slide.itemIndex, slide.attIndex, ann.id)} 
                                                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                                                        title="Excluir anotação"
                                                                    >
                                                                        <X size={13} />
                                                                    </button>
                                                                </div>
                                                                <textarea
                                                                    value={ann.text}
                                                                    onChange={(e) => updateAnnotationText(slide.itemIndex, slide.attIndex, ann.id, e.target.value)}
                                                                    placeholder="Escreva sua anotação..."
                                                                    style={{ 
                                                                        width: '100%', minHeight: '80px', fontSize: '12px', border: 'none',
                                                                        background: 'transparent', color: '#1c1917', resize: 'none',
                                                                        outline: 'none', fontFamily: 'inherit', lineHeight: '1.4'
                                                                    }}
                                                                />
                                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); setActiveAnnotationId(null); }}
                                                                        style={{ background: '#854d0e', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                    >
                                                                        OK
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            );
                                                        })()}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    
                                    {/* Thumbnails under the image container */}
                                    {(() => {
                                        const rawProducts = (slide.item.products || []).filter(p => 
                                            (p.product?.group_name === 'Ferragens' || p.product?.group_name === 'MDFs' || p.product?.group_name === 'Vidros') && p.product?.photo
                                        );
                                        
                                        // Deduplicate by product ID so we only show 1 image of each MDF or Hardware
                                        const uniqueProductsMap = new Map();
                                        rawProducts.forEach(p => {
                                            if (p.product && !uniqueProductsMap.has(p.product.id)) {
                                                uniqueProductsMap.set(p.product.id, p);
                                            }
                                        });
                                        const displayProducts = Array.from(uniqueProductsMap.values());
                                        
                                        if (displayProducts.length === 0) return null;

                                        return (
                                            <div style={{ marginTop: '20px' }}>
                                                <h4 style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>Materiais e Acessórios:</h4>
                                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                    {displayProducts.map((hp, hIdx) => {
                                                        const uniqueKey = `${slide.itemIndex}-${slide.attIndex}-${hp.product.id}`;
                                                        const isHovered = hoveredHardware === uniqueKey;
                                                        
                                                        return (
                                                            <div 
                                                                key={hIdx} 
                                                                style={{ position: 'relative', display: 'inline-block' }}
                                                                onMouseEnter={() => setHoveredHardware(uniqueKey)}
                                                                onMouseLeave={() => setHoveredHardware(null)}
                                                            >
                                                                <img 
                                                                    src={hp.product.photo} 
                                                                    alt={hp.product.name} 
                                                                    style={{ 
                                                                        width: '50px', height: '50px', objectFit: 'cover', 
                                                                        borderRadius: '6px', border: '1px solid #e2e8f0', 
                                                                        cursor: 'pointer', transition: 'transform 0.2s',
                                                                        transform: isHovered ? 'scale(1.05)' : 'scale(1)'
                                                                    }} 
                                                                />
                                                                
                                                                {/* Tooltip on hover */}
                                                                {isHovered && (
                                                                    <div style={{
                                                                        position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
                                                                        background: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                                                        zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'max-content', maxWidth: '250px',
                                                                        border: '1px solid #e2e8f0'
                                                                    }}>
                                                                        <img src={hp.product.photo} alt={hp.product.name} style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', marginBottom: '10px', borderRadius: '4px' }} />
                                                                        <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '600', textAlign: 'center', lineHeight: '1.2' }}>{hp.product.name}</span>
                                                                        
                                                                        {/* Tooltip Triangle */}
                                                                        <div style={{
                                                                            position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                                                                            width: '12px', height: '12px', background: 'white', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0'
                                                                        }}></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    
                                    </div>
                                    {/* END RIGHT SIDE */}
                                </div>
                            </div>
                        );
                    }) : null}

                    {/* Negotiation Screen */}
                    {showNegotiation && (
                        <div style={{ padding: '40px', background: 'white' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <ClipboardCheck size={24} color="#10b981" /> Escolha a Forma de Pagamento
                                </h3>
                                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#10b981' }}>
                                    {maskCurrency(grandTotal)}
                                </div>
                            </div>
                            <p style={{ color: '#475569', marginBottom: '30px', fontSize: '1.1rem' }}>
                                Selecione uma das opções abaixo para concluir a aprovação do projeto.
                            </p>

                            {activeMethod ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                                    {conditions.length === 0 && (
                                        <div style={{ padding: '15px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', gridColumn: '1 / -1' }}>
                                            Nenhuma condição de pagamento foi cadastrada para a forma "{activeMethod.name}".
                                        </div>
                                    )}
                                    {conditions.map((cond, idx) => {
                                        const { installments, isAVista, totalDiscountPct, financedTotal, downPct, downValue, installAmt } = calcCondition(cond);
                                        const isSelected = selectedCondIdx === idx;
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => handleSelectCondition(cond, idx)}
                                                style={{
                                                    border: '2px solid',
                                                    borderColor: isSelected ? '#10b981' : '#e2e8f0',
                                                    borderRadius: '12px',
                                                    padding: '20px',
                                                    background: isSelected ? 'rgba(16, 185, 129, 0.05)' : 'white',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    boxShadow: isSelected ? '0 10px 25px rgba(16, 185, 129, 0.15)' : 'none'
                                                }}
                                            >
                                                <div style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', marginBottom: '10px', letterSpacing: '0.5px' }}>
                                                    Opção {idx + 1}{cond.title ? ` - ${cond.title}` : ''}
                                                </div>
                                                <div style={{ fontSize: '16px', fontWeight: '800', color: isSelected ? '#10b981' : '#0f172a', borderTop: '1px solid #e2e8f0', paddingTop: '10px', lineHeight: '1.6' }}>
                                                    {isAVista ? (
                                                        `À vista: ${maskCurrency(financedTotal)}`
                                                    ) : downPct > 0 ? (
                                                        <>
                                                            <div>Entrada {downPct}%: <span style={{ color: isSelected ? '#10b981' : '#3b82f6' }}>{maskCurrency(downValue)}</span></div>
                                                            <div>+ {installments}x de <span style={{ color: isSelected ? '#10b981' : '#3b82f6' }}>{maskCurrency(installAmt)}</span></div>
                                                        </>
                                                    ) : (
                                                        `${installments}x de ${maskCurrency(installAmt)}`
                                                    )}
                                                </div>
                                                {totalDiscountPct > 0 && (
                                                    <div style={{ fontSize: '13px', color: '#16a34a', fontWeight: '700', marginTop: '8px' }}>
                                                        Desconto: {totalDiscountPct.toFixed(2)}%
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px' }}>
                                    {presentationData?.payment_methods === undefined ? (
                                        <>
                                            Por favor, recarregue a página para carregar as formas de pagamento. (Pressione F5)
                                        </>
                                    ) : (
                                        <>Nenhuma forma de pagamento configurada no momento.</>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {!showNegotiation && activeSlides.length === 0 && (
                        <div style={{ padding: '80px 40px', textAlign: 'center' }}>
                            <Image size={48} style={{ color: '#cbd5e1', margin: '0 auto 20px auto' }} />
                            <h3 style={{ fontSize: '1.2rem', color: '#64748b' }}>Nenhuma imagem incluída nesta apresentação.</h3>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ padding: '30px', display: 'flex', justifyContent: 'center', gap: '20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {hasAnyAnnotations() ? (
                            <button 
                                onClick={() => handleSubmitFeedback('Encaminhar para revisão')}
                                disabled={submitting || activeAnnotationId}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                                    background: '#eab308', color: 'white', border: 'none', borderRadius: '8px',
                                    fontSize: '1rem', fontWeight: 'bold', cursor: (submitting || activeAnnotationId) ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 10px rgba(234, 179, 8, 0.3)', opacity: activeAnnotationId ? 0.5 : 1
                                }}
                            >
                                {submitting ? <Loader2 size={18} className="spin" /> : <FileEdit size={18} />}
                                Encaminhar para revisão
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleSubmitFeedback('Aprovar')}
                                disabled={submitting || activeAnnotationId}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                                    background: '#10b981', color: 'white', border: 'none', borderRadius: '8px',
                                    fontSize: '1rem', fontWeight: 'bold', cursor: (submitting || activeAnnotationId) ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)', opacity: activeAnnotationId ? 0.5 : 1
                                }}
                            >
                                {submitting ? <Loader2 size={18} className="spin" /> : <Check size={18} />}
                                {showNegotiation ? 'Confirmar Fechamento' : 'Aprovar Projeto'}
                            </button>
                        )}
                        {showNegotiation && (
                            <button 
                                onClick={() => setShowNegotiation(false)}
                                disabled={submitting}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                                    background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px',
                                    fontSize: '1rem', fontWeight: 'bold', cursor: submitting ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Voltar
                            </button>
                        )}
                        {!showNegotiation && (
                            <button 
                                onClick={() => window.location.href = getWebsiteUrl()}
                                disabled={submitting}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                                    background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px',
                                    fontSize: '1rem', fontWeight: 'bold', cursor: submitting ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <X size={18} />
                                Fechar
                            </button>
                        )}
                    </div>

                    {/* Closing Slide */}
                    <div style={{ padding: '30px 40px', textAlign: 'center', background: '#0f172a', color: 'white' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '10px' }}>Agradecemos a Parceria!</h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto 20px auto', lineHeight: '1.4' }}>
                            Estamos comprometidos em transformar seu espaço com o máximo de excelência, sofisticação e cuidado.
                        </p>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '30px', borderTop: '1px solid #334155', paddingTop: '20px' }}>
                            {presentationData.creator?.name && (
                                <div style={{ textAlign: 'left' }}>
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Responsável</span>
                                    <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>{presentationData.creator.name}</span>
                                </div>
                            )}
                            {presentationData.creator?.phone && (
                                <div style={{ textAlign: 'left' }}>
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Telefone</span>
                                    <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>{presentationData.creator.phone}</span>
                                </div>
                            )}
                            {presentationData.creator?.email && (
                                <div style={{ textAlign: 'left' }}>
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>E-mail</span>
                                    <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>{presentationData.creator.email}</span>
                                </div>
                            )}
                            {presentationData.tenant?.website && (
                                <div style={{ textAlign: 'left' }}>
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Website</span>
                                    <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>{presentationData.tenant.website}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ 
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: '#0b0f19',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{ 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '40px',
                borderRadius: '16px',
                maxWidth: '400px',
                width: '90%',
                textAlign: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
            }}>
                <div style={{ 
                    width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto'
                }}>
                    <Lock size={28} color="#10b981" />
                </div>
                
                <h2 style={{ color: 'white', fontSize: '1.4rem', fontWeight: '700', marginBottom: '8px' }}>Acesso à Apresentação</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '30px' }}>
                    Por favor, insira o token de 6 caracteres fornecido pelo seu atendente para visualizar o projeto.
                </p>

                {error && (
                    <div style={{ 
                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', 
                        padding: '12px', borderRadius: '8px', marginBottom: '20px', color: '#fca5a5',
                        fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '10px', textAlign: 'left'
                    }}>
                        <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleVerifyToken}>
                    <input 
                        type="text" 
                        value={token}
                        onChange={(e) => setToken(e.target.value.toUpperCase())}
                        placeholder="Ex: A8B2C9"
                        maxLength={6}
                        style={{ 
                            width: '100%', padding: '14px', fontSize: '1.2rem', textAlign: 'center',
                            background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', color: 'white', letterSpacing: '4px', fontWeight: 'bold',
                            marginBottom: '20px', outline: 'none'
                        }}
                    />
                    
                    <button 
                        type="submit"
                        disabled={loading || token.length < 6}
                        style={{ 
                            width: '100%', padding: '14px', fontSize: '1rem', fontWeight: '700',
                            background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                            border: 'none', borderRadius: '8px', cursor: (loading || token.length < 6) ? 'not-allowed' : 'pointer',
                            opacity: (loading || token.length < 6) ? 0.6 : 1,
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {loading ? <Loader2 size={20} className="spin" /> : 'Acessar Apresentação'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PublicPresentationView;
