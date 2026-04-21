const express = require('express');
const router = express.Router();
const { getAuthUrl, handleCallback } = require('../services/calendarService');

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
        await handleCallback(code, whatsappNumber, preferredTime);
        res.send(`
            <div style="font-family: sans-serif; text-align: center; max-width: 400px; margin: 50px auto; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #25D366;">Conectado com Sucesso!</h2>
                <p>O número <b>${whatsappNumber}</b> foi vinculado ao seu Google Calendar.</p>
                <p>Você começará a receber a sua agenda de compromissos todos os dias às <b>${preferredTime || '17:00'}</b> diretamente no seu WhatsApp.</p>
            </div>
        `);
    } catch (err) {
        console.error('Google Callback Error:', err);
        res.send('<h2>Erro de Autenticação</h2><p>Tivemos um problema ao conectar-se aos serviços do Google. Tente novamente.</p>');
    }
});

module.exports = router;
