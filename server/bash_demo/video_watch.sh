VIDEO_ID=$1
echo "Link to watch: "
curl -s "http://$AWSURL:$PORT/video/$VIDEO_ID/stream" | jq

