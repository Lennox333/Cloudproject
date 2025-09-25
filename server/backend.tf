provider "aws" {
  region = "ap-southeast-2"
}

# ----------------------------
# Variables
# ----------------------------
variable "qut_username" {
  type    = string
  default = "n11772891"
}

variable "purpose" {
  type        = string
  description = "assignment"
}

# ----------------------------
# 1. EC2 Instance using existing Launch Template (t3.micro)
# ----------------------------
resource "aws_instance" "ecs_instance" {
  launch_template {
    id      = "lt-0da254432ded0d3d7"  # REPLACE with your existing Launch Template ID
    version = "$Latest"
  }

  # Override the instance type to t3.micro
  instance_type = "t3.micro"

  # Optional additional tags for this specific instance
  tags = {
    QUT_USERNAME = var.qut_username
    PURPOSE      = var.purpose
    Name         = "ECS-Backend-Instance"
  }
}

# ----------------------------
# 2. ECS Cluster
# ----------------------------
resource "aws_ecs_cluster" "backend_cluster" {
  name = "n11772891_server"

  tags = {
    QUT_USERNAME = var.qut_username
    PURPOSE      = var.purpose
  }
}

# ----------------------------
# 3. ECS Task Definition (Backend Only, EC2)
# ----------------------------
resource "aws_ecs_task_definition" "backend_task" {
  family                   = "backend-task"
  requires_compatibilities = ["EC2"]
  network_mode             = "bridge"

  # Keep full 2 vCPU / 1 GB RAM for FFmpeg processing
  cpu                      = "2048"   # 2 vCPUs
  memory                   = "1024"   # 1 GB RAM
  execution_role_arn       = "arn:aws:iam::901444280953:role/CAB432-Instance-Role"

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/resapi-server:latest"
      essential = true
      portMappings = [{ containerPort = 3000, hostPort = 3000 }]
      environment = [
        { name = "PURPOSE_PARAM", value = "/n11772891/purpose" },
        { name = "QUT_USERNAME_PARAM", value = "/n11772891/qut_username" },
        { name = "S3_BUCKET_PARAM", value = "/n11772891/s3_bucket" },
        { name = "USER_POOL_ID_PARAM", value = "/n11772891/user_pool_id" },
        { name = "COGNITO_SECRET_NAME", value = "n11772891-cognito-secrets" },
        { name = "AWS_REGION", value = "ap-southeast-2" }
      ]
    }
  ])

  tags = {
    QUT_USERNAME = var.qut_username
    PURPOSE      = var.purpose
  }
}

# ----------------------------
# 4. ECS Service (EC2 Launch Type)
# ----------------------------
resource "aws_ecs_service" "backend_service" {
  name            = "backend-service"
  cluster         = aws_ecs_cluster.backend_cluster.id
  task_definition = aws_ecs_task_definition.backend_task.arn
  desired_count   = 1
  launch_type     = "EC2"

  tags = {
    QUT_USERNAME = var.qut_username
    PURPOSE      = var.purpose
  }
}
