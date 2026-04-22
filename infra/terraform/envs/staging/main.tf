terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
  required_version = ">= 1.7"
}

provider "aws" {
  region = "ap-southeast-2"
}

locals {
  env        = "staging"
  account_id = "682812950646"
}

module "vpc" {
  source = "../../modules/vpc"
  env    = local.env
}

module "kms" {
  source     = "../../modules/kms"
  env        = local.env
  account_id = local.account_id
}

module "iam" {
  source               = "../../modules/iam"
  env                  = local.env
  account_id           = local.account_id
  github_org           = var.github_org
  github_repo          = var.github_repo
  create_oidc_provider = true
}

module "s3" {
  source      = "../../modules/s3"
  env         = local.env
  kms_key_arn = module.kms.s3_key_arn
}

module "ecr" {
  source     = "../../modules/ecr"
  account_id = local.account_id
}

module "alb" {
  source            = "../../modules/alb"
  env               = local.env
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
}

module "rds" {
  source                = "../../modules/rds"
  env                   = local.env
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.private_subnet_ids
  app_security_group_id = module.alb.app_security_group_id
  kms_key_arn           = module.kms.rds_key_arn
  multi_az                = false
  instance_class          = "db.t3.micro"
  backup_retention_period = 1
}

module "ecs" {
  source                = "../../modules/ecs"
  env                   = local.env
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  app_security_group_id = module.alb.app_security_group_id
  target_group_arn      = module.alb.target_group_arn
  task_role_arn         = module.iam.ecs_task_role_arn
  execution_role_arn    = module.iam.ecs_execution_role_arn
  ecr_repository_url    = module.ecr.api_repository_url
  db_secret_arn         = module.rds.secret_arn
  db_host               = module.rds.db_host
  cognito_user_pool_id  = module.cognito.user_pool_id
  cognito_client_id     = module.cognito.web_client_id
}

module "waf" {
  source  = "../../modules/waf"
  env     = local.env
  alb_arn = module.alb.alb_arn
}

module "security" {
  source            = "../../modules/security"
  env               = local.env
  audit_bucket_name = module.s3.audit_bucket_name
  account_id        = local.account_id
  rds_instance_id   = module.rds.instance_id
  ecs_cluster_name  = module.ecs.cluster_name
  ecs_service_name  = module.ecs.service_name
}

module "cognito_presignup" {
  source = "../../modules/cognito_presignup"
  env    = local.env
}

module "cognito" {
  source                = "../../modules/cognito"
  env                   = local.env
  account_id            = local.account_id
  pre_signup_lambda_arn = module.cognito_presignup.lambda_arn
}

module "audit_export" {
  source                = "../../modules/audit_export"
  env                   = local.env
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  app_security_group_id = module.alb.app_security_group_id
  audit_bucket_name     = module.s3.audit_bucket_name
  db_secret_arn         = module.rds.secret_arn
  kms_key_arn           = module.kms.s3_key_arn
}
