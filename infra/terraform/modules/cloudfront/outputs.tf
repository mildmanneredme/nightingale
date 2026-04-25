output "domain_name" {
  value       = aws_cloudfront_distribution.api.domain_name
  description = "CloudFront domain name (*.cloudfront.net) — use as NEXT_PUBLIC_WS_URL in Vercel"
}

output "distribution_id" {
  value = aws_cloudfront_distribution.api.id
}
