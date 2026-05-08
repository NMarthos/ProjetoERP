export const maskPhone = (value) => {
    if (!value) return '';
    let v = value.replace(/\D/g, '');
    if (v.length <= 10) {
        v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
    } else {
        v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
        v = v.replace(/(\d{5})(\d)/, '$1-$2');
    }
    return v.substring(0, 15);
};

export const maskCEP = (value) => {
    if (!value) return '';
    let v = value.replace(/\D/g, '');
    v = v.replace(/^(\d{5})(\d)/, '$1-$2');
    return v.substring(0, 9);
};

export const maskCurrency = (value) => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'number') {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    let v = value.toString().replace(/\D/g, '');
    if (v === '') return '';
    v = (parseInt(v) / 100).toFixed(2);
    v = v.replace('.', ',');
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    return `R$ ${v}`;
};

export const parseCurrency = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    let v = value.replace(/\D/g, '');
    return parseFloat(v) / 100 || 0;
};

export const maskDate = (value) => {
    if (!value) return '';
    let v = value.replace(/\D/g, '');
    v = v.replace(/^(\d{2})(\d)/, '$1/$2');
    v = v.replace(/(\d{2})(\d)/, '$1/$2');
    return v.substring(0, 10);
};

export const maskDocument = (value) => {
    if (!value) return '';
    let v = value.replace(/\D/g, '');
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        return v.substring(0, 14);
    } else {
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
        return v.substring(0, 18);
    }
};
