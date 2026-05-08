import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3001/api',
});

// Interceptor para adicionar o token em todas as requisições
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Interceptor para tratar erros globais (como token expirado)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token inválido ou expirado - limpa e redireciona (opcional)
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.reload(); 
        }
        return Promise.reject(error);
    }
);

export default api;
