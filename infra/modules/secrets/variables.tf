variable "project"           { type = string }
variable "environment"       { type = string }
variable "anthropic_api_key" { type = string; sensitive = true; default = "" }
variable "openai_api_key"    { type = string; sensitive = true; default = "" }
variable "qdrant_url"        { type = string; default = "" }
variable "qdrant_api_key"    { type = string; sensitive = true; default = "" }
variable "db_password"       { type = string; sensitive = true }
