require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

const { initWhatsApp } = require('./src/services/whatsappService');
const { initCron } = require('./src/services/cronService');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do express e EJS para HTML views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'whatsapp_calendar_secret_123',
    resave: false,
    saveUninitialized: true
}));

const publicRoutes = require('./src/routes/publicRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('🟢 Conectado ao MongoDB (Atlas Válido)!');
    // Inicializa WhatsApp só DEPOIS que o Mongoose estiver conectado, pois a Store Remota exige isso.
    initWhatsApp();
    // Inicializa o Engine de Crons
    initCron();
    
    app.listen(PORT, () => {
        console.log(`🚀 Servidor Web rodando na porta ${PORT}`);
    });
  })
  .catch(err => console.error('🔴 Erro ao conectar no banco MongoDB:', err));
