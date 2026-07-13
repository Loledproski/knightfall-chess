FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY server.js index.html styles.css app.js ./
COPY engine ./engine

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
