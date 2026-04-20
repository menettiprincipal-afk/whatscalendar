# Preferências do Usuário e Decisões de Infraestrutura

- **Estilo de Código**: (A ser preenchido com as preferências do usuário, como uso de TypeScript, linting, etc.)
- **Decisões de Infraestrutura**: 
  - **Proibição Absoluta de IA/LLM**: Não utilizar chamadas externas pagas para formatar as mensagens. Tudo deve ser String Concat/Template Literal puro no JavaScript (Custo Zero).
  - Web App Monolítico em Express (Node.js) + MongoDB.
  - O sistema deve focar em Autonomia na Nuvem (preparo para deploy no Render/Railway, persistência de volume/BD seguro).
