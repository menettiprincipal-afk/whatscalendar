const express = require('express');
const router = express.Router();
const { getAuthUrl, handleCallback } = require('../services/calendarService');

router.get('/', (req, res) => {
    res.render('index');
});

// A rota captura o formulário, pega o telefone e redireciona (enviando o state na transação OAuth)
router.post('/connect', (req, res) => {
    const { whatsappNumber } = req.body;
    if (!whatsappNumber || whatsappNumber.trim().length < 10) {
        return res.send('<h1>Erro</h1><p>Digite um número de WhatsApp válido, ex: 5511999999999</p>');
    }
    
    const url = getAuthUrl(whatsappNumber.trim());
    res.redirect(url);
});

// Callback nativo das credenciais do Google Workspace
router.get('/api/calendar/callback', async (req, res) => {
    const code = req.query.code;
    const whatsappNumber = req.query.state; 

    try {
        await handleCallback(code, whatsappNumber);
        res.send(`
            <div style="font-family: sans-serif; text-align: center; max-width: 400px; margin: 50px auto; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #25D366;">Conectado com Sucesso!</h2>
                <p>O número <b>${whatsappNumber}</b> foi vinculado ao seu Google Calendar.</p>
                <p>Você começará a receber os seus compromissos todos os dias às 07:00 da manhã no WhatsApp.</p>
            </div>
        `);
    } catch (err) {
        console.error('Google Callback Error:', err);
        res.send('<h2>Erro de Autenticação</h2><p>Tivemos um problema ao conectar-se aos serviços do Google. Tente novamente.</p>');
    }
});

module.exports = router;
