# AWS deployment

Ten katalog uruchamia aplikacje na AWS:

- ECS Fargate: `frontend` i `backend` w jednym tasku za Application Load Balancerem
- RDS PostgreSQL 16
- Qdrant jako osobny serwis ECS z dyskiem EFS
- Claude Sonnet przez Amazon Bedrock
- sekrety w AWS Secrets Manager
- obrazy w ECR

## Wymagania

1. Konto AWS z wlaczonym dostepem do modelu Anthropic Claude Sonnet w Amazon Bedrock.
2. S3 bucket na Terraform state i DynamoDB table na locki.
3. Rola IAM dla GitHub OIDC zapisana w sekrecie repozytorium `AWS_ROLE_TO_ASSUME`.
4. Sekrety GitHub:
   - `AWS_ROLE_TO_ASSUME`
   - `TF_STATE_BUCKET`
   - `TF_LOCK_TABLE`
   - `OPENAI_API_KEY` dla transkrypcji audio
   - opcjonalnie `ANTHROPIC_API_KEY` dla workflow `agentic-review`

## Lokalny plan

```bash
terraform init \
  -backend-config="bucket=<tf-state-bucket>" \
  -backend-config="key=corp-agent/terraform.tfstate" \
  -backend-config="region=eu-central-1" \
  -backend-config="dynamodb_table=<tf-lock-table>"

terraform plan \
  -var="openai_api_key=<openai-key>" \
  -var="image_tag=<existing-ecr-image-tag>"
```

## Deployment z GitHub Actions

Workflow `.github/workflows/deploy-aws.yml` robi:

1. `terraform apply -target` dla repozytoriow ECR, zeby pierwszy build mial gdzie wypchnac obrazy.
2. Build i push obrazow `backend` i `frontend` z tagiem `github.sha`.
3. Pelny `terraform apply`.
4. Smoke test `/` i `/health` przez publiczny ALB.

Domyslny region to `eu-central-1`, a domyslny model Bedrock to:

```text
anthropic.claude-sonnet-4-5-20250929-v1:0
```

Model mozna zmienic przez zmienna Terraform `bedrock_model_id`.
