variable "project"       { type = string }
variable "environment"   { type = string }
variable "aws_region"    { type = string }
variable "account_id"    { type = string }
variable "secret_arns"   { type = map(string) }
variable "ecr_repo_arns" { type = list(string) }
variable "github_org"    { type = string }
variable "github_repo"   { type = string }
