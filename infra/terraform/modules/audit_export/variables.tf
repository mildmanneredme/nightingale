variable "env" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "app_security_group_id" {
  type = string
}

variable "audit_bucket_name" {
  type = string
}

variable "db_secret_arn" {
  type = string
}

variable "kms_key_arn" {
  type = string
}
