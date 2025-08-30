FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 1234
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
