#!/usr/bin/env bash
AWSURL="https://n11772891.cab432.com"

FILE="/home/ln607/Videos/recording_2025-07-24_20-09-43.mp4"
N=50     # number of uploads
CONC=5   # concurrent workers


TOKEN=$(curl -s -X POST "$AWSURL"/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ln60711","password":"Password123!"}' | jq -r '.accessToken')


seq 1 $N | xargs -n1 -P $CONC -I{} bash -c '
  i={};
  UPLOAD_URL=$(curl -s -X POST "'"$AWSURL"'/upload/get-url" \
    -H "Authorization: Bearer '"$TOKEN"'" \
    -H "Content-Type: application/json" | jq -r ".uploadUrl")
  if [[ -z "$UPLOAD_URL" || "$UPLOAD_URL" == "null" ]]; then
    echo "[$i] no upload url" >&2
    exit 1
  fi
  curl -s -X PUT "$UPLOAD_URL" -T "'"$FILE"'" -H "Content-Type: video/mp4" --fail && echo "[$i] OK" || echo "[$i] FAIL"
'
