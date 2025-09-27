#!/usr/bin/env bash
set -euo pipefail

# Usage: ./register.sh <username> <password> <email>
if [ $# -ne 3 ]; then
  echo "Usage: $0 <username> <password> <email>"
  exit 1
fi

username="$1"
password="$2"
email="$3"

echo "Registering user: $username (email: $email) -> $AWSURL:$PORT/register"

# Send request and print raw output
curl -s -X POST "http://$AWSURL:$PORT/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$username\",\"password\":\"$password\",\"email\":\"$email\"}"
