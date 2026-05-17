output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "backend_ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "frontend_ecr_repository_url" {
  value = aws_ecr_repository.frontend.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_app_service_name" {
  value = aws_ecs_service.app.name
}

output "github_actions_role_arn" {
  description = "Wklej jako AWS_ROLE_TO_ASSUME w GitHub Secrets"
  value       = aws_iam_role.github_actions.arn
}
