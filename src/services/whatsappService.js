const { default: makeWASocket, DisconnectReason, BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const AuthDocSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    data: { type: String }
});
const BaileysAuth = mongoose.models.BaileysAuth || mongoose.model('BaileysAuth', AuthDocSchema);

let clientSocket = null;
let isReady = false;

// 🧠 NOSSA MÁGICA: Adaptador de Sessão Baileys Direto pro Mongo (Fim do Zip Gigante de 150mb)
async function useMongoAuthState(sessionId) {
    const writeData = async (data, id) => {
        const str = JSON.stringify(data, BufferJSON.replacer);
        await BaileysAuth.updateOne({ id: `${sessionId}-${id}` }, { $set: { data: str } }, { upsert: true });
    };

    const readData = async (id) => {
        const doc = await BaileysAuth.findOne({ id: `${sessionId}-${id}` });
        if (!doc) return null;
        return JSON.parse(doc.data, BufferJSON.reviver);
    };

    const removeData = async (id) => {
        await BaileysAuth.deleteOne({ id: `${sessionId}-${id}` });
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
                        ids.map(async id => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
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
        saveCreds: () => writeData(creds, 'creds')
    }
}

const initWhatsApp = async () => {
    console.log('🟡 Preparando instância do Baileys MODO ULTRA LIGHT SOCADO (Adeus Chrome!)...');
    
    // Conectamos a autorização customizada usando a base de dados ativa
    const { state, saveCreds } = await useMongoAuthState('robot-bot-v1');

    const connectToWhatsApp = () => {
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }), // Deixa calado, senão ele vomita logs demais da conexão wifi rs
            browser: ['Bot Calendario', 'Safari', '1.0.0']
        });

        sock.ev.on('connection.update', (update) => {
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
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('🔴 Conexão falhou/fechou. Motivo técnico:', (lastDisconnect.error)?.message);
                isReady = false;
                
                if (shouldReconnect) {
                    console.log('🔄 Tentando reconectar ao WhatsApp silenciosamente...');
                    setTimeout(connectToWhatsApp, 5000);
                } else {
                    console.log('❌ O BOT FOI DESCONECTADO PELO CELULAR (LogOut)! Ele vai apagar a gaveta do mongo para o próximo QR...');
                    mongoose.models.BaileysAuth.deleteMany({ id: { $regex: '^robot-bot-v1' } }).exec();
                }
            } else if (connection === 'open') {
                console.log('🟢 WhatsApp LEVE E SUPREMO ESTÁ PRONTO E CONECTADO!');
                isReady = true;
                clientSocket = sock;
            }
        });

        // Quando o whatsapp atualiza as chaves secretas de 10 em 10 min, forçamos o salvar pro Mongo:
        sock.ev.on('creds.update', saveCreds);
    };

    connectToWhatsApp();
};

const sendMessage = async (whatsappNumber, messageText) => {
    if (!isReady || !clientSocket) {
        console.warn('⚠️ WhatsApp não está pronto.');
        return false;
    }
    
    // Higieniza
    let cleanNumber = whatsappNumber.replace(/\D/g, '');
    if (cleanNumber.length <= 11) {
        cleanNumber = `55${cleanNumber}`;
    }

    try {
        const jid = `${cleanNumber}@s.whatsapp.net`;
        
        // Verifica pra ver se a pessoa tem zap válido (Substitui o noLid getNumberId)
        const [result] = await clientSocket.onWhatsApp(jid);
        if (!result || !result.exists) {
            console.error(`❌ Número não possui WhatsApp ativo: ${cleanNumber}`);
            return false;
        }

        // Manda de verdade, formato Baileys
        await clientSocket.sendMessage(result.jid, { text: messageText });
        console.log(`📩 Mensagem enviada com sucesso para ${cleanNumber}`);
        return true;
    } catch (err) {
        console.error(`❌ Erro ao enviar mensagem para ${whatsappNumber}:`, err);
        return false;
    }
};

module.exports = { initWhatsApp, sendMessage };
