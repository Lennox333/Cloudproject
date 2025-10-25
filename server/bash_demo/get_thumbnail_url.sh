VIDEO_ID=$1
echo "Link to the thumbnail: "
curl -s "http://$AWSURL:$PORT/thumbnail/$VIDEO_ID" | jq
