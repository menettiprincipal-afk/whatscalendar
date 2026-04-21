const cron = require('node-cron');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const { getTomorrowsEvents } = require('./calendarService'); // BUSCA EVENTOS DE AMANHÃ
const { sendMessage } = require('./whatsappService');

let currentCronJob = null; // Variável global para armazenar a instância atual do cron

const runRoutineForUsers = async (users) => {
    for (const user of users) {
        try {
            // Instancia apenas os eventos de AMANHÃ
            const events = await getTomorrowsEvents(user.googleTokens);
            
            // SE NÃO TEM EVENTOS PARA O DIA SEGUINTE, O BOT MANTÉM SILÊNCIO.
            if (events.length === 0) {
                console.log(`Nenhum evento agendado para o usuário ${user.whatsappNumber} amanhã. Pulando envio.`);
                continue; 
            }

            // Criação da mensagem reformulada
            let msg = `Olá! Veja abaixo sua agenda para amanhã:\n\n`;
            events.forEach(event => {
                const start = event.start.dateTime || event.start.date;
                const startDate = new Date(start);
                
                const timeString = event.start.dateTime 
                    ? startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: process.env.TIMEZONE || 'America/Sao_Paulo' }) 
                    : 'Dia todo';
                    
                msg += `- [${timeString}]: ${event.summary}\n`;
            });

            await sendMessage(user.whatsappNumber, msg);
        } catch (userErr) {
            console.error(`Erro na rotina para o usuário ${user.whatsappNumber}:`, userErr.message);
        }
    }
};

const runDailyRoutine = async () => {
    const now = new Date();
    console.log(`[START] Iniciando disparo global forçado às ${now.toISOString()}`);
    try {
        const users = await User.find({ "googleTokens.access_token": { $exists: true } });
        await runRoutineForUsers(users);
        console.log(`[END] Disparo global forçado concluído.`);
    } catch (e) {
        console.error('Erro na rotina de disparo global:', e);
    }
};

const initCron = async () => {
    if (currentCronJob) currentCronJob.stop();

    console.log(`[CRON] Monitorando disparos por usuário a cada minuto.`);
    
    currentCronJob = cron.schedule('* * * * *', async () => {
        const now = new Date();
        const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        
        // Log discreto para indicar que o motor está vivo
        if (now.getSeconds() === 0) {
            console.log(`[HEARTBEAT] Cron ativo: ${currentTime}`);
        }

        console.log(`[CRON] Verificando usuários agendados para as ${currentTime}...`);
        try {
            const users = await User.find({ "googleTokens.access_token": { $exists: true }, preferredTime: currentTime });
            if (users.length > 0) {
                console.log(`[CRON] Encontrados ${users.length} usuários para as ${currentTime}. Iniciando disparos.`);
                await runRoutineForUsers(users);
            }
        } catch (e) {
            console.error('[CRON] Erro no cron minuto-a-minuto:', e);
        }
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });
};

module.exports = { initCron, runDailyRoutine, runRoutineForUsers };
