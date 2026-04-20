const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const { runDailyRoutine, initCron } = require('../services/cronService');

const checkAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

router.get('/login', (req, res) => {
    res.render('adminLogin', { error: null });
});

router.post('/auth', (req, res) => {
    if (req.body.password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.render('adminLogin', { error: 'Senha Invalida!' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// Listagem do Dashboard (C da sigla CRUD)
router.get('/', checkAdmin, async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        let scheduleConfig = await SystemConfig.findOne({ key: 'CRON_SCHEDULE' });
        const cronTime = scheduleConfig ? scheduleConfig.value : '17:00';

        res.render('admin', { users, cronTime });
    } catch (error) {
        res.status(500).send('Erro ao buscar lista de usuários.');
    }
});

router.post('/delete/:id', checkAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Erro ao excluir usuário');
    }
});

router.post('/schedule', checkAdmin, async (req, res) => {
    try {
        const { time } = req.body;
        // Validação simples (HH:MM)
        if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
            await SystemConfig.findOneAndUpdate(
                { key: 'CRON_SCHEDULE' },
                { value: time },
                { upsert: true }
            );
            // Recarrega o cron do zero no servidor para abraçar o novo horário na mesma hora
            await initCron(); 
        }
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Erro ao alterar horário.');
    }
});

router.post('/force-cron', checkAdmin, async (req, res) => {
    try {
        // Dispara de forma assíncrona (não prende a tela)
        runDailyRoutine();
        // Espera 1 segudno para o script pegar tração e volta
        setTimeout(() => res.redirect('/admin'), 1000);
    } catch (err) {
        res.status(500).send('Erro ao disparar rotina.');
    }
});

module.exports = router;
