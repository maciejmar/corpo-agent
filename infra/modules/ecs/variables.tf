variable "project"            { type = string }
variable "environment"        { type = string }
variable "aws_region"         { type = string }
variable "vpc_id"             { type = string }
variable "public_subnet_ids"  { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "alb_sg_id"          { type = string }
variable "backend_sg_id"      { type = string }
variable "backend_image_uri"  { type = string }
variable "task_role_arn"      { type = string }
variable "exec_role_arn"      { type = string }
variable "db_url"             { type = string; sensitive = true }
variable "secret_arns"        { type = map(string) }
variable "qdrant_collection"  { type = string; default = "corp_agent" }
