#!/usr/bin/env bash
set -euo pipefail

# Usage: ./upload.sh <filename> <title> [description]

if [ $# -lt 2 ]; then
  echo "Usage: $0 <filename> <title> [description]"
  return
fi

FILENAME="$1"
TITLE="$2"
DESCRIPTION="${3:-}"

# Get presigned upload URL
response=$(curl -s -b cookies.txt -X POST "http://$AWSURL:$PORT/get-upload-url")
UPLOAD_URL=$(echo "$response" | jq -r '.uploadUrl')
VIDEO_ID=$(echo "$response" | jq -r '.videoId')
S3_KEY=$(echo "$response" | jq -r '.s3Key')


if [ -z "$UPLOAD_URL" ] || [ -z "$VIDEO_ID" ]; then
  echo "Failed to get upload URL"
  echo "$response"
  return
fi

echo "Uploading $FILENAME to $UPLOAD_URL..."

# Upload the file
curl -s -X PUT "$UPLOAD_URL" --upload-file "$FILENAME"

echo "Upload complete, starting encode..."

# Start transcoding
curl -s -b cookies.txt -X POST "http://$AWSURL:$PORT/start-encode" \
  -H "Content-Type: application/json" \
  -d "{\"videoId\":\"$VIDEO_ID\",\"s3Key\":\"$S3_KEY\",\"title\":\"$TITLE\",\"description\":\"$DESCRIPTION\"}"

echo "Encoding started for videoId: $VIDEO_ID"

# curl -X PUT "$UPLOAD_URL" \
#   -T "/home/ln607/Videos/recording_2025-07-24_20-09-43.mp4" \
#   -H "Content-Type: video/mp4"