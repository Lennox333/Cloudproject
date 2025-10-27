CLUSTER="gr24-a3"

# List of services
SERVICES=(
  "gr24-upload-service-pwsv4138"
  "gr24-auth-service-service-7xu825nr"
  "gr24-a3-general-ednpoint-service-8g2yaz91"
  "gr24-video-service-cd3tach1"
  "gr24-a3-worker-transcode-service-ijffe0xk"
)

# Loop and force new deployment
for SERVICE in "${SERVICES[@]}"; do
  echo "Updating service $SERVICE..."
  aws ecs update-service \
    --cluster $CLUSTER \
    --service $SERVICE \
    --force-new-deployment
done