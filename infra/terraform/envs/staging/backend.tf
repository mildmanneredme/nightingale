terraform {
  backend "s3" {
    bucket         = "nightingale-tfstate-682812950646"
    key            = "staging/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "nightingale-tf-lock"
    encrypt        = true
  }
}
