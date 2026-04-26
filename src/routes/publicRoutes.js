const express = require('express');
const router = express.Router();
const { getAuthUrl, handleCallback, listUserCalendars } = require('../services/calendarService');
const User = require('../models/User');

router.get('/', (req, res) => {
    res.render('index');
});

// Endpoint público para a Política de Privacidade (Necessário para a Verificação do Google)
router.get('/privacidade', (req, res) => {
    res.render('privacy');
});

// Rota de Keep Alive / Health Check
router.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// A rota captura o formulário, pega o telefone e redireciona (enviando o state na transação OAuth)
router.post('/connect', (req, res) => {
    const { whatsappNumber, preferredTime } = req.body;
    if (!whatsappNumber || whatsappNumber.trim().length < 10) {
        return res.send('<h1>Erro</h1><p>Digite um número de WhatsApp válido, ex: 5511999999999</p>');
    }
    
    // Encoda o número de telefone e o horário preferido no state do OAuth
    const state = `${whatsappNumber.trim()}|${preferredTime || '17:00'}`;
    const url = getAuthUrl(state);
    res.redirect(url);
});

// Callback nativo das credenciais do Google Workspace
router.get('/api/calendar/callback', async (req, res) => {
    const code = req.query.code;
    const rawState = req.query.state || '';
    const [whatsappNumber, preferredTime] = rawState.split('|'); 

    try {
        const user = await handleCallback(code, whatsappNumber, preferredTime);
        const calendars = await listUserCalendars(user.googleTokens);
        
        res.render('select-calendars', {
            whatsappNumber,
            preferredTime,
            calendars
        });
    } catch (err) {
        console.error('Google Callback Error:', err);
        res.send('<h2>Erro de Autenticação</h2><p>Tivemos um problema ao conectar-se aos serviços do Google. Tente novamente.</p>');
    }
});

router.post('/save-calendars', async (req, res) => {
    const { whatsappNumber, selectedCalendars, preferredTime } = req.body;
    
    try {
        const calendars = Array.isArray(selectedCalendars) ? selectedCalendars : (selectedCalendars ? [selectedCalendars] : ['primary']);
        await User.findOneAndUpdate({ whatsappNumber }, { selectedCalendars: calendars });
        
        res.render('success', { whatsappNumber, preferredTime });
    } catch (err) {
        console.error('Save Calendars Error:', err);
        res.send('<h2>Erro ao salvar agendas</h2><p>Tente novamente.</p>');
    }
});

module.exports = router;
