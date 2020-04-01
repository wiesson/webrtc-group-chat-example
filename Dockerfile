FROM node:13-alpine

WORKDIR /usr/src/app

COPY dist/index.html dist/server.js package*.json ./
RUN npm install

EXPOSE 8080
CMD [ "node", "server.js" ]
