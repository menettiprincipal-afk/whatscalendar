const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { runDailyRoutine } = require('../services/cronService');

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
        res.render('admin', { users });
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
