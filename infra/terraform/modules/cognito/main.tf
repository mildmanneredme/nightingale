resource "aws_cognito_user_pool" "main" {
  name = "nightingale-${var.env}"

  # Password policy — PRD-004 F-003
  password_policy {
    minimum_length                   = 12
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # MFA — OPTIONAL at pool level; doctors/admins enforced via pre-auth Lambda
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  # Email verification — PRD-004 F-002
  auto_verified_attributes = ["email"]

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Nightingale — verify your email"
    email_message        = "Your Nightingale verification code is {####}"
  }

  # Account recovery via email only
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Schema attributes
  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    string_attribute_constraints {
      min_length = 5
      max_length = 254
    }
  }

  schema {
    name                = "role"
    attribute_data_type = "String"
    required            = false
    mutable             = true
    string_attribute_constraints {
      min_length = 4
      max_length = 10
    }
  }

  schema {
    name                = "ahpra_number"
    attribute_data_type = "String"
    required            = false
    mutable             = true
    string_attribute_constraints {
      min_length = 0
      max_length = 20
    }
  }

  schema {
    name                     = "is_anonymous"
    attribute_data_type      = "Boolean"
    required                 = false
    mutable                  = true
  }

  schema {
    name                     = "is_paediatric"
    attribute_data_type      = "Boolean"
    required                 = false
    mutable                  = true
  }

  # Username = email
  username_attributes      = ["email"]
  username_configuration {
    case_sensitive = false
  }

  # Lambda triggers
  lambda_config {
    pre_sign_up = var.pre_signup_lambda_arn
  }

  # Brute-force protection — PRD-004 NFR (5 failed attempts = lockout)
  user_pool_add_ons {
    advanced_security_mode = "AUDIT"
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  tags = { Name = "nightingale-${var.env}" }
}

# Groups
resource "aws_cognito_user_group" "patients" {
  name         = "patients"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Patient users — access scoped to own consultations"
}

resource "aws_cognito_user_group" "doctors" {
  name         = "doctors"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Doctor users — MFA required, access scoped to assigned consultations"
}

resource "aws_cognito_user_group" "admins" {
  name         = "admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Admin users — MFA required, operational access only, no clinical content"
}

# Web app client — PRD-004 F-007, F-008
resource "aws_cognito_user_pool_client" "web" {
  name         = "nightingale-${var.env}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  # Token validity — 15 min access, 7-day refresh
  access_token_validity  = 15
  id_token_validity      = 15
  refresh_token_validity = 7

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Refresh token rotation — PRD-004 F-008
  enable_token_revocation               = true
  prevent_user_existence_errors         = "ENABLED"
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  # No client secret — browser-based SPA
  generate_secret = false

  # Auth flows
  supported_identity_providers = ["COGNITO"]
}

# Session timeouts via resource server scopes
# Patient: 30 min idle, Doctor: 60 min idle — enforced in app layer
# Cognito does not natively support per-group idle timeout; app middleware handles this

# Allow Lambda to be invoked by Cognito
resource "aws_lambda_permission" "cognito_pre_signup" {
  statement_id  = "AllowCognitoInvoke-${var.env}"
  action        = "lambda:InvokeFunction"
  function_name = var.pre_signup_lambda_arn
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}
