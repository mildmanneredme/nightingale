locals {
  lambda_src = "${path.module}/../../../lambda/audit-export"
}

data "archive_file" "audit_export" {
  type        = "zip"
  source_dir  = local.lambda_src
  output_path = "${path.module}/audit-export.zip"
}

resource "aws_iam_role" "audit_export" {
  name = "nightingale-${var.env}-audit-export-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "audit_export" {
  name = "audit-export-policy"
  role = aws_iam_role.audit_export.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:ap-southeast-2:*:*"
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.db_secret_arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "arn:aws:s3:::${var.audit_bucket_name}/audit-export/*"
      },
      {
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey", "kms:Decrypt"]
        Resource = var.kms_key_arn
      },
      # VPC networking permissions
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.audit_export_dlq.arn
      }
    ]
  })
}

resource "aws_security_group" "audit_export" {
  name        = "nightingale-${var.env}-audit-export-sg"
  description = "Audit export Lambda - egress to RDS and S3"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "nightingale-${var.env}-audit-export-sg" }
}

resource "aws_cloudwatch_log_group" "audit_export" {
  name              = "/nightingale/${var.env}/audit-export"
  retention_in_days = 90
}

resource "aws_lambda_function" "audit_export" {
  function_name = "nightingale-${var.env}-audit-export"
  role          = aws_iam_role.audit_export.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 300
  memory_size   = 256

  filename         = data.archive_file.audit_export.output_path
  source_code_hash = data.archive_file.audit_export.output_base64sha256

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.audit_export.id]
  }

  environment {
    variables = {
      DB_SECRET_ARN = var.db_secret_arn
      DB_HOST       = ""  # injected at deploy time via ECS/SSM — RDS endpoint
      DB_NAME       = "nightingale"
      DB_USER       = "nightingale_admin"
      AUDIT_BUCKET  = var.audit_bucket_name
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.audit_export,
    aws_iam_role_policy.audit_export,
  ]

  tags = { Name = "nightingale-${var.env}-audit-export" }
}

# Hourly EventBridge schedule — PRD-005 F-005
resource "aws_cloudwatch_event_rule" "hourly" {
  name                = "nightingale-${var.env}-audit-export-hourly"
  description         = "Trigger audit export Lambda every hour"
  schedule_expression = "rate(1 hour)"
  tags                = { Name = "nightingale-${var.env}-audit-export-hourly" }
}

resource "aws_cloudwatch_event_target" "audit_export" {
  rule      = aws_cloudwatch_event_rule.hourly.name
  target_id = "AuditExportLambda"
  arn       = aws_lambda_function.audit_export.arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.audit_export.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.hourly.arn
}

# Dead-letter queue for failed export retries — PRD-005 NFR (async retry)
resource "aws_sqs_queue" "audit_export_dlq" {
  name                      = "nightingale-${var.env}-audit-export-dlq"
  message_retention_seconds = 1209600 # 14 days
  tags                      = { Name = "nightingale-${var.env}-audit-export-dlq" }
}

resource "aws_lambda_function_event_invoke_config" "audit_export" {
  function_name = aws_lambda_function.audit_export.function_name

  destination_config {
    on_failure {
      destination = aws_sqs_queue.audit_export_dlq.arn
    }
  }

  maximum_retry_attempts = 2
}
