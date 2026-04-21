resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "nightingale/${var.env}/db-password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

resource "aws_db_subnet_group" "main" {
  name       = "nightingale-${var.env}-db-subnet-group"
  subnet_ids = var.subnet_ids
  tags       = { Name = "nightingale-${var.env}-db-subnet-group" }
}

resource "aws_security_group" "rds" {
  name        = "nightingale-${var.env}-rds-sg"
  description = "RDS - accepts traffic only from the app security group"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
    description     = "PostgreSQL from app layer only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "nightingale-${var.env}-rds-sg" }
}

resource "aws_db_instance" "main" {
  identifier        = "nightingale-${var.env}"
  engine            = "postgres"
  engine_version    = "16.6"
  instance_class    = var.instance_class
  allocated_storage = 50
  storage_type      = "gp3"

  db_name  = var.db_name
  username = "nightingale_admin"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  storage_encrypted = true
  kms_key_id        = var.kms_key_arn

  backup_retention_period   = var.backup_retention_period
  backup_window             = "03:00-04:00"
  maintenance_window        = "Mon:04:00-Mon:05:00"
  copy_tags_to_snapshot     = true

  multi_az            = var.multi_az
  publicly_accessible = false
  deletion_protection = true

  skip_final_snapshot       = false
  final_snapshot_identifier = "nightingale-${var.env}-final-snapshot"

  # TLS enforced via parameter group
  parameter_group_name = aws_db_parameter_group.main.name

  tags = { Name = "nightingale-${var.env}" }
}

resource "aws_db_parameter_group" "main" {
  name   = "nightingale-${var.env}-pg16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = { Name = "nightingale-${var.env}-pg16" }
}
