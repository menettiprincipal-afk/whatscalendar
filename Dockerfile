FROM node:20-alpine

WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./
RUN npm install

# Copia todo o código fonte
COPY . .

# Expõe a porta e Inicia com limite leve pois nem precisamos mais
EXPOSE 3001
CMD ["node", "--max-old-space-size=150", "server.js"]
