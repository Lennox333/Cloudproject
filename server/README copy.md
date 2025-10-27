---
title: "CAB432 Project Report"
author:
- "Liam Nguyen - n11772891"
- "<The second partner's name> - n1234568"
---

# Application overview


The application is simply a streaming service, where user can upload their video. Once uploaded, it will transcode the videos into 3 resolution: 360/480/720. After which, user can view their videos along with other videos from other users.

# Application architecture
                            ┌────────────────────┐
                            │      User          │
                            │ (Browser / Client) │
                            └─────────┬──────────┘
                                      │
                                      ▼
                            ┌────────────────────┐
                            │     Route 53       │
                            │ (DNS Routing)      │
                            └─────────┬──────────┘
                                      │
                                      ▼
                            ┌────────────────────┐
                            │ Application Load   │
                            │    Balancer (ALB)  │
                            └─────────┬──────────┘
                                      │
               ┌──────────────────────┼──────────────────────┐
               │                      │                      │
               ▼                      ▼                      ▼
      ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
      │ Auth Service   │     │ Upload Service │     │ Video Service  │
      └────────────────┘     └────────────────┘     └────────────────┘
               │                      │                      │
               │                      │                      │
               │                      ▼                      │
               │       ┌───────────────────────────┐          │
               │       │ /upload/get-url endpoint  │          │
               │       │ returns pre-signed S3 URL │          │
               │       └──────────────┬────────────┘          │
               │                      │                       │
               │                      ▼                       │
               │            ┌────────────────────┐             │
               │            │  Amazon S3 Bucket  │             │
               │            └─────────┬──────────┘             │
               │                      │                       │
               │                      ▼                       │
               │            ┌────────────────────┐             │
               │            │ AWS Lambda Trigger │             │
               │            └─────────┬──────────┘             │
               │                      │                       │
               │                      ▼                       │
               │            ┌────────────────────┐             │
               │            │ Amazon SQS Queue   │             │
               │            └─────────┬──────────┘             │
               │                      │                       │
               │                      ▼                       │
               │            ┌────────────────────┐             │
               │            │  Worker Service    │             │
               │            │ (FFmpeg Transcode) │             │
               │            └─────────┬──────────┘             │
               │                      │                       │
               │                      ▼                       │
               │            ┌────────────────────┐             │
               │            │  Amazon S3 Output  │             │
               │            └─────────┬──────────┘             │
               │                      │                       │
               │                      ▼                       │
               │            ┌────────────────────┐             │
               │            │ Video Service      │             │
               │            │ (Streaming URL)    │             │
               │            └─────────┬──────────┘             │
               │                      │                       │
               │                      ▼                       │
               └──────────────────► User (Streams Video) ◄─────┘


*Remove these instructions:*
*Your architecture diagram goes here*

*Briefly discuss the use of each service*
*Example:
* - S3: used to store user uploaded and transcoded video files, and video thumbnails*


## Project Core - Microservices

- **First service functionality:** [eg. Public facing API server]
- **First service compute:** [eg. EC2/Lambda/ECS, instance ID/name]
- **First service source files:**
  - [eg. source code filenames or directory]

- **Second service functionality:** 
- **Second service compute:**
- **Second service source files:**
  - 

- **Video timestamp:**


## Project Additional - Additional microservices

- **Third service functionality:**
- **Third service compute:**
- **Third service source files:**
  - 

- **Fourth service functionality:**
- **Fourth service compute:**
- **Fourth service source files:**
  - 

- **Video timestamp:**


## Project Additional - Serverless functions

- **Service(s) deployed on Lambda:**
- **Video timestamp:**
- **Relevant files:**
    -


## Project Additional - Container orchestration with ECS 

- **ECS cluster name:**
- **Task definition names:**
- **Video timestamp:**
- **Relevant files:**
    -


## Project Core - Load distribution

- **Load distribution mechanism:** [eg. SQS, ALB,...]
- **Mechanism instance name:** [eg. n1234567-project-alb]
- **Video timestamp:**
- **Relevant files:**
    -


## Project Additional - Communication mechanisms

- **Communication mechanism(s):** [eg. SQS, EventBridge, ...]
- **Mechanism instance name:** [eg. n1234567-project-sqs]
- **Video timestamp:**
- **Relevant files:**
    -


## Project Core - Autoscaling

- **EC2 Auto-scale group or ECS Service name:**
- **Video timestamp:**
- **Relevant files:**
    -


## Project Additional - Custom scaling metric

- **Description of metric:** [eg. age of oldest item in task queue]
- **Implementation:** [eg. custom cloudwatch metric with lambda]
- **Rationale:** [discuss both small and large scales]
- **Video timestamp:**
- **Relevant files:**
    -


## Project Core - HTTPS

- **Domain name:**
- **Certificate ID:**
- **ALB/API Gateway name:**
- **Video timestamp:**
- **Relevant files:**
    -


## Project Additional - Container orchestration features

- **First additional ECS feature:** [eg. service discovery]
- **Second additional ECS feature:**
- **Video timestamp:**
- **Relevant files:**
    -


## Project Additional - Infrastructure as Code

- **Technology used:** [eg. CloudFormation, Terraform, ...]
- **Services deployed:** [eg. ALB, SQS, ....  Only Block 3 services need to be listed]
- **Video timestamp:**
- **Relevant files:**
    -


## Project Additional - Dead letter queue

- **Technology used:** [eg. SQS, ...]
- **Services deployed:** [eg. SQS, ....  Only Block 3 services need to be listed]
- **Video timestamp:**
- **Relevant files:**
    -


## Project Additional - Edge Caching

- **Cloudfront Distribution ID:**
- **Content cached:**
- **Rationale for caching:**
- **Video timestamp:**
- **Relevant files:**
    -


## Project Additional - Other (with prior permission only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -


# Cost estimate

*Remove these instructions:*
*Include the public share link from the AWS cost calculator*
*Include a summary of the total price  per month for each AWS service that you use*
*eg:*
*- EC2: 25.75*

# Scaling up


# Security


# Sustainability


# Bibliography

*Remove this section if not being used.*

