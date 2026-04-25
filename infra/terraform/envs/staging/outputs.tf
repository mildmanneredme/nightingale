output "cloudfront_domain" {
  value       = module.cloudfront.domain_name
  description = "Set this as NEXT_PUBLIC_WS_URL in Vercel (prefix with https:// for HTTP, wss:// will be derived in code)"
}
