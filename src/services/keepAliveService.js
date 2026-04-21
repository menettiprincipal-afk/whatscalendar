const https = require('https');
const http = require('http');

/**
 * keepAliveService.js
 * Mantém a instância do Render acordada pingando a si mesma a cada 10-14 minutos.
 * Isso previne que o "Free Tier" entre em modo de suspensão (Sleep Mode).
 */

const startKeepAlive = () => {
    // Busca a URL externa nas variáveis de ambiente do Render ou do usuário
    const url = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
    
    if (!url) {
        console.warn('⚠️ [KEEP-ALIVE] Nenhuma APP_URL ou RENDER_EXTERNAL_URL encontrada. O self-ping não foi iniciado.');
        return;
    }

    console.log(`🔵 [KEEP-ALIVE] Iniciando sistema anti-sleep para: ${url}`);

    // Pinga a cada 10 minutos (Render dorme após 15 de inatividade)
    setInterval(() => {
        const protocol = url.startsWith('https') ? https : http;
        
        console.log(`🕒 [KEEP-ALIVE] Executando auto-ping em ${new Date().toLocaleTimeString()}...`);
        
        protocol.get(url, (res) => {
            console.log(`✅ [KEEP-ALIVE] Resposta recebida: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error(`❌ [KEEP-ALIVE] Erro no auto-ping:`, err.message);
        });
    }, 10 * 60 * 1000); // 10 minutos
};

module.exports = { startKeepAlive };
