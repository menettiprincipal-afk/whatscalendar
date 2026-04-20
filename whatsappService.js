const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const AuthDocSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    files: { type: Map, of: String }
});
const BaileysAuth = mongoose.models.BaileysAuth || mongoose.model('BaileysAuth', AuthDocSchema);

let clientSocket = null;
let isReady = false;

// 🧠 NOSSA MÁGICA FINAL: Clonamos o diretório nativo para a nuvem
const sessionDir = path.join(process.cwd(), 'baileys_auth');

async function downloadSession() {
    try {
        const doc = await BaileysAuth.findOne({ id: 'meu-bot-v2' });
        if (doc && doc.files && doc.files.size > 0) {
            if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
            for (let [filename, content] of doc.files.entries()) {
                fs.writeFileSync(path.join(sessionDir, filename), content, 'base64');
            }
        }
    } catch (e) {
        console.error('Falha ao baixar sessão:', e);
    }
}

async function uploadSession() {
    try {
        if (!fs.existsSync(sessionDir)) return;
        const files = fs.readdirSync(sessionDir);
        const filesMap = {};
        for (let file of files) {
            filesMap[file] = fs.readFileSync(path.join(sessionDir, file)).toString('base64');
        }
        await BaileysAuth.updateOne({ id: 'meu-bot-v2' }, { $set: { files: filesMap } }, { upsert: true });
    } catch (e) {}
}

const initWhatsApp = async () => {
    console.log('🟡 Preparando instância do Baileys...');
    
    // Baixamos arquivos antigos da nuvem (se tiver)
    await downloadSession();

    // Passamos pro Baileys oficial ler como ele entende melhor (Nativamente)
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    // 🔥 BUSCA A ÚLTIMA VERSÃO OFICIAL DO WHATSAPP ANTES DE CONECTAR
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`📡 Disfarçando servidor com WA Web Oficial v${version.join('.')} (isLatest: ${isLatest})`);

    const connectToWhatsApp = () => {
        const sock = makeWASocket({
            version, // O WhatsApp vai aceitar a conexão imediatamente por não ser versão defasada
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }), // Deixado silencioso
            browser: Browsers.macOS('Desktop') // Usa o agente de navegador OFICIAL DO PRÓPRIO BAILEYS!
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('🔴 NOVO QR CODE GERADO. FAÇA A LEITURA PARA CONECTAR:');
                console.log('🔗 OU COPIE O CÓDIGO BRUTO ABAIXO (site recomendado: br.qr-code-generator.com ou use o VSCode):');
                console.log('\n=============================================');
                console.log(qr);
                console.log('=============================================\n');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                const isLogout = (lastDisconnect.error)?.output?.statusCode === DisconnectReason.loggedOut;
                
                isReady = false;
                
                if (!isLogout) {
                    console.log('🔄 Tentando reconectar silenciosamente. Motivo profundo:', lastDisconnect.error?.message, lastDisconnect.error);
                    setTimeout(connectToWhatsApp, 5000);
                } else {
                    console.log('❌ O BOT FOI DESCONECTADO PELO CELULAR (LogOut)! Ele vai apagar a gaveta da nuvem...');
                    await BaileysAuth.deleteOne({ id: 'meu-bot-v2' });
                    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch(e){}
                }
            } else if (connection === 'open') {
                console.log('🟢 WhatsApp LEVE E SUPREMO ESTÁ PRONTO E CONECTADO!');
                isReady = true;
                clientSocket = sock;
                await uploadSession();
            }
        });

        // Ao renovar seguranças, ele salva na pasta e clonamos pro MongoDB cimentar
        sock.ev.on('creds.update', async () => {
             await saveCreds();
             await uploadSession();
        });
    };

    connectToWhatsApp();
};

const sendMessage = async (whatsappNumber, messageText) => {
    if (!isReady || !clientSocket) {
        console.warn('⚠️ WhatsApp não está pronto.');
        return false;
    }
    
    let cleanNumber = whatsappNumber.replace(/\D/g, '');
    if (cleanNumber.length <= 11) {
        cleanNumber = `55${cleanNumber}`;
    }

    try {
        const jid = `${cleanNumber}@s.whatsapp.net`;
        
        const [result] = await clientSocket.onWhatsApp(jid);
        if (!result || !result.exists) {
            console.error(`❌ Número não possui WhatsApp ativo: ${cleanNumber}`);
            return false;
        }

        await clientSocket.sendMessage(result.jid, { text: messageText });
        console.log(`📩 Mensagem enviada com sucesso para ${cleanNumber}`);
        return true;
    } catch (err) {
        console.error(`❌ Erro ao enviar mensagem para ${whatsappNumber}:`, err);
        return false;
    }
};

module.exports = { initWhatsApp, sendMessage };
