#!/usr/bin/env bash
set -euo pipefail

# Read optional args
UPLD_BEFORE="${1:-}"
UPLD_AFTER="${2:-}"
LIMIT="${3:-10}"
LAST_KEY="${4:-}"

# Get userId from /profile
USER_JSON=$(curl -s -b cookies.txt "http://$AWSURL:$PORT/profile")
USER_ID=$(echo "$USER_JSON" | jq -r '.userId')

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  echo "Failed to fetch userId from profile"
  return
fi

# Build query string
QUERY="?"
[ -n "$UPLD_BEFORE" ] && QUERY+="upld_before=$UPLD_BEFORE&"
[ -n "$UPLD_AFTER" ] && QUERY+="upld_after=$UPLD_AFTER&"
[ -n "$LIMIT" ] && QUERY+="limit=$LIMIT&"
[ -n "$LAST_KEY" ] && QUERY+="lastKey=$(jq -c -n "$LAST_KEY")&"

# Remove trailing &
QUERY="${QUERY%&}"

# Fetch user videos
curl -s "http://$AWSURL:$PORT/videos/$USER_ID$QUERY" | jq
