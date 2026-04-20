const { default: makeWASocket, DisconnectReason, initAuthCreds, BufferJSON, proto, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

// 1. Schema do MongoDB para salvar os estados do WhatsApp
const AuthStateSchema = new mongoose.Schema({
    _id: String,
    data: mongoose.Schema.Types.Mixed
}, { _id: false });
const AuthStateModel = mongoose.models.AuthState || mongoose.model('AuthState', AuthStateSchema);

// 2. Adaptador Oficial para MongoDB
async function useMongoDBAuthState(sessionId) {
    const writeData = async (data, id) => {
        try {
            const documentId = `${sessionId}-${id}`;
            const parsedData = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
            await AuthStateModel.replaceOne({ _id: documentId }, { _id: documentId, data: parsedData }, { upsert: true });
        } catch (error) {
            console.error('Error writing auth state to DB:', error);
        }
    };

    const readData = async (id) => {
        try {
            const documentId = `${sessionId}-${id}`;
            const doc = await AuthStateModel.findOne({ _id: documentId });
            if (doc) {
                return JSON.parse(JSON.stringify(doc.data), BufferJSON.reviver);
            }
        } catch (error) {
            console.error('Error reading auth state from DB:', error);
        }
        return null;
    };

    const removeData = async (id) => {
        try {
            await AuthStateModel.deleteOne({ _id: `${sessionId}-${id}` });
        } catch (error) {
            console.error('Error removing auth state from DB:', error);
        }
    };

    let creds = await readData('creds');
    if (!creds) {
        creds = initAuthCreds();
        await writeData(creds, 'creds');
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, 'creds');
        }
    };
}

let clientSocket = null;
let isReady = false;

const initWhatsApp = async () => {
    console.log('🟡 Preparando instância do Baileys e adaptando para o MongoDB...');
    
    // Passamos o adaptador para o Baileys ler direto do MongoDB, NUNCA do disco
    const { state, saveCreds } = await useMongoDBAuthState('meu-bot-v2');
    
    // 🔥 Busca a última versão oficial do WhatsApp Web
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`📡 Disfarçando servidor com WA Web Oficial v${version.join('.')} (isLatest: ${isLatest})`);

    const connectToWhatsApp = () => {
        const sock = makeWASocket({
            version, 
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }), 
            browser: Browsers.macOS('Desktop')
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('🔴 NOVO QR CODE GERADO. FAÇA A LEITURA PARA CONECTAR:');
                console.log('🔗 OU COPIE O CÓDIGO BRUTO ABAIXO (site recomendado: br.qr-code-generator.com):');
                console.log('\n=============================================');
                console.log(qr);
                console.log('=============================================\n');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                const isLogout = (lastDisconnect.error)?.output?.statusCode === DisconnectReason.loggedOut;
                
                isReady = false;
                
                if (!isLogout) {
                    console.log('🔄 Tentando reconectar silenciosamente. Motivo profundo:', lastDisconnect.error?.message);
                    setTimeout(connectToWhatsApp, 5000);
                } else {
                    console.log('❌ O BOT FOI DESCONECTADO PELO CELULAR (LogOut)!');
                    // Apagando apenas a pasta antiga que sobrou para fins de limpeza
                    await AuthStateModel.deleteMany({ _id: { $regex: '^meu-bot-v2-' } });
                }
            } else if (connection === 'open') {
                console.log('🟢 WhatsApp LEVE E SUPREMO ESTÁ PRONTO E CONECTADO!');
                isReady = true;
                clientSocket = sock;
            }
        });

        sock.ev.on('creds.update', async () => {
             await saveCreds();
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
