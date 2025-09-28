curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "http://$AWSURL:$PORT/profile"

curl -s -X DELETE "http://$AWSURL:$PORT/video/$1" -H "Authorization: Bearer $ACCESS_TOKEN"