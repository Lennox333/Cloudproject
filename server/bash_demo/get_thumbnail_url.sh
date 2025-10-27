VIDEO_ID=$1
echo "Link to the thumbnail: "
curl -s "$AWSURL/video/thumbnail/$VIDEO_ID" | jq
