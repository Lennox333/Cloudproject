FROM node:20

WORKDIR /usr/src/app

# Copy package.json and package-lock.json first for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Install AWS SDK
RUN npm install aws-sdk

# Copy everything else
COPY . .

# Expose port
EXPOSE 3000

# Use nodemon for live reload
CMD ["npm", "run", "dev"]
