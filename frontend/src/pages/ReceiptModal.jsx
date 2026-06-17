import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { X, Printer } from 'lucide-react';

const maskCurrency = (v) => {
    if (!v && v !== 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

const formatDoc = (doc) => {
    if (!doc) return '';
    const d = doc.replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return doc;
};

const formatCep = (cep) => {
    if (!cep) return '';
    const c = cep.replace(/\D/g, '');
    return c.length === 8 ? c.replace(/(\d{5})(\d{3})/, '$1-$2') : cep;
};

const numExtenso = (num) => {
    if (!num || num === 0) return 'zero';
    const n = Math.round(num * 100) / 100;
    const intPart = Math.floor(n);
    const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
        'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
        'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    const toWords = (n) => {
        if (n === 0) return '';
        if (n === 100) return 'cem';
        if (n < 20) return units[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' e ' + units[n % 10] : '');
        return hundreds[Math.floor(n / 100)] + (n % 100 ? ' e ' + toWords(n % 100) : '');
    };
    let result = '';
    if (intPart >= 1000000) result += toWords(Math.floor(intPart / 1000000)) + ' milhão' + (intPart >= 2000000 ? 'ões' : '') + ' ';
    if (intPart % 1000000 >= 1000) result += toWords(Math.floor((intPart % 1000000) / 1000)) + ' mil ';
    if (intPart % 1000 > 0) result += toWords(intPart % 1000);
    const cents = Math.round((n - intPart) * 100);
    if (cents > 0) result += (intPart > 0 ? ' e ' : '') + toWords(cents) + (cents === 1 ? ' centavo' : ' centavos');
    return result.trim() || 'zero';
};

const ReceiptModal = ({ flow, onClose }) => {
    const [partner, setPartner] = useState(null);
    const [tenant, setTenant] = useState(null);
    const [myProfile, setMyProfile] = useState(null);
    const [applySignature, setApplySignature] = useState(false);
    const [loading, setLoading] = useState(true);
    const printRef = useRef(null);

    useEffect(() => {
        if (!flow) return;
        const load = async () => {
            setLoading(true);
            try {
                const [settingsRes, profileRes] = await Promise.all([
                    api.get('/settings'),
                    api.get('/profile').catch(() => null)
                ]);
                setTenant(settingsRes.data?.tenant || null);
                if (profileRes) setMyProfile(profileRes.data);

                let partnerId = null;
                if (flow.proposal_id) {
                    const proposalRes = await api.get(`/proposals/${flow.proposal_id}`);
                    const prop = proposalRes.data;
                    if (prop && prop.partner_id) {
                        partnerId = prop.partner_id;
                    }
                } else if (flow.partner_id) {
                    partnerId = flow.partner_id;
                }

                if (partnerId) {
                    const partnersRes = await api.get('/partners');
                    const found = partnersRes.data.find(p => p.id === parseInt(partnerId, 10) || p.id === partnerId);
                    setPartner(found || null);
                }
            } catch (e) {
                console.error('Error loading receipt data:', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [flow]);

    if (!flow) return null;

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const formattedDate = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const titleString = `RECIBO_${flow.id}_${formattedDate}`;
        const win = window.open('', '_blank', 'width=850,height=600');
        win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>${titleString}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background: #fff; padding: 40px; }
  .receipt-container { border: 2.5px solid #1a1a1a; border-radius: 8px; padding: 30px; position: relative; }
  .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 25px; }
  .company-info { display: flex; flex-direction: column; gap: 4px; }
  .company-logo { max-height: 55px; max-width: 220px; object-fit: contain; margin-bottom: 8px; display: block; }
  .company-name { font-size: 14pt; font-weight: 900; color: #1a1a1a; text-transform: uppercase; }
  .company-details { font-size: 9.5pt; color: #555; }
  .receipt-title-box { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
  .receipt-title { font-size: 20pt; font-weight: 900; letter-spacing: 1px; color: #1a1a1a; }
  .receipt-number { font-size: 11pt; font-weight: 700; color: #444; }
  .value-box { background: #f0f0f0; border: 2px solid #1a1a1a; padding: 10px 25px; font-size: 16pt; font-weight: 900; border-radius: 4px; display: inline-block; margin-top: 5px; }
  .receipt-body { font-size: 11pt; line-height: 1.8; text-align: justify; margin-bottom: 40px; }
  .receipt-body strong { font-weight: 700; color: #000; }
  .signatures-section { display: flex; flex-direction: column; align-items: center; margin-top: 50px; }
  .date-location { font-size: 11pt; font-weight: 600; margin-bottom: 45px; text-transform: uppercase; }
  .sig-line-container { width: 350px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; min-height: 100px; }
  .sig-line { border-top: 1.5px solid #1a1a1a; margin-bottom: 8px; width: 100%; }
  .sig-name { font-weight: 700; font-size: 10pt; text-transform: uppercase; }
  .sig-role { font-size: 9pt; color: #555; }
</style>
</head>
<body>
${content.innerHTML}
</body>
</html>`);
        win.document.close();

        const imgs = win.document.querySelectorAll('img');
        if (imgs.length > 0) {
            let loaded = 0;
            const checkLoad = () => {
                loaded++;
                if (loaded === imgs.length) {
                    setTimeout(() => {
                        win.focus();
                        win.print();
                    }, 500);
                }
            };
            imgs.forEach(img => {
                if (img.complete) {
                    checkLoad();
                } else {
                    img.addEventListener('load', checkLoad);
                    img.addEventListener('error', checkLoad);
                }
            });
            setTimeout(() => {
                if (loaded < imgs.length) {
                    win.focus();
                    win.print();
                }
            }, 5000);
        } else {
            setTimeout(() => {
                win.focus();
                win.print();
            }, 500);
        }
    };

    const tenantAddress = tenant
        ? `${tenant.address || ''}${tenant.address_num ? ', ' + tenant.address_num : ''}${tenant.address_complement ? ' ' + tenant.address_complement : ''}${tenant.address_neighborhood ? ' - ' + tenant.address_neighborhood : ''}${tenant.address_cep ? ' - CEP ' + formatCep(tenant.address_cep) : ''}${tenant.address_city ? ' - ' + tenant.address_city : ''}${tenant.address_state ? '/' + tenant.address_state : ''}`
        : '';

    const partnerAddress = partner
        ? `${partner.address || ''}${partner.address_num ? ', ' + partner.address_num : ''}${partner.address_complement ? ', ' + partner.address_complement : ''}${partner.address_neighborhood ? ' - ' + partner.address_neighborhood : ''}${partner.address_cep ? ' - CEP ' + formatCep(partner.address_cep) : ''}${partner.address_city ? ' - ' + partner.address_city : ''}${partner.address_city && partner.address_state ? '/' + partner.address_state : ''}`
        : '';

    const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const city = tenant?.address_city || partner?.address_city || 'Belém';

    return createPortal(
        <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ width: '800px', maxWidth: '96vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}
            >
                <div style={{ color: '#fff', fontWeight: '700', fontSize: '1rem' }}>
                    📄 Recibo de Pagamento #{flow.id}
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    {myProfile?.signature_url && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '0.88rem', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                                type="checkbox" 
                                checked={applySignature} 
                                onChange={e => setApplySignature(e.target.checked)} 
                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                            Assinar Documento
                        </label>
                    )}
                    <button
                        onClick={handlePrint}
                        disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(16,185,129,0.4)' }}
                    >
                        <Printer size={16} /> Imprimir / Salvar PDF
                    </button>
                    <button
                        onClick={onClose}
                        style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}
                    >
                        ✕ Fechar
                    </button>
                </div>
            </div>

            <div
                onClick={e => e.stopPropagation()}
                style={{ width: '800px', maxWidth: '96vw', background: '#fff', borderRadius: '8px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', padding: '40px', color: '#1a1a1a', overflowY: 'auto', maxHeight: '80vh' }}
            >
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Carregando dados do recibo...</div>
                ) : (
                    <div ref={printRef}>
                        <div className="receipt-container" style={{ border: '2.5px solid #1a1a1a', borderRadius: '8px', padding: '30px' }}>
                            <div className="receipt-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '20px', marginBottom: '25px' }}>
                                <div className="company-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {tenant?.logo_url ? (
                                        <img className="company-logo" src={tenant.logo_url} alt="Logo" style={{ maxHeight: '55px', maxWidth: '220px', objectFit: 'contain', display: 'block' }} />
                                    ) : (
                                        <>
                                            <div className="company-name" style={{ fontSize: '14pt', fontWeight: '900', color: '#1a1a1a', textTransform: 'uppercase' }}>
                                                {tenant?.name || 'EZATTUS PLANEJADOS'}
                                            </div>
                                            <div className="company-details" style={{ fontSize: '9.5pt', color: '#555' }}>
                                                {tenant?.cnpj && `CNPJ: ${formatDoc(tenant.cnpj)}`}
                                                {tenant?.phone && ` | Tel: ${tenant.phone}`}
                                                {tenantAddress && <div style={{ marginTop: '2px' }}>{tenantAddress}</div>}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="receipt-title-box" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '4px' }}>
                                    <div className="receipt-title" style={{ fontSize: '20pt', fontWeight: '900', letterSpacing: '1px', color: '#1a1a1a' }}>
                                        RECIBO
                                    </div>
                                    <div className="receipt-number" style={{ fontSize: '11pt', fontWeight: '700', color: '#444' }}>
                                        Nº {flow.id}
                                    </div>
                                    <div className="value-box" style={{ background: '#f0f0f0', border: '2px solid #1a1a1a', padding: '8px 20px', fontSize: '16pt', fontWeight: '900', borderRadius: '4px', marginTop: '5px' }}>
                                        {maskCurrency(flow.value)}
                                    </div>
                                </div>
                            </div>

                             <div className="receipt-body" style={{ fontSize: '11pt', lineHeight: '1.8', textAlign: 'justify', marginBottom: '40px' }}>
                                Recebemos de <strong>{partner?.name || flow.partner_name || '—'}</strong>
                                {partner?.document && <>, inscrito(a) no CPF/CNPJ sob o nº <strong>{formatDoc(partner.document)}</strong></>}
                                {partnerAddress && <>, residente em <strong>{partnerAddress}</strong></>}
                                , a importância de <strong>{maskCurrency(flow.value)}</strong> (<strong>{numExtenso(flow.value)}</strong>)
                                , referente a <strong>{flow.title}</strong>
                                {flow.payment_date && <>, pago em <strong>{new Date(flow.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></>}.
                                {flow.description && (
                                    <div style={{ marginTop: '15px' }}>
                                        <strong>Anotação: </strong>{flow.description}
                                    </div>
                                )}
                                <div style={{ marginTop: '15px' }}>
                                    Para maior clareza e firmeza do que foi recebido, firmamos o presente recibo.
                                </div>
                            </div>

                            <div className="signatures-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '50px' }}>
                                <div className="date-location" style={{ fontSize: '11pt', fontWeight: '600', marginBottom: '45px', textTransform: 'uppercase' }}>
                                    {city}, {today}
                                </div>
                                <div className="sig-line-container" style={{ width: '350px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', minHeight: '100px' }}>
                                    {applySignature && myProfile?.signature_url && (
                                        <img src={myProfile.signature_url} alt="Assinatura" style={{ maxHeight: '65px', maxWidth: '250px', objectFit: 'contain', marginBottom: '5px' }} />
                                    )}
                                    <div className="sig-line" style={{ borderTop: '1.5px solid #1a1a1a', marginBottom: '8px', width: '100%' }}></div>
                                    <div className="sig-name" style={{ fontWeight: '700', fontSize: '10pt', textTransform: 'uppercase' }}>
                                        {tenant?.name || 'EZATTUS PLANEJADOS'}
                                    </div>
                                    {tenant?.cnpj && <div className="sig-role" style={{ fontSize: '9pt', color: '#555' }}>CNPJ: {formatDoc(tenant.cnpj)}</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ReceiptModal;
