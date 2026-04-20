FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./
RUN npm install

# Copia todo o código fonte
COPY . .

# Corrige as permissões para o usuário restrito não dar erro
RUN chown -R pptruser:pptruser /app

# Retorna para o usuário super restrito criado pela imagem Oficial
USER pptruser

# Expõe e Inicia
EXPOSE 3001
CMD ["npm", "start"]
