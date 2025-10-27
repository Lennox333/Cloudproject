# Use Node.js 20 slim image
FROM node:20-slim

# Set working directory
WORKDIR /usr/src/app

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node dependencies
RUN npm install --production

# Copy application code
COPY . .


# Set environment variables
ENV PURPOSE_PARAM=/n11772891/purpose
ENV QUT_USERNAME_PARAM=/n11772891/qut_username
ENV S3_BUCKET_PARAM=/n11772891/s3_bucket
# ENV USER_POOL_ID_PARAM=/n11772891/user_pool_id
ENV DYNAMO_TABLE_PARAM=/n11772891/dynamo_table
ENV MEMECACHE_PARAM=/n11772891/memecache
# ENV COGNITO_SECRET_NAME=n11772891-cognito-secrets
ENV AWS_REGION=ap-southeast-2
ENV SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11772891-video-queue
# Start worker
CMD ["node", "services/worker/worker.js"]
