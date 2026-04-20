const cron = require('node-cron');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const { getTomorrowsEvents } = require('./calendarService'); // BUSCA EVENTOS DE AMANHÃ
const { sendMessage } = require('./whatsappService');

let currentCronJob = null; // Variável global para armazenar a instância atual do cron

const runDailyRoutine = async () => {
    console.log(`[START] Iniciando rotina de agendamento às ${new Date().toISOString()}`);
    
    try {
        // Encontra todos os usuários que possuam token de acesso ao google ativo.
        const users = await User.find({ "googleTokens.access_token": { $exists: true } });
        
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
    } catch (err) {
        console.error('Falha geral no sistema do cron:', err);
    }
    console.log(`[END] Rotina diária finalizada.`);
};

// Nova função assíncrona que lê o banco de dados antes de iniciar
const initCron = async () => {
    try {
        // Verifica no banco se o admin customizou o horário. Se não existir, o padrão será 17h.
        let scheduleTime = await SystemConfig.findOne({ key: 'CRON_SCHEDULE' });
        
        if (!scheduleTime) {
            scheduleTime = new SystemConfig({ key: 'CRON_SCHEDULE', value: '17:00' });
            await scheduleTime.save();
        }

        const [hour, minute] = scheduleTime.value.split(':');
        const cronExpression = `${minute} ${hour} * * *`;

        // Se já existe um cron em looping, nós paramos ele antes de injetar o novo (Importante pra quando o Admin muda lá na tela)
        if (currentCronJob) {
            currentCronJob.stop();
        }

        currentCronJob = cron.schedule(cronExpression, runDailyRoutine, {
            scheduled: true,
            timezone: process.env.TIMEZONE || "America/Sao_Paulo"
        });

        console.log(`⏰ Servidor Cron Engatilhado: Dinamicamente agendado para rodar às ${scheduleTime.value}.`);
    } catch (e) {
        console.error('Falha ao iniciar o serviço de cron:', e);
    }
};

module.exports = { initCron, runDailyRoutine };
