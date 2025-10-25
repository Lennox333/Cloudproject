FROM node:20

WORKDIR /usr/src/app


# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg 
# && rm -rf /var/lib/apt/lists/*
# Copy package.json and package-lock.json first for caching
COPY package*.json ./

# Install dependencies
RUN npm install --production


# Copy everything else
COPY . .

# Expose port
EXPOSE 3000
# Set environment variables

ENV PURPOSE_PARAM=/n11772891/purpose
ENV QUT_USERNAME_PARAM=/n11772891/qut_username
ENV S3_BUCKET_PARAM=/n11772891/s3_bucket
ENV USER_POOL_ID_PARAM=/n11772891/user_pool_id
ENV DYNAMO_TABLE_PARAM=/n11772891/dynamo_table
ENV MEMECACHE_PARAM=/n11772891/memecache
ENV COGNITO_SECRET_NAME=n11772891-cognito-secrets
ENV AWS_REGION=ap-southeast-2


CMD ["node", "video_service.js"]
