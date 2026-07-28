---
key: "Terraform State Management"
title: "Terraform State Management"
crumb: "15. Cloud & DevOps › Terraform"
---

Terraform State là file JSON theo dõi mapping giữa HCL config và resource thật trên cloud — không có state, Terraform không biết resource nào đang tồn tại để update hay destroy.

## Điểm Chính

- **State file** (`terraform.tfstate`): JSON map `resource address → cloud resource ID + attributes`.
- **Remote state**: lưu state trên S3/GCS/Terraform Cloud thay vì local — bắt buộc trong team.
- **State locking**: DynamoDB (AWS) hoặc GCS object lock ngăn hai người apply cùng lúc.
- **State drift**: resource thật bị thay đổi ngoài Terraform (manual) → state != reality.
- `terraform import`: đưa resource đã tồn tại vào quản lý của Terraform.
- **Workspace**: nhiều state độc lập từ cùng config (dev/staging/prod).

## Ví Dụ Code

*Remote state backend, locking, import và workspace*

```hcl
# backend.tf — remote state trên AWS S3 + DynamoDB lock
terraform {
  backend "s3" {
    bucket         = "my-company-terraform-state"
    key            = "services/order-service/prod/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true                    # encrypt at rest
    dynamodb_table = "terraform-state-lock"  # tên table DynamoDB để lock
  }
}
```

```bash
# Tạo S3 bucket và DynamoDB table (làm 1 lần, dùng AWS CLI)
aws s3api create-bucket \
  --bucket my-company-terraform-state \
  --region ap-southeast-1

aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

```bash
# State lock hoạt động như thế nào
terraform apply
# → Terraform ghi lock vào DynamoDB: {LockID: "bucket/key.tfstate"}
# → Nếu người khác chạy apply cùng lúc:
#   Error: Error acquiring the state lock
#   Lock Info: ID=xxx, Who=user@machine, Created=2024-01-01
# → Sau khi apply xong: tự động release lock

# Nếu apply crash, lock không tự release → force unlock
terraform force-unlock <lock-id>
```

```bash
# State drift — phát hiện và xử lý
terraform plan  # nếu resource bị sửa ngoài Terraform → plan hiện diff

# Xem state hiện tại
terraform state list                          # list tất cả resource trong state
terraform state show aws_vpc.main             # xem chi tiết 1 resource
terraform show                                # xem toàn bộ state

# Refresh state (sync với reality)
terraform refresh                             # update state từ cloud (deprecated)
terraform apply -refresh-only                # phiên bản mới — chỉ refresh, không apply

# Import resource đã tồn tại vào Terraform (không tạo mới)
terraform import aws_vpc.main vpc-0a1b2c3d4e  # <resource_address> <cloud_resource_id>
terraform import aws_s3_bucket.logs my-logs-bucket

# Sau import: terraform plan phải show "No changes" nếu config khớp với reality
```

```bash
# State operations — dùng khi refactor
terraform state mv aws_instance.web aws_instance.app   # rename resource address
terraform state rm aws_s3_bucket.old                   # remove khỏi state (không destroy)

# Move resource sang state file khác (split monolith)
terraform state pull > old.tfstate
terraform state push new.tfstate
```

```hcl
# Workspace — nhiều environment từ cùng config
# Mỗi workspace có state file riêng: s3://bucket/key/env:/<workspace>/terraform.tfstate
```

```bash
# Workspace commands
terraform workspace list          # default, staging, prod
terraform workspace new staging   # tạo workspace mới
terraform workspace select prod   # switch sang prod
terraform workspace show          # workspace hiện tại

# Dùng workspace trong config
resource "aws_instance" "app" {
  instance_type = terraform.workspace == "prod" ? "t3.medium" : "t3.micro"
}
```

```hcl
# Output từ state của module khác — remote state data source
data "terraform_remote_state" "vpc" {
  backend = "s3"
  config = {
    bucket = "my-company-terraform-state"
    key    = "infra/vpc/prod/terraform.tfstate"
    region = "ap-southeast-1"
  }
}

# Dùng output từ VPC state
resource "aws_subnet" "app" {
  vpc_id = data.terraform_remote_state.vpc.outputs.vpc_id
}
```

## Ứng Dụng Thực Tế

Tổ chức state theo layer: `infra/vpc`, `infra/eks`, `services/order-service` — state nhỏ hơn = plan nhanh hơn, blast radius nhỏ hơn khi có lỗi. Không bao giờ edit state file thủ công — dùng `terraform state mv/rm`. Enable S3 versioning để rollback state khi cần. Dùng `terraform plan -refresh-only` định kỳ để detect drift.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao phải dùng remote state thay vì local state?</strong></summary>

**A:** Local state (`terraform.tfstate` trong repo) có 3 vấn đề: (1) **Concurrency**: 2 người apply cùng lúc → state corrupt, resource bị duplicate hoặc conflict. (2) **Sharing**: teammate không có state → không thể plan/apply. (3) **Security**: state chứa sensitive data (DB password, private key) — không nên commit lên git. Remote state (S3 + DynamoDB) giải quyết cả 3: centralized, locked, encrypted. Nếu vô tình commit state → `git rm --cached terraform.tfstate`, add vào `.gitignore`, rotate tất cả secrets trong state.

</details>

<details>
<summary><strong>State drift là gì? Cách phát hiện và xử lý?</strong></summary>

**A:** State drift xảy ra khi resource thật bị thay đổi ngoài Terraform (manual click console, script khác, auto-scaling thay đổi config). **Phát hiện**: `terraform plan` hoặc `terraform apply -refresh-only` — Terraform so sánh state với reality, hiện diff. **Xử lý**: (1) Nếu muốn giữ config Terraform: `terraform apply` override thay đổi manual về trạng thái config. (2) Nếu muốn giữ thay đổi manual: update config HCL để match, rồi `terraform apply -refresh-only` update state. (3) Nếu resource bị xóa ngoài Terraform: `terraform import` đưa lại vào state, hoặc `terraform state rm` rồi để Terraform recreate. **Phòng ngừa**: enforce "no manual changes" policy, dùng Service Control Policy (AWS) chặn access console.

</details>

<details>
<summary><strong>Terraform workspace và tạo folder riêng per environment khác nhau thế nào?</strong></summary>

**A:** **Workspace approach**: cùng config, nhiều state. Nhược điểm: khó có cấu hình khác nhau nhiều giữa prod và dev, dễ nhầm đang ở workspace nào, không support well trong team lớn. **Folder per environment** (`environments/dev/`, `environments/prod/`): mỗi env có config riêng và state riêng, linh hoạt hơn nhưng duplicate code. **Best practice (thực tế)**: dùng modules để share logic, folder per environment cho config: `environments/prod/main.tf` gọi module `modules/vpc/`, pass different vars. Terraform workspace phù hợp cho simple cases hoặc feature branches, không nên dùng cho prod/staging separation.

</details>
