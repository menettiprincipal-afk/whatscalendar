# WhatsCalendar Architecture

## Integrações
1. **Baileys (WebSockets WhatsApp)**: Usado para enviar as agendas via canal WhatsApp individualmente para cada usuário. A sessão é persistida em `String` no MongoDB Atlas para prevenir `SessionError` após reiniciar a VM do Render.
2. **Google OAuth 2.0**: O usuário faz logon após inputar o WhatsApp, nos dá permissão de escopo `.readonly` (e e-mail para exibirmos no painel). Os tokens (access_token, refresh_token) são guardados no MongoDB individualmente.
3. **MongoDB Atlas (Mongoose)**: Banco principal armazenando sessões Baileys (`AuthState`) e os usuários (`Users`) com seus respectivos tokens e `preferredTime`.
4. **Node-Cron**: O `cronService.js` inicializa uma task cron executada a cada minuto na porta da VM para investigar se existe algum usuário daquele minuto e chamar o `runRoutineForUsers`. Adminstrador pode atirar pra todo mundo agnosticamente pelo Dashboard via `/force-cron`.

## Componentes

### Frontend (`index.ejs` & `admin.ejs`)
- `index.ejs`: Recebe um input mascarado do WhatsApp do usuário e o seu horário preferido via um formulário interligado por route parameters. A UI implementa Flat Design com Drop Shadow.
- `admin.ejs`: Dashboard simplificado (protegido por senha ambiente) listando todos os usuários e provendo a funcionalidade individual (`📤 Enviar Agenda`) e master-trigger (`🚀 Disparar Agendas`).

### Backend (`app.js` -> `server.js`)
- Express webserver rodando na porta dinâmica do Render
- `calendarService.js`: Motor do Google Auth2 e extrator da agenda (`calendar.events.list(...)`).
- `whatsappService.js`: Motor WebSocket usando Baileys + Mongoose Adapter para enviar os eventos em forma de texto no formato `- [HH:MM]: <Titulo>`.
- `cronService.js`: Agendador e loop por usuário rodando internamente assíncrono para enviar as rotinas.
