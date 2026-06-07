import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';

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
    // Simple extension for common values — fallback to formatted number
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

// ── ContractModal ─────────────────────────────────────────────────────────────
const ContractModal = ({ proposal, settings: settingsProp, onClose }) => {
    const [partner, setPartner] = useState(null);
    const [tenant, setTenant] = useState(null);
    const [financialFlows, setFinancialFlows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [contractNum, setContractNum] = useState('');
    const printRef = useRef(null);

    useEffect(() => {
        if (!proposal) return;
        const load = async () => {
            setLoading(true);
            try {
                const [partnerRes, settingsRes, flowsRes] = await Promise.all([
                    api.get(`/partners`),
                    api.get('/settings'),
                    api.get(`/financial-flows?proposal_id=${proposal.id}`).catch(() => ({ data: [] }))
                ]);
                const found = partnerRes.data.find(p => p.id === proposal.partner_id) || null;
                setPartner(found);
                setTenant(settingsRes.data?.tenant || null);

                // Filter flows by proposal (API may not support query param - filter client-side)
                const allFlows = Array.isArray(flowsRes.data) ? flowsRes.data : [];
                setFinancialFlows(allFlows.filter(f => f.proposal_id === proposal.id || !f.proposal_id));

                const year = new Date(proposal.created_at || new Date()).getFullYear();
                setContractNum(`${year}${String(proposal.id).padStart(3, '0')}`);
            } catch (e) {
                console.error('ContractModal load error:', e);
            }
            setLoading(false);
        };
        load();
    }, [proposal]);

    if (!proposal) return null;

    let budgetItems = [];
    try { budgetItems = proposal.budget_data ? JSON.parse(proposal.budget_data) : []; } catch(e) {}

    const isImageAtt = (a) =>
        (a.type && a.type.includes('image')) ||
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(a.url || a.name || '');

    const presentationImages = budgetItems.flatMap(item => {
        if (item.includeInPresentation === false) return [];
        const atts = Array.isArray(item.attachments)
            ? item.attachments
            : (typeof item.attachments === 'string' ? (() => { try { return JSON.parse(item.attachments); } catch { return []; } })() : []);
        return atts.filter(img => isImageAtt(img) && img.excludeFromPresentation !== true).map(img => ({
            ...img,
            itemName: item.name
        }));
    });

    const { taxes = 0, markup = 0, financeCost = 0 } = settingsProp || {};
    const comm = proposal.referrer_commission || 0;
    const divisor = 1 - (taxes/100) - (markup/100) - (financeCost/100) - (comm/100);
    const calcSalePrice = (cost) => divisor > 0 ? cost / divisor : 0;
    const grandTotal = budgetItems.reduce((acc, item) => {
        const cost = item.products.reduce((s, p) => s + (p.total || 0), 0);
        return acc + calcSalePrice(cost);
    }, 0);

    // Payment rows — prefer financial_flows, fallback to parsing payment_notes text
    const paymentRows = (() => {
        const flows = financialFlows.filter(f => String(f.proposal_id) === String(proposal.id) && f.type === 'CREDITO');
        if (flows.length > 0) {
            return flows.map(f => ({
                title: f.title,
                value: f.value,
                date: f.due_date ? new Date(f.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-',
                note: f.note || ''
            }));
        }
        // Parse payment_notes as lines: "Parcela 1 | R$ x | dd/mm/yyyy"
        const lines = (proposal.payment_notes || '').split('\n').filter(l => l.includes('|'));
        if (lines.length > 0) {
            return lines.map(l => {
                const [title, value, date, note] = l.split('|').map(s => s.trim());
                return { title: title || '', value: value || '', date: date || '', note: note || '' };
            });
        }
        return [];
    })();

    const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const city = tenant?.address_city || partner?.address_city || 'Belém';

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const formattedDate = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const formattedClientName = proposal.partner_name.toUpperCase().replace(/\s+/g, '_');
        const titleString = `CONTRATO_${contractNum}_${formattedDate}_${formattedClientName}`;
        const win = window.open('', '_blank', 'width=900,height=700');
        win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>${titleString}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background: #fff; }
  @page { size: A4 portrait; margin: 18mm 20mm 18mm 20mm; }
  .contract-header { text-align: center; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 3px solid #1a1a1a; }
  .contract-header .company-name { font-size: 22pt; font-weight: 900; letter-spacing: 2px; color: #1a1a1a; }
  .contract-header .contract-title { font-size: 13pt; font-weight: 700; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px; }
  .contract-header .contract-num { font-size: 10pt; color: #555; margin-top: 4px; }
  .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .party-box { border: 1.5px solid #1a1a1a; border-radius: 6px; overflow: hidden; }
  .party-box .party-header { background: #1a1a1a; color: #fff; font-weight: 700; font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; padding: 6px 12px; }
  .party-box .party-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; font-size: 9.5pt; }
  .party-row { display: flex; gap: 6px; }
  .party-label { font-weight: 600; color: #444; min-width: 55px; }
  .intro-text { font-size: 10pt; line-height: 1.65; margin-bottom: 20px; text-align: justify; }
  .section-title { font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 10px 0; padding: 6px 10px; background: #f0f0f0; border-left: 4px solid #1a1a1a; }
  .clause { font-size: 10pt; line-height: 1.65; margin-bottom: 10px; text-align: justify; }
  .clause strong { font-weight: 700; }
  .clause .num { font-weight: 700; }
  .items-table { width: 100%; border-collapse: collapse; margin: 12px 0 16px 0; font-size: 9.5pt; }
  .items-table th { background: #1a1a1a; color: #fff; padding: 7px 10px; font-weight: 700; text-align: left; font-size: 9pt; }
  .items-table td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
  .items-table tr:nth-child(even) td { background: #f8f8f8; }
  .items-table .desc { font-size: 8.5pt; color: #555; margin-top: 2px; }
  .payment-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9.5pt; }
  .payment-table th { background: #1a1a1a; color: #fff; padding: 7px 10px; font-weight: 700; text-align: left; }
  .payment-table td { padding: 7px 10px; border-bottom: 1px solid #e0e0e0; }
  .payment-table tr:nth-child(even) td { background: #f8f8f8; }
  .total-row td { font-weight: 800; font-size: 11pt; border-top: 2px solid #1a1a1a; background: #f0f0f0 !important; }
  .payment-obs { font-size: 9pt; color: #444; margin-top: 8px; font-style: italic; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
  .sig-box { text-align: center; }
  .sig-line { border-top: 1.5px solid #1a1a1a; margin-bottom: 6px; }
  .sig-name { font-weight: 700; font-size: 10pt; }
  .sig-role { font-size: 9pt; color: #555; }
  .witnesses { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; }
  .city-date { text-align: center; margin: 28px 0 0 0; font-size: 10pt; font-weight: 600; }
  .footer-line { border-top: 1px solid #ccc; margin-top: 12px; padding-top: 8px; text-align: center; font-size: 8pt; color: #888; }
  .page-break { page-break-before: always; }
  h1,h2,h3,h4 { font-family: 'Inter', Arial, sans-serif; }
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
            // Fallback timeout in case image loading hangs
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
        ? `${tenant.address || ''}${tenant.address_num ? ', ' + tenant.address_num : ''}${tenant.address_complement ? ' ' + tenant.address_complement : ''} — CEP ${formatCep(tenant.address_cep)}, ${tenant.address_city || ''}${tenant.address_state ? '/' + tenant.address_state : ''}`
        : '';

    const partnerAddress = partner
        ? `${partner.address || ''}${partner.address_num ? ', ' + partner.address_num : ''}${partner.address_complement ? ', ' + partner.address_complement : ''}`
        : proposal.partner_name || '';

    const partnerCityState = partner
        ? `${partner.address_city || ''}${partner.address_cep ? ' — CEP ' + formatCep(partner.address_cep) : ''}`
        : '';

    return createPortal(
        <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', overflowY: 'auto', padding: '20px 0' }}
        >
            {/* Top bar with actions */}
            <div
                onClick={e => e.stopPropagation()}
                style={{ width: '860px', maxWidth: '96vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}
            >
                <div style={{ color: '#fff', fontWeight: '700', fontSize: '1rem' }}>
                    📄 Contrato #{contractNum}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handlePrint}
                        style={{ padding: '10px 22px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(16,185,129,0.4)' }}
                    >
                        🖨️ Imprimir / Salvar PDF
                    </button>
                    <button
                        onClick={onClose}
                        style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}
                    >
                        ✕ Fechar
                    </button>
                </div>
            </div>

            {/* Contract Paper */}
            <div
                onClick={e => e.stopPropagation()}
                ref={printRef}
                style={{ width: '860px', maxWidth: '96vw', background: '#fff', borderRadius: '8px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', padding: '48px 56px', color: '#1a1a1a', fontFamily: "'Inter', Arial, sans-serif", fontSize: '11pt', lineHeight: '1.65' }}
            >
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Carregando dados do contrato...</div>
                ) : (
                    <>
                    {/* ── HEADER ────────────────────────────────────────────── */}
                    <div className="contract-header" style={{ textAlign: 'center', marginBottom: '28px', paddingBottom: '16px', borderBottom: '3px solid #1a1a1a' }}>
                        <div style={{ fontSize: '22pt', fontWeight: '900', letterSpacing: '2px', color: '#1a1a1a' }}>
                            {tenant?.name || 'EZATTUS PLANEJADOS'}
                        </div>
                        <div style={{ fontSize: '11pt', color: '#555', marginTop: '2px' }}>
                            CNPJ: {formatDoc(tenant?.cnpj)} &nbsp;|&nbsp; {tenantAddress}
                        </div>
                        <div style={{ fontSize: '14pt', fontWeight: '700', marginTop: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Contrato de Compra e Venda de Móveis Sob Medida
                        </div>
                        <div style={{ fontSize: '10pt', fontWeight: '600', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#444' }}>
                            com Reserva de Domínio
                        </div>
                        <div style={{ fontSize: '10pt', color: '#777', marginTop: '6px' }}>
                            Contrato Nº: <strong>{contractNum}</strong>
                        </div>
                    </div>

                    {/* ── PARTIES ────────────────────────────────────────────── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        {/* CONTRATANTE */}
                        <div style={{ border: '1.5px solid #1a1a1a', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ background: '#1a1a1a', color: '#fff', fontWeight: '700', fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', padding: '6px 12px' }}>Contratante</div>
                            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9.5pt' }}>
                                <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: '700', minWidth: '65px', color: '#444' }}>Nome:</span><span>{partner?.name || proposal.partner_name || '—'}</span></div>
                                <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: '700', minWidth: '65px', color: '#444' }}>CPF/CNPJ:</span><span>{formatDoc(partner?.document) || '—'}</span></div>
                                <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: '700', minWidth: '65px', color: '#444' }}>Endereço:</span><span>{partnerAddress || '—'}</span></div>
                                {partnerCityState && <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: '700', minWidth: '65px', color: '#444' }}>Cidade:</span><span>{partnerCityState}</span></div>}
                                {partner?.email && <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: '700', minWidth: '65px', color: '#444' }}>E-mail:</span><span>{partner.email}</span></div>}
                                {partner?.phone && <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: '700', minWidth: '65px', color: '#444' }}>Telefone:</span><span>{partner.phone}</span></div>}
                            </div>
                        </div>

                        {/* CONTRATADO */}
                        <div style={{ border: '1.5px solid #1a1a1a', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ background: '#1a1a1a', color: '#fff', fontWeight: '700', fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', padding: '6px 12px' }}>Contratado</div>
                            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9.5pt' }}>
                                <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: '700', minWidth: '65px', color: '#444' }}>Razão Social:</span><span>{tenant?.name || '—'}</span></div>
                                <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: '700', minWidth: '65px', color: '#444' }}>CNPJ:</span><span>{formatDoc(tenant?.cnpj) || '—'}</span></div>
                                <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: '700', minWidth: '65px', color: '#444' }}>Endereço:</span><span>{tenantAddress || '—'}</span></div>
                                {tenant?.phone && <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: '700', minWidth: '65px', color: '#444' }}>Telefone:</span><span>{tenant.phone}</span></div>}
                            </div>
                        </div>
                    </div>

                    {/* ── INTRO ────────────────────────────────────────────── */}
                    <p style={{ fontSize: '10pt', lineHeight: '1.65', marginBottom: '20px', textAlign: 'justify' }}>
                        As partes acima identificadas têm entre si, justo e acertado o presente Contrato de Compra e Venda de Móveis Sob Medida com Reserva de Domínio, que se regerá pelas cláusulas seguintes e pelas condições descritas abaixo, que livremente pactuam e aceitam.
                    </p>

                    {/* ── SECTION 1: OBJETO ──────────────────────────────── */}
                    <div style={{ fontSize: '11pt', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', margin: '20px 0 10px 0', padding: '6px 10px', background: '#f0f0f0', borderLeft: '4px solid #1a1a1a' }}>
                        1 — Do Objeto do Contrato
                    </div>

                    <p style={{ fontSize: '10pt', lineHeight: '1.65', marginBottom: '10px', textAlign: 'justify' }}>
                        <strong>Cláusula 1ª.</strong> O presente contrato tem como OBJETO a compra e venda de móveis sob medida 100% MDF, que serão fabricados e instalados pelo CONTRATADO, de acordo com o projeto gráfico apresentado e previamente aprovado pelo CONTRATANTE, o qual, após assinado, integra o presente Contrato para todos os efeitos legais.
                    </p>

                    <p style={{ fontSize: '10pt', lineHeight: '1.65', marginBottom: '8px', textAlign: 'justify' }}>
                        <strong>Parágrafo Primeiro:</strong> Os itens objeto deste contrato são:
                    </p>

                    {/* Items table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0 16px 0', fontSize: '9.5pt' }}>
                        <thead>
                            <tr>
                                <th style={{ background: '#1a1a1a', color: '#fff', padding: '7px 10px', fontWeight: '700', textAlign: 'left', fontSize: '9pt', width: '32px' }}>#</th>
                                <th style={{ background: '#1a1a1a', color: '#fff', padding: '7px 10px', fontWeight: '700', textAlign: 'left', fontSize: '9pt' }}>Item / Ambiente</th>
                                <th style={{ background: '#1a1a1a', color: '#fff', padding: '7px 10px', fontWeight: '700', textAlign: 'left', fontSize: '9pt' }}>Descrição</th>
                                <th style={{ background: '#1a1a1a', color: '#fff', padding: '7px 10px', fontWeight: '700', textAlign: 'right', fontSize: '9pt', width: '110px' }}>Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {budgetItems.length === 0 ? (
                                <tr><td colSpan="4" style={{ padding: '12px 10px', textAlign: 'center', color: '#888' }}>Nenhum item no orçamento.</td></tr>
                            ) : budgetItems.map((item, i) => {
                                const cost = item.products.reduce((s, p) => s + (p.total || 0), 0);
                                const price = calcSalePrice(cost);
                                return (
                                    <tr key={i}>
                                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #e0e0e0', background: i % 2 === 0 ? '#fff' : '#f8f8f8', fontWeight: '700', fontSize: '9pt' }}>{i + 1}</td>
                                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #e0e0e0', background: i % 2 === 0 ? '#fff' : '#f8f8f8', fontWeight: '700' }}>{item.name}</td>
                                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #e0e0e0', background: i % 2 === 0 ? '#fff' : '#f8f8f8', fontSize: '8.5pt', color: '#444' }}>
                                            <div style={{ whiteSpace: 'pre-wrap', fontWeight: '500' }}>{item.description || '—'}</div>
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
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                                        {displayProducts.map((hp, hIdx) => (
                                                            <div key={hIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '4px' }}>
                                                                <img 
                                                                    src={hp.product.photo} 
                                                                    alt={hp.product.name} 
                                                                    title={hp.product.name}
                                                                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '2px' }} 
                                                                />
                                                                <span style={{ fontSize: '7pt', color: '#666', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                                    {hp.product.name}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #e0e0e0', background: i % 2 === 0 ? '#fff' : '#f8f8f8', fontWeight: '700', textAlign: 'right', whiteSpace: 'nowrap' }}>{maskCurrency(price)}</td>
                                    </tr>
                                );
                            })}
                            <tr>
                                <td colSpan="3" style={{ padding: '8px 10px', borderTop: '2px solid #1a1a1a', background: '#f0f0f0', fontWeight: '800', fontSize: '11pt' }}>VALOR TOTAL DO CONTRATO</td>
                                <td style={{ padding: '8px 10px', borderTop: '2px solid #1a1a1a', background: '#f0f0f0', fontWeight: '900', fontSize: '11pt', textAlign: 'right', whiteSpace: 'nowrap' }}>{maskCurrency(grandTotal)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <p style={{ fontSize: '10pt', lineHeight: '1.65', marginBottom: '10px', textAlign: 'justify' }}>
                        <strong>Parágrafo Segundo:</strong> Os móveis serão montados e instalados no endereço, conforme indicado pelo(a) Contratante.
                    </p>
                    <p style={{ fontSize: '10pt', lineHeight: '1.65', marginBottom: '10px', textAlign: 'justify' }}>
                        <strong>Parágrafo Terceiro:</strong> O CONTRATANTE declara expressamente que foi devidamente orientado pelo CONTRATADO a analisar, avaliar e escolher pessoalmente a tonalidade, cores e desenhos das lâminas de MDF, e que efetivamente fez a escolha dos MDFs com os quais os móveis serão fabricados.
                    </p>

                    {/* ── SECTION 2: OBRIGAÇÕES ──────────────────────────── */}
                    <div style={{ fontSize: '11pt', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', margin: '20px 0 10px 0', padding: '6px 10px', background: '#f0f0f0', borderLeft: '4px solid #1a1a1a' }}>
                        2 — Das Obrigações
                    </div>

                    {[
                        { num: '2ª', text: `Obriga-se o CONTRATADO a disponibilizar para entrega os móveis contratados em ${proposal.delivery_deadline || '45 (quarenta e cinco) dias úteis'}, contados a partir da data de assinatura deste contrato, pagamento dos valores acordados e da confirmação de medidas.`, children: [
                            { num: 'Primeiro', text: `A instalação será realizada pelo CONTRATADO num prazo de ${proposal.assembly_deadline || '20 (vinte) dias úteis'}, desde que não ocorra qualquer impedimento, tais como: regras internas do condomínio (horários limites, horário de recolhimento de lixo, etc.), bem como as condições do local de instalação do móvel (móveis atuais, pinturas, acabamentos, instalações elétricas e telefônicas, etc.). Ocorrendo qualquer impedimento, o prazo final de instalação será prorrogado na mesma proporção.` },
                            { num: 'Segundo', text: 'Entregas e instalações previstas ou que estiverem em curso entre 20/12 a 10/01 serão suspensas por motivo de férias coletivas. As atividades serão retomadas a partir do primeiro dia útil subsequente a este período.' }
                        ]},
                        { num: '3ª', text: 'O CONTRATANTE se compromete a entregar ao CONTRATADO, antes do início da instalação, a planta hidráulica e elétrica do imóvel, para evitar problemas com encanamentos ou descargas elétricas que possam vir a acontecer, devido à fixação dos móveis. Caso esta não seja fornecida, o CONTRATADO ficará isento de qualquer dano que possa vir a acontecer.', children: [
                            { num: 'Único', text: 'O presente contrato não inclui serviços de instalações hidráulicas, elétricas ou de qualquer outra natureza. A equipe de montagem não tem autorização para assumir ou realizar serviços eventuais solicitados pelo CONTRATANTE e, caso isto ocorra, o CONTRATADO ficará isento de qualquer dano que possa vir a acontecer.' }
                        ]},
                        { num: '4ª', text: 'O CONTRATADO executará os serviços com material de qualidade e excelente padrão de acabamento, sendo que fornece garantia de 5 (cinco) anos para produtos fornecidos e fabricados pelo CONTRATADO e 1 (um) ano de garantia nas ferragens e demais materiais utilizados de fabricação de terceiros, tais como corrediças, dobradiças, aramados, puxadores e amortecedores.', children: [
                            { num: 'Único', text: 'A garantia sobre os produtos NÃO cobre casos em que a causa tenha sido água ou qualquer outro líquido em contato com os móveis.' }
                        ]},
                        { num: '5ª', text: 'O CONTRATANTE deverá deixar o local das instalações totalmente limpo e livre de móveis ou qualquer objeto que possa impossibilitar a montagem dos móveis pelos funcionários (montadores) do CONTRATADO. Não é de responsabilidade do CONTRATADO retirar, carregar ou transportar qualquer objeto mencionado acima. Ao final do serviço, o CONTRATADO compromete-se a deixar o local limpo.' },
                        { num: '6ª', text: 'O CONTRATADO responsabiliza-se por qualquer avaria ocorrida nas paredes e portas do local durante a montagem dos móveis, desde que a avaria seja identificada por ambas as partes, por escrito, no ato do ocorrido, exceto em caso de simples pintura final como acabamento de decoração.', children: [
                            { num: 'Único', text: 'O CONTRATANTE responsabiliza-se em realizar a pintura final dos ambientes que receberem os móveis do CONTRATADO, além de comprometer-se a disponibilizar os materiais necessários à correção das avarias, tais como massa corrida, tintas, vernizes, etc.' }
                        ]},
                        { num: '7ª', text: 'O CONTRATANTE, no momento da montagem, em nenhuma hipótese poderá solicitar aos funcionários (montadores) do CONTRATADO qualquer modificação do projeto pré-aprovado.', children: [
                            { num: 'Primeiro', text: 'Caso seja necessária alguma modificação do projeto no ato da montagem, o CONTRATADO deverá ser comunicado por escrito, ainda que por e-mail, para modificação do projeto e reajuste no valor do contrato.' }
                        ]}
                    ].map(clause => (
                        <div key={clause.num}>
                            <p style={{ fontSize: '10pt', lineHeight: '1.65', marginBottom: '10px', textAlign: 'justify' }}>
                                <strong>Cláusula {clause.num}.</strong> {clause.text}
                            </p>
                            {clause.children?.map((c, ci) => (
                                <p key={ci} style={{ fontSize: '10pt', lineHeight: '1.65', marginBottom: '10px', textAlign: 'justify', paddingLeft: '20px' }}>
                                    <strong>Parágrafo {c.num}:</strong> {c.text}
                                </p>
                            ))}
                        </div>
                    ))}

                    {/* ── SECTION 3: PAGAMENTO ───────────────────────────── */}
                    <div style={{ fontSize: '11pt', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', margin: '20px 0 10px 0', padding: '6px 10px', background: '#f0f0f0', borderLeft: '4px solid #1a1a1a' }}>
                        3 — Do Preço, Forma e Condição de Pagamento
                    </div>

                    {/* Payment table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0 12px 0', fontSize: '9.5pt' }}>
                        <thead>
                            <tr>
                                <th style={{ background: '#1a1a1a', color: '#fff', padding: '7px 10px', fontWeight: '700', textAlign: 'left', fontSize: '9pt' }}>Descrição</th>
                                <th style={{ background: '#1a1a1a', color: '#fff', padding: '7px 10px', fontWeight: '700', textAlign: 'right', fontSize: '9pt', width: '120px' }}>Valor</th>
                                <th style={{ background: '#1a1a1a', color: '#fff', padding: '7px 10px', fontWeight: '700', textAlign: 'center', fontSize: '9pt', width: '120px' }}>Vencimento</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paymentRows.length === 0 ? (
                                <tr><td colSpan="3" style={{ padding: '12px 10px', textAlign: 'center', color: '#888' }}>Ver condições no campo observações.</td></tr>
                            ) : paymentRows.map((row, i) => (
                                <tr key={i}>
                                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e0e0e0', background: i % 2 === 0 ? '#fff' : '#f8f8f8', fontWeight: '600' }}>{row.title}{row.note ? <span style={{ fontSize: '8.5pt', fontWeight: '400', color: '#666' }}> — {row.note}</span> : ''}</td>
                                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e0e0e0', background: i % 2 === 0 ? '#fff' : '#f8f8f8', fontWeight: '700', textAlign: 'right', whiteSpace: 'nowrap' }}>{typeof row.value === 'number' ? maskCurrency(row.value) : row.value}</td>
                                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e0e0e0', background: i % 2 === 0 ? '#fff' : '#f8f8f8', textAlign: 'center' }}>{row.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Payment obs (raw text) */}
                    {proposal.payment_notes && paymentRows.length === 0 && (
                        <div style={{ padding: '10px 14px', background: '#f8f8f8', border: '1px solid #ddd', borderRadius: '6px', fontSize: '9.5pt', lineHeight: '1.65', whiteSpace: 'pre-wrap', marginBottom: '14px', color: '#333' }}>
                            {proposal.payment_notes}
                        </div>
                    )}

                    {/* Payment methods (resumo / observações) */}
                    {proposal.payment_methods && (
                        <div style={{ padding: '10px 14px', background: '#f8f8f8', border: '1px solid #ddd', borderRadius: '6px', fontSize: '9.5pt', lineHeight: '1.65', whiteSpace: 'pre-wrap', marginBottom: '14px', color: '#333' }}>
                            <strong>Observações da Condição de Pagamento:</strong><br />
                            {proposal.payment_methods}
                        </div>
                    )}


                    <p style={{ fontSize: '10pt', lineHeight: '1.65', marginBottom: '10px', textAlign: 'justify' }}>
                        <strong>Cláusula 8ª.</strong> Pelos móveis, objeto do presente contrato, o CONTRATANTE pagará ao CONTRATADO o montante de <strong>{maskCurrency(grandTotal)}</strong> ({numExtenso(grandTotal)} reais), conforme planilha acima.
                    </p>
                    <p style={{ fontSize: '10pt', lineHeight: '1.65', marginBottom: '10px', textAlign: 'justify', paddingLeft: '20px' }}>
                        <strong>Parágrafo Primeiro.</strong> Os pagamentos poderão ser realizados mediante crédito em conta corrente de titularidade do CONTRATADO, através da chave PIX CNPJ: <strong>{formatDoc(tenant?.cnpj) || '—'}</strong>, servindo o comprovante do crédito como recibo de pagamento. Outras formas de pagamento deverão ocorrer conforme negociação.
                    </p>
                    <p style={{ fontSize: '10pt', lineHeight: '1.65', marginBottom: '10px', textAlign: 'justify', paddingLeft: '20px' }}>
                        <strong>Parágrafo Segundo.</strong> O pagamento após a data de vencimento sujeitará o CONTRATANTE ao pagamento de multa de 2% (dois por cento) mais juros de 1% ao mês, além da correção monetária com base na variação do INPC.
                    </p>

                    {/* ── SECTION 4-9 ────────────────────────────────────── */}
                    {[
                        {
                            title: '4 — Da Reserva de Domínio',
                            clauses: [{ num: '9ª', text: 'Em virtude da Reserva de Domínio, estabelecida neste instrumento, fica reservado ao CONTRATADO o direito de propriedade dos móveis sob medida objeto do contrato, até a total quitação das parcelas estabelecidas na Cláusula 8ª.' }]
                        },
                        {
                            title: '5 — Da Conservação e Uso dos Bens',
                            clauses: [{ num: '10ª', text: 'Enquanto não forem pagas todas as parcelas da Cláusula 8ª, o CONTRATANTE obrigar-se-á por zelar pela conservação dos móveis, providenciando todos os recursos necessários à sua manutenção, correndo todos os custos por sua conta. Deve, ainda, zelar pela sua aparência e bom funcionamento, sendo-lhe impedido de alterar a estrutura dos móveis sem autorização ou participação do CONTRATADO, de modo que não desvirtue seu uso ou altere suas características.' }]
                        },
                        {
                            title: '6 — Do Inadimplemento',
                            clauses: [
                                { num: '11ª', text: 'Em caso de inadimplemento de qualquer das parcelas previstas na Cláusula 8ª deste instrumento pelo CONTRATANTE, cabe ao CONTRATADO, em razão do pacto com reserva de domínio, a faculdade na reintegração na posse dos móveis, objeto do contrato, ou de promover a competente ação de execução do contrato ou dos cheques utilizados, conforme o caso.' },
                                { num: '12ª', text: 'AS PARTES entre si estabelecem uma cláusula penal de 5% (cinco por cento) sobre o valor total do contrato, corrigido monetariamente pelo INPC e com juros de mora de 1% ao mês, assim como honorários advocatícios à razão de 20%, para a parte que descumprir quaisquer dos compromissos assumidos.' }
                            ]
                        },
                        {
                            title: '7 — Dos Encargos Decorrentes da Prestação de Serviços',
                            clauses: [
                                { num: '13ª', text: 'Todos os tributos que forem devidos em decorrência direta ou indireta do presente contrato ou de sua execução constituem ônus de responsabilidade exclusiva do CONTRATADO, que é contribuinte para fins da legislação tributária.' },
                                { num: '14ª', text: 'O CONTRATADO ficará responsável, no que lhe compete legalmente, pelas obrigações de ordem civil, trabalhista, previdenciária e securitária relativa aos seus funcionários, bem como a de seus sócios, prepostos e mandatários.' }
                            ]
                        },
                        {
                            title: '8 — Disposições Finais',
                            clauses: [
                                { num: '15ª', text: 'Fica estabelecido que este contrato tem sua vigência até a data da entrega final dos móveis devidamente acompanhados de recibo de entrega ("check list"), sendo que a partir de então passa a ser o documento representante da compra e venda com reserva de domínio e para fins da garantia prevista na Cláusula 4ª.' },
                                { num: '16ª', text: 'As partes declaram que leram, discutiram, entenderam e que concordaram integralmente com todas as cláusulas, condições e anexos do presente contrato, o qual foi firmado de livre e espontânea vontade, sem vício de consentimento e/ou de vontade.' }
                            ]
                        },
                        {
                            title: '9 — Do Foro de Eleição',
                            clauses: [{ num: '17ª', text: `As partes elegem o foro da comarca de ${city}, para conhecer e dirimir qualquer questão ou controvérsia oriunda do cumprimento deste contrato, com renúncia de qualquer outro, por mais privilegiado que seja.` }]
                        }
                    ].map(section => (
                        <div key={section.title}>
                            <div style={{ fontSize: '11pt', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', margin: '20px 0 10px 0', padding: '6px 10px', background: '#f0f0f0', borderLeft: '4px solid #1a1a1a' }}>
                                {section.title}
                            </div>
                            {section.clauses.map(c => (
                                <p key={c.num} style={{ fontSize: '10pt', lineHeight: '1.65', marginBottom: '10px', textAlign: 'justify' }}>
                                    <strong>Cláusula {c.num}.</strong> {c.text}
                                </p>
                            ))}
                        </div>
                    ))}

                    {/* ── CLOSING ────────────────────────────────────────── */}
                    <p style={{ fontSize: '10pt', lineHeight: '1.65', marginTop: '14px', marginBottom: '28px', textAlign: 'justify' }}>
                        Por estarem assim justos e contratados, firmam o presente instrumento, em duas vias de igual teor, juntamente com 2 (duas) testemunhas.
                    </p>

                    {/* City and date */}
                    <p style={{ textAlign: 'center', fontWeight: '700', fontSize: '11pt', marginBottom: '40px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {city}, {today}
                    </p>

                    {/* Signatures */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px', marginBottom: '40px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: '8px' }}>
                                <div style={{ fontWeight: '700', fontSize: '10pt' }}>{partner?.name || proposal.partner_name || 'CONTRATANTE'}</div>
                                <div style={{ fontSize: '9pt', color: '#555' }}>CPF: {formatDoc(partner?.document) || '—'}</div>
                                <div style={{ fontSize: '9pt', color: '#555', marginTop: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contratante</div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: '8px' }}>
                                <div style={{ fontWeight: '700', fontSize: '10pt' }}>{tenant?.name || 'CONTRATADO'}</div>
                                <div style={{ fontSize: '9pt', color: '#555' }}>CNPJ: {formatDoc(tenant?.cnpj) || '—'}</div>
                                <div style={{ fontSize: '9pt', color: '#555', marginTop: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contratado</div>
                            </div>
                        </div>
                    </div>

                    {/* Witnesses */}
                    <div>
                        <div style={{ fontSize: '10pt', fontWeight: '700', textAlign: 'center', marginBottom: '30px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px' }}>Testemunhas</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: '8px' }}>
                                    <div style={{ fontSize: '9pt', color: '#888' }}>Nome: ____________________________</div>
                                    <div style={{ fontSize: '9pt', color: '#888', marginTop: '4px' }}>CPF: _____________________________</div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: '8px' }}>
                                    <div style={{ fontSize: '9pt', color: '#888' }}>Nome: ____________________________</div>
                                    <div style={{ fontSize: '9pt', color: '#888', marginTop: '4px' }}>CPF: _____________________________</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {presentationImages.length > 0 && (
                        <div className="page-break" style={{ marginTop: '40px', borderTop: '2px solid #1a1a1a', paddingTop: '20px' }}>
                            <div style={{ fontSize: '11pt', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', margin: '20px 0 10px 0', padding: '6px 10px', background: '#f0f0f0', borderLeft: '4px solid #1a1a1a' }}>
                                Anexo — Imagens do Projeto (Apresentação)
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                                {presentationImages.map((img, idx) => (
                                    <div key={idx} style={{ border: '1.5px solid #1a1a1a', borderRadius: '6px', padding: '8px', background: '#fff', textAlign: 'center' }}>
                                        <img 
                                            src={img.url} 
                                            alt={img.name || 'Imagem do Projeto'} 
                                            style={{ maxWidth: '100%', maxHeight: '250px', objectFit: 'contain', borderRadius: '4px' }} 
                                        />
                                        <div style={{ fontSize: '9pt', fontWeight: '700', marginTop: '6px', color: '#333' }}>
                                            {img.itemName}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{ borderTop: '1px solid #ccc', marginTop: '30px', paddingTop: '10px', textAlign: 'center', fontSize: '8pt', color: '#aaa' }}>
                        Contrato #{contractNum} — {tenant?.name || 'EZATTUS PLANEJADOS'} — {formatDoc(tenant?.cnpj)} — Gerado em {new Date().toLocaleString('pt-BR')}
                    </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ContractModal;
