output "rds_key_arn" {
  value = aws_kms_key.rds.arn
}

output "s3_key_arn" {
  value = aws_kms_key.s3.arn
}
