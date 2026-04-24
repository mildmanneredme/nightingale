resource "aws_ecs_cluster" "main" {
  name = "nightingale-${var.env}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "nightingale-${var.env}" }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/nightingale/${var.env}/api"
  retention_in_days = 90
}

resource "aws_ecs_task_definition" "api" {
  family                   = "nightingale-${var.env}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  task_role_arn            = var.task_role_arn
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${var.ecr_repository_url}:${var.env}-latest"
    essential = true

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    secrets = [
      {
        name      = "DB_PASSWORD"
        valueFrom = var.db_secret_arn
      },
      {
        name      = "GEMINI_API_KEY"
        valueFrom = var.gemini_api_key_secret_arn
      }
    ]

    environment = [
      { name = "APP_ENV",               value = var.env },
      { name = "PORT",                   value = "8080" },
      { name = "DB_HOST",               value = var.db_host },
      { name = "DB_NAME",               value = var.db_name },
      { name = "DB_USER",               value = var.db_user },
      { name = "COGNITO_USER_POOL_ID",  value = var.cognito_user_pool_id },
      { name = "COGNITO_CLIENT_ID",     value = var.cognito_client_id },
      { name = "AWS_REGION",            value = "ap-southeast-2" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/nightingale/${var.env}/api"
        "awslogs-region"        = "ap-southeast-2"
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "nightingale-${var.env}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.app_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "api"
    container_port   = 8080
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  # Ignore task_definition changes — deployments are managed by CI/CD, not Terraform
  lifecycle {
    ignore_changes = [task_definition]
  }

  depends_on = [aws_ecs_task_definition.api]
}
