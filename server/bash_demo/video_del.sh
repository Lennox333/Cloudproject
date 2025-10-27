curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
	"$AWSURL/auth/profile" | jq


curl -s -X DELETE "$AWSURL/video/$1" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
