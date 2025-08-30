FROM node:20
RUN apt-get update && apt-get install -y ffmpeg mariadb-server && rm -rf /var/lib/apt/lists/* 
WORKDIR /app
COPY package*.json ./
RUN npm install --production

# Copy application source code
COPY . .

# Expose the application port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]

