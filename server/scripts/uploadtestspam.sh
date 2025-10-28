#!/usr/bin/env bash
AWSURL="https://n11772891.cab432.com"
FILE="/home/ln607/Videos/recording_2025-07-24_20-09-43.mp4"
N=50     # number of uploads
CONC=5   # concurrent workers

TOKEN=$(curl -s -X POST "$AWSURL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"ln60711","password":"Password123!"}' | jq -r '.accessToken')

seq 1 $N | xargs -n1 -P $CONC -I{} bash -c '
i=$1
token=$2
file=$3
awsurl=$4

UPLOAD_URL=$(curl -s -X POST "$awsurl/upload/get-url" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"My Video Title\", \"description\": \"Optional description here\"}" \
  | jq -r ".uploadUrl")

if [[ -z "$UPLOAD_URL" || "$UPLOAD_URL" == "null" ]]; then
  echo "[$i] no upload url" >&2
  exit 1
fi

curl -s -X PUT "$UPLOAD_URL" -T "$file" -H "Content-Type: video/mp4" --fail && echo "[$i] OK" || echo "[$i] FAIL"
' _ {} "$TOKEN" "$FILE" "$AWSURL"
