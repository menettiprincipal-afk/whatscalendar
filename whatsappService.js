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
            clientId: 'chatbot-final-1', // Mudamos o nome para forçar o Mongo a não tentar baixar um zip imenso do passado, o que tava causando o estouro de memória!
            store: store,
            backupSyncIntervalMs: 300000 
        }),
        puppeteer: {
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--js-flags="--max-old-space-size=80"' // Mínimo do V8 para tentar sobreviver ao lado do NodeJS
            ]
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        }
    });

    client.on('qr', (qr) => {
        console.log('🔴 QR RECEIVED - Para autenticar o BOT DISPARADOR, escaneie esse QR no terminal:');
        console.log('🔗 OU COPIE O CÓDIGO ABAIXO E GERE O SEU QR EM UM SITE (ex: the-qrcode-generator.com):');
        console.log('\n=============================================');
        console.log(qr);
        console.log('=============================================\n');
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
