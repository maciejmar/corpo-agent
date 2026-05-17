variable "project" {
  type    = string
  default = "corp-agent"
}

variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "openai_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "bedrock_model_id" {
  type    = string
  default = "anthropic.claude-sonnet-4-5-20250929-v1:0"
}

variable "github_org" {
  description = "GitHub username lub nazwa organizacji"
  type        = string
}

variable "github_repo" {
  description = "Nazwa repozytorium (bez prefixu org)"
  type        = string
  default     = "corp-agent"
}
