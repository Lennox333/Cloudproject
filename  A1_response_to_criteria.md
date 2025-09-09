Assignment 1 - REST API Project - Response to Criteria
================================================

Overview
------------------------------------------------

- **Name:** Liam Nguyen
- **Student number:** n11772891
- **Application name:** MyHub
- **Two line description:** This app transcode videos that users have uploaded. They can view, delete the videos.  

Core criteria
------------------------------------------------

### Containerise the app

- **ECR Repository name:** n11772891/resapi-server  / n11772891/resapi-client
- **Video timestamp:** 00:00
- **Relevant files:** 
    - server/Dockerfile
    - webclient/Dockerfile

### Deploy the container

- **EC2 instance ID:** i-06b242b60c91f3011
- **Video timestamp:** 1:10

### User login

- **One line description:** Registered in the database to login, use JWT and cookies to manage user session
- **Video timestamp:** 3:55
- **Relevant files:**
    - server/server.js
    - server/middleware/authentication.js

### REST API

- **One line description:** REST API endpoints with appropriate status code, HTTP methods include GET POST DELETE
- **Video timestamp:** 3:42
- **Relevant files:**
    - server/server.js
    - server/utils/fetchVideos.js
    - server/utils/streamfile.js
    - server/utils/storage.js
    - server/utils/deleteVideo.js
    - server/utils/database.js

### Data types

- **One line description:** 
- **Video timestamp:** 3:20
- **Relevant files:**
    - init.sql

#### First kind

- **One line description:** Video files
- **Type:** Unstructured
- **Rationale:** Videos are too large for database.  No need for additional functionality.
- **Video timestamp:** 
- **Relevant files:**
    - server/utils/storage.js

#### Second kind

- **One line description:** User and Videos information
- **Type:** Structured, no ACID requirements
- **Rationale:** Need to be able to query for user and video data
- **Video timestamp:**
- **Relevant files:**
  - server/utils/database.js

### CPU intensive task

 **One line description:** Video transcoding
- **Video timestamp:** 1:51
- **Relevant files:**
    - server/utils/ffmpeg.js

### CPU load testing

 **One line description:**  Multiple file transcoding to stress the CPU  
- **Video timestamp:** 1:51
- **Relevant files:**
    - 

Additional criteria
------------------------------------------------

### Extensive REST API features

- **One line description:** Pagination and filtering for /videos and /videos/userId endpoint
- **Video timestamp:** 04:26
- **Relevant files:**
    - server/server.js



### Infrastructure as code

- **One line description:** Using Docker compose for application deployment
- **Video timestamp:** 1:12
- **Relevant files:**
    - docker-compose-from-ecr.yml

### Web client

- **One line description:** Basic web client to interact with the API
- **Video timestamp:** 1:30
- **Relevant files:**
    - webclient/*
