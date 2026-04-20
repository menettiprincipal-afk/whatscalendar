const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

let client;
let isReady = false;

const initWhatsApp = async () => {
    console.log('🟡 Preparando instância do WhatsApp Web.js MODO HEADLESS na Nuvem...');
    // A integração wwebjs-mongo usa a conexão ativa do mongoose
    const store = new MongoStore({ mongoose: mongoose });
    
    // WORKAROUND: O RemoteAuth sofre com um bug onde o puppeteer ou ele mesmo deletam a pasta e causam ENOENT scandir na hora do backup.
    // Garantimos que a pasta vai existir mantendo um check intervalar.
    const sessionPath = path.join(process.cwd(), '.wwebjs_auth', 'wwebjs_temp_session_bot-calendario', 'Default');
    setInterval(() => {
        if (!fs.existsSync(sessionPath)) {
            try { fs.mkdirSync(sessionPath, { recursive: true }); } catch (e) {}
        }
    }, 10000); // Checa a cada 10s e recria se não existir.

    client = new Client({
        authStrategy: new RemoteAuth({
            clientId: 'bot-calendario',
            store: store,
            backupSyncIntervalMs: 300000 // A cada 5min salva no MongoDB para não perder a sessão no cloud.
        }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Essencial para rodar no Render, Railway, VPS
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        }
    });

    client.on('qr', (qr) => {
        console.log('🔴 QR RECEIVED - Para autenticar o BOT DISPARADOR, escaneie esse QR no terminal:');
        qrcode.generate(qr, { small: true });
    });

    client.on('remote_session_saved', () => {
        console.log('☁️ Sessão do WhatsApp foi salva em segurança na nuvem (Mongoose Store).');
    });

    client.on('ready', () => {
        console.log('🟢 WhatsApp Remetente ESTÁ PRONTO E CONECTADO!');
        isReady = true;
    });

    client.on('auth_failure', msg => {
        console.error('🔴 Falha fatal na autenticação do WhatsApp:', msg);
    });
    
    client.on('disconnected', (reason) => {
        console.log('🔴 WhatsApp Desconectado! Motivo:', reason);
        isReady = false;
        // Dependendo do ambiente, às vezes necessita chamar client.initialize() novamente.
    });

    client.initialize();
};

const sendMessage = async (whatsappNumber, messageText) => {
    if (!isReady) {
        console.warn('⚠️ WhatsApp ainda não está pronto para enviar mensagens. Ignorando envio para:', whatsappNumber);
        return false;
    }
    
    // Tratamento robusto do número: remove tudo que não for dígito
    let cleanNumber = whatsappNumber.replace(/\D/g, '');
    
    // Se o usuário digitou apenas DDD + número (ex: 11999999999) com 10 ou 11 dígitos, forçamos o "55" inicial do Brasil
    if (cleanNumber.length <= 11) {
        cleanNumber = `55${cleanNumber}`;
    }

    const chatId = `${cleanNumber}@c.us`;
    try {
        // Obter número serializado real caso o whatsapp tenha o numero com/sem o nono dígito (No LID fix)
        const numberId = await client.getNumberId(cleanNumber);
        if (!numberId) {
            console.error(`❌ Número não possui WhatsApp ativo: ${cleanNumber}`);
            return false;
        }

        await client.sendMessage(numberId._serialized, messageText);
        console.log(`📩 Mensagem enviada com sucesso para ${cleanNumber}`);
        return true;
    } catch (err) {
        console.error(`❌ Erro ao enviar mensagem para ${whatsappNumber}:`, err);
        return false;
    }
};

module.exports = { initWhatsApp, sendMessage };
