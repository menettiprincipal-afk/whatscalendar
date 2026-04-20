const cron = require('node-cron');
const User = require('../models/User');
const { getTodaysEvents } = require('./calendarService');
const { sendMessage } = require('./whatsappService');

const runDailyRoutine = async () => {
    console.log(`[START] Iniciando rotina diária de envio às ${new Date().toISOString()}`);
    
    try {
        // Encontra todos os usuários que possuam token de acesso ao google ativo.
        const users = await User.find({ "googleTokens.access_token": { $exists: true } });
        
        for (const user of users) {
            try {
                // Fetch events da lib do google
                const events = await getTodaysEvents(user.googleTokens);
                
                if (events.length === 0) {
                    console.log(`Nenhum evento agendado para o usuário ${user.whatsappNumber} hoje.`);
                    await sendMessage(user.whatsappNumber, `Bom dia! Seu dia está livre, você não tem compromissos agendados no Calendar para hoje.`);
                    continue;
                }

                // Construct message without AI (REQUISITO: Custo Zero)
                let msg = `Bom dia! Aqui estão os seus compromissos para hoje:\n\n`;
                events.forEach(event => {
                    const start = event.start.dateTime || event.start.date;
                    const startDate = new Date(start);
                    
                    // Lida com eventos de all-day (que só devolvem Date e não DateTime)
                    const timeString = event.start.dateTime 
                        ? startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: process.env.TIMEZONE || 'America/Sao_Paulo' }) 
                        : 'Dia todo';
                        
                    msg += `- [${timeString}]: ${event.summary}\n`;
                });

                await sendMessage(user.whatsappNumber, msg);
            } catch (userErr) {
                console.error(`Erro na rotina para o usuário ${user.whatsappNumber}:`, userErr.message);
                // Pode ocorrer erro por revogação de token (invalid_grant) pelo lado do usuário.
            }
        }
    } catch (err) {
        console.error('Falha geral no sistema do cron:', err);
    }
    console.log(`[END] Rotina diária finalizada.`);
};

const initCron = () => {
    // Agendador: executa no minuto 0 da hora 7 (7:00 AM) diariamente
    cron.schedule('0 7 * * *', runDailyRoutine, {
        scheduled: true,
        timezone: process.env.TIMEZONE || "America/Sao_Paulo"
    });
    console.log('⏰ Servidor Cron Inicializado: Engatilhado para rodar às 07:00 da manhã.');
};

module.exports = { initCron, runDailyRoutine };
