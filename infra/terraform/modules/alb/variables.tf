variable "env" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

# Leave empty until you have an ACM certificate — HTTP redirect still works
variable "certificate_arn" {
  type    = string
  default = ""
}
