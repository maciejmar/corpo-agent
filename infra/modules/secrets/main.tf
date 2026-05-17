locals {
  secrets = {
    anthropic_api_key = var.anthropic_api_key
    openai_api_key    = var.openai_api_key
    qdrant_url        = var.qdrant_url
    qdrant_api_key    = var.qdrant_api_key
    db_password       = var.db_password
  }
}

resource "aws_secretsmanager_secret" "app" {
  for_each                = local.secrets
  name                    = "${var.project}/${var.environment}/${each.key}"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.project}-${var.environment}-${each.key}" }
}

resource "aws_secretsmanager_secret_version" "app" {
  for_each      = local.secrets
  secret_id     = aws_secretsmanager_secret.app[each.key].id
  secret_string = each.value
}
