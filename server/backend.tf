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
  type    = string
  default = "assignment"
}



# ----------------------------
# EC2 Instance using existing Launch Template
# ----------------------------
resource "aws_instance" "backend_ec2" {
  launch_template {
    id      = "lt-0da254432ded0d3d7"  # your Launch Template ID
    version = "$Latest"
  }

  # User data: install Docker, login to ECR, pull and run container
  user_data = <<-EOF
              #!/bin/bash
              # Install Docker if not already installed
              which docker || (apt update && apt install -y docker.io)
              systemctl start docker
              systemctl enable docker

              # Login to ECR
              aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com

              # Pull and run backend container
              docker pull 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/resapi-server:latest
              docker run -d -p 5000:5000 \
                -e PURPOSE_PARAM=/n11772891/purpose \
                -e QUT_USERNAME_PARAM=/n11772891/qut_username \
                -e S3_BUCKET_PARAM=/n11772891/s3_bucket \
                -e USER_POOL_ID_PARAM=/n11772891/user_pool_id \
                -e COGNITO_SECRET_NAME=n11772891-cognito-secrets \
                -e AWS_REGION=ap-southeast-2 \
                901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11772891/resapi-server:latest
              EOF
    tags = {
        Name         = "Backend-Instance"
    }


}
