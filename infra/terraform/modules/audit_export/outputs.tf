output "lambda_arn" {
  value = aws_lambda_function.audit_export.arn
}

output "dlq_arn" {
  value = aws_sqs_queue.audit_export_dlq.arn
}
