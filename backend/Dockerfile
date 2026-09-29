FROM node:20-alpine AS base

WORKDIR /app

# Instalar herramientas para compilaciones nativas si fuera necesario
RUN apk add --no-cache libc6-compat

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

# Usuario sin privilegios por seguridad DevSecOps
USER node

CMD ["node", "src/index.js"]
