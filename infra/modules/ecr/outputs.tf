output "backend_repo_url" { value = aws_ecr_repository.backend.repository_url }
output "repo_arns"        { value = [aws_ecr_repository.backend.arn] }
