variable "env" {
  type = string
}

variable "alb_dns_name" {
  type        = string
  description = "DNS name of the ALB to use as the CloudFront origin"
}
