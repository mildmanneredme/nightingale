locals {
  key_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "EnableIAMUserPermissions"
      Effect   = "Allow"
      Principal = { AWS = "arn:aws:iam::${var.account_id}:root" }
      Action   = "kms:*"
      Resource = "*"
    }]
  })
}

resource "aws_kms_key" "rds" {
  description             = "Nightingale ${var.env} RDS encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = local.key_policy
  tags                    = { Name = "nightingale-${var.env}-rds-key" }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/nightingale-${var.env}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

resource "aws_kms_key" "s3" {
  description             = "Nightingale ${var.env} S3 encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = local.key_policy
  tags                    = { Name = "nightingale-${var.env}-s3-key" }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/nightingale-${var.env}-s3"
  target_key_id = aws_kms_key.s3.key_id
}
