
git pull


docker build -t worker-service -f services/worker/Dockerfile .
docker build -t auth-service -f services/auth/Dockerfile .
docker build -t root-service -f services/root/Dockerfile .
docker build -t video-service -f services/video/Dockerfile .
docker build -t upload-service -f services/upload/Dockerfile .


docker tag worker-service 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/resapi-server_worker_service:latest
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/resapi-server_worker_service:latest

docker tag auth-service 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/service-auth:latest
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/service-auth:latest

docker tag root-service 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/service-general:latest
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/service-general:latest

docker tag video-service 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/service-video:latest
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/service-video:latest

docker tag upload-service 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/service-upload:latest
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/service-upload:latest