const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        
        // RG04 & RG05: Identificação automática e isolamento
        req.user = decoded;
        req.tenantId = decoded.tenantId; 

        if (!req.tenantId) {
            return res.status(403).json({ error: 'Empresa não identificada no token' });
        }

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

module.exports = authMiddleware;
