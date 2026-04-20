# Arquitetura e Estrutura: WhatsApp Calendar Middleware

# 1. Visão Geral
Aplicação monolítica em Node.js usando Express, servindo como "middleware" entre a API do Google Calendar e o WhatsApp. O serviço autentica e coleta permissão de calendário de usuários usando Google OAuth2, lê suas agendas diariamente (07:00 AM originariamente), e dispara os compromissos do dia no Whatsapp usando o WWebJS headless.

# 2. Infraestrutura e Hospedagem
- **Ambiente Desempenhado**: VPS Linux, Render ou Railway. O Puppeteer foi modificado para executar com as flags `--no-sandbox` e `--disable-setuid-sandbox`.
- **Persistência Global da Sessão**: MongoDB usando Atlas Clusters e a biblioteca `wwebjs-mongo`, garantindo que toda a sessão do WhatsApp fique na nuvem e o QR Code precise ser lido apenas 1 única vez para toda a vida do projeto.
- **Armazenamento de BD**: Uso direto da Connection String longa do Atlas (non-SRV) para esquivar de limites DNS em certas VPS/bandas largas.

# 3. Soluções e Handlers Adicionados
- [x] **Tratamento de Contato / Lid**: Formatação explícita validada (`+55`) garantindo envios perfeitos no BR. Adicionado auto validation do DDD com o `.getNumberId()`.
- [x] **Handler do RemoteAuth**: Criada rotina autônoma com *setInterval* (Cão de Guarda) checando a constância do diretório temporário (`/Default`) para corrigir o bug de scan dir onde o navegador cronicamente excluia a pasta antes de um backup de sessão.

# 4. Funcionalidades e UX
- **Painel Administrativo (`/admin`)**: Visualização em lista dos usuários, permissão para apagar da base e *o principal*: botão integrado **"🚀 Disparar Agendas"** que força uma leitura do banco de dados na hora, simulando o comportamento original do cron de 7h e enviando notificações imediatamente.
- **Sincronização Cronológica**: `node-cron` controlando a assiduidade de envios. Timezone forçado no script para evitar desalinhamento.
