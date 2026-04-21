variable "github_org" {
  type        = string
  description = "GitHub organisation or username that owns the repo"
}

variable "github_repo" {
  type    = string
  default = "nightingale"
}
