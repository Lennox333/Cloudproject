Assignment 2 - Cloud Services Exercises - Response to Criteria
================================================

Instructions
------------------------------------------------
- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections.  If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed


Overview
------------------------------------------------

- **Name:** Liam Nguyen
- **Student number:** n11772891
- **Partner name (if applicable):** Wais Nassiry n11547413
- **Application name:** MyHub
- **Two line description:** A video streaming server;
- **EC2 instance name or ID:**

------------------------------------------------

### Core - First data persistence service

- **AWS service name:**   S3
- **What data is being stored?:**  video files, thumbnails
- **Why is this service suited to this data?:** large files are best suited to blob storage due to size restrictions on other services
- **Why is are the other services used not suitable for this data?:**
- **Bucket/instance/table name:**
- **Video timestamp:2:51
- **Relevant files:**
    - s3.js

### Core - Second data persistence service

- **AWS service name:** DynamoDB
- **What data is being stored?:** Videos metadata ( userId, videoId, uploadDate, title, description) 
- **Why is this service suited to this data?:** NoSQL is faster than relational RB, less strict on schema
- **Why is are the other services used not suitable for this data?:**
- **Bucket/instance/table name:**
- **Video timestamp:3:14
- **Relevant files:**
    - dynamoSetup.js

### Third data service

- **AWS service name:**  [eg. RDS]
- **What data is being stored?:** [eg video metadata]
- **Why is this service suited to this data?:** [eg. ]
- **Why is are the other services used not suitable for this data?:** [eg. Advanced video search requires complex querries which are not available on S3 and inefficient on DynamoDB]
- **Bucket/instance/table name:**
- **Video timestamp:**
- **Relevant files:**
    -

### S3 Pre-signed URLs

- **S3 Bucket names:** n11772891-a2
- **Video timestamp:2:51
- **Relevant files:**
    - s3.js

### In-memory cache

- **ElastiCache instance name:** a2-gr41
- **What data is being cached?:** pre-signed urls of videos, admin status
- **Why is this data likely to be accessed frequently?:** In case of having thousands of users, caching them until urls or user token expires will reduce the loading time. The longer the expiry time, the greater it avoids repeated url/token regeration.
- **Video timestamp:2:07
- **Relevant files:**
    - cache.js

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:** None, all temporary data, such as presigned URLs and admin status, is stored in AWS-managed cache services (ElastiCache) rather than in the application itself. The transcodes was uploaded directly from ffmpeg via multipart s3 upload
- **Why is this data not considered persistent state?:** The application does not depend on this cache for correctness; losing the cache does not result in data loss
- **How does your application ensure data consistency if the app suddenly stops?:** No permanent state resides in the app; all critical data is persisted in cloud services (S3, Cognito, Dynamo).
On restart, cached presigned URLs and admin status are repopulated.
- **Relevant files:**
    - utils/**

### Graceful handling of persistent connections

- **Type of persistent connection and use:** [eg. server-side-events for progress reporting]
- **Method for handling lost connections:** [eg. client responds to lost connection by reconnecting and indicating loss of connection to user until connection is re-established ]
- **Relevant files:**
    -

### Core - Authentication with Cognito

- **User pool name:** "User pool - fcph79"
- **How are authentication tokens handled by the client?:**  Response to login request sets a cookie containing the token.
- **Video timestamp:1:00
- **Relevant files:**
    - cognitoClient.js
    - middleware/authentication.js

### Cognito multi-factor authentication

- **What factors are used for authentication:** password + email pin
- **Video timestamp:3:52
- **Relevant files:**
    - server.js
    - users.js

### Cognito federated identities

- **Identity providers used:**
- **Video timestamp:**
- **Relevant files:**
    -

### Cognito groups

- **How are groups used to set permissions?:** 'admin' users can delete  other user's videos
- **Video timestamp:3:57
- **Relevant files:**
    - videos.js

### Core - DNS with Route53

- **Subdomain**:  n11772891.cab432.com
- **Video timestamp:0:25

### Parameter store

- **Parameter names:**  
    - /n11772891/purpose
    - /n11772891/qut_username
    - /n11772891/s3_bucket
    - /n11772891/user_pool_id
    - /n11772891/dynamo_table
    - /n11772891/memecache
- **Video timestamp:**
- **Relevant files:**
    - envManager.js

### Secrets manager

- **Secrets names:**  n11772891-cognito-secrets
- **Video timestamp:5:00
- **Relevant files:**
    - envManager.js

### Infrastructure as code

- **Technology used:**  Terraform
- **Services deployed:** EC2 instance
- **Video timestamp:0:05
- **Relevant files:**
    - backend.tf


### Other (with prior approval only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -

### Other (with prior permission only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -
