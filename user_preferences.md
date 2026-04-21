# Preferências do Usuário (WhatsCalendar)

## UI & Estética
- **Identidade Visual**: Flat design moderno com profundidade através de drop-shadows sob logos e botões.
- **Logotipo**: Evitar emojis como placeholders globais. O logo criado pelo usuário (`logo_sf.png`) triplicado em tamanho e centralizado na Home deve ser mantido.
- **Formulários**: A captura do número de celular no início da interação com o APP exibe input mask elegante: `55 (11) 99999-9999`.

## Backend & Regras de Negócio
- **Horário Flexível**: O disparo da agenda NÃO é travado e estático (ex: `07:00`). O usuário é dono de sua preferência (`preferredTime`) no momento do input primário antes de ir para o OAuth Consent Screen.
- **Admin Flow**: Administrador controla tudo a fundo com a capacidade de verificar status dos Tokens, dar trigger manual em uma agenda caso precise fazer troubleshooting individualizado de um usuário e apagar um usuário permanentemente do BD.
- **Ocultação do Google Crawler**: Evitar submeter URL customizada com informações perdidas. O Link da política de Privacidade é deixado claro e limpo na view principal (index), para evitar que a verificação automática de "Branding" da Google falhe como falso negativo.

## Infraestrutura
- Hospedagem Server: Render (Web Services).
- Node Runtime Baseado em Linux/Debian.
- Não devem ser incluídos Puppeteer e/ou executáveis pesados no bundle.
