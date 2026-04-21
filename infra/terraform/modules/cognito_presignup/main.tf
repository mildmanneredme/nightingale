locals {
  lambda_src = "${path.module}/../../../lambda/cognito-pre-signup"
}

data "archive_file" "pre_signup" {
  type        = "zip"
  source_dir  = local.lambda_src
  output_path = "${path.module}/cognito-pre-signup.zip"
}

resource "aws_iam_role" "pre_signup" {
  name = "nightingale-${var.env}-cognito-presignup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "pre_signup_basic" {
  role       = aws_iam_role.pre_signup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "pre_signup" {
  name              = "/nightingale/${var.env}/cognito-pre-signup"
  retention_in_days = 90
}

resource "aws_lambda_function" "pre_signup" {
  function_name = "nightingale-${var.env}-cognito-pre-signup"
  role          = aws_iam_role.pre_signup.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 5
  memory_size   = 128

  filename         = data.archive_file.pre_signup.output_path
  source_code_hash = data.archive_file.pre_signup.output_base64sha256

  depends_on = [
    aws_cloudwatch_log_group.pre_signup,
    aws_iam_role_policy_attachment.pre_signup_basic,
  ]

  tags = { Name = "nightingale-${var.env}-cognito-pre-signup" }
}
