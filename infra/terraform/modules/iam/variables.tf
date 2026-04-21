variable "env" {
  type = string
}

variable "account_id" {
  type = string
}

variable "github_org" {
  type = string
}

variable "github_repo" {
  type    = string
  default = "nightingale"
}

# Set false in prod — the OIDC provider is a global resource, created once in staging
variable "create_oidc_provider" {
  type    = bool
  default = true
}
