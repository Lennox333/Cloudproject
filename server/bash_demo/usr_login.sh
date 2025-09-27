#!/usr/bin/env bash
set -euo pipefail

# username="$1"
# password="$2"

username="ln607090"
password="TestPassword123!"

# Login and save access token
ACCESS_TOKEN=$(curl -s -c cookies.txt \
  -X POST "http://$AWSURL:$PORT/login" \
  -H "Content-Type: application/json" \
  -d "$(printf '{"username":"%s","password":"%s"}' "$username" "$password")" | jq -r '.accessToken')

export ACCESS_TOKEN
