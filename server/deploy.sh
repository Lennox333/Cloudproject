docker-compose down
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
docker rmi -f $(docker images -q)
docker volume rm $(docker volume ls -q)

git pull
docker-compose up -d
docker logs -f server-app-1 