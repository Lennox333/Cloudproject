#!/usr/bin/env bash
set -euo pipefail

# fetch_videos.sh [upld_before] [upld_after] [limit] [lastKey]

UPLD_BEFORE="${1:-}"
UPLD_AFTER="${2:-}"
LIMIT="${3:-10}"
LAST_KEY="${4:-}"

# Build query string
QUERY="?"
[ -n "$UPLD_BEFORE" ] && QUERY+="upld_before=$UPLD_BEFORE&"
[ -n "$UPLD_AFTER" ] && QUERY+="upld_after=$UPLD_AFTER&"
[ -n "$LIMIT" ] && QUERY+="limit=$LIMIT&"
[ -n "$LAST_KEY" ] && QUERY+="lastKey=$(jq -c -n "$LAST_KEY")&"

# Remove trailing &
QUERY="${QUERY%&}"

# Send request and pretty print JSON
curl -s "http://$AWSURL:$PORT/videos$QUERY" | jq
