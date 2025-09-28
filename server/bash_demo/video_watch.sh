VIDEO_ID=$1
res=$2
echo "Link to watch: "
curl -s "http://$AWSURL:$PORT/video/$VIDEO_ID/stream?res=$res" | jq

