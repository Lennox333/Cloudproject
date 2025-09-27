VIDEO_ID=$1
echo "Link to the thumbnail: "
curl -s "http://$AWSURL:$PORT/thumbnails/$VIDEO_ID" | jq
