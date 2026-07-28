---
key: "Terraform Modules"
title: "Terraform Modules"
crumb: "15. Cloud & DevOps › Terraform"
---

Module là unit tái sử dụng trong Terraform — nhóm resource liên quan thành một khối có input/output rõ ràng, giống function trong lập trình.

## Điểm Chính

- **Root module**: thư mục chứa file `.tf` đang chạy terraform commands.
- **Child module**: module được gọi từ root hoặc module khác qua `module` block.
- Module có 3 file cốt lõi: `main.tf` (logic), `variables.tf` (input), `outputs.tf` (output).
- **Module sources**: local path, Git URL, Terraform Registry (`registry.terraform.io`).
- `version` constraint bắt buộc với registry modules — tránh breaking changes.
- Không pass provider vào module — module kế thừa provider từ root (best practice).

## Ví Dụ Code

*Module structure, calling modules, input/output, module composition*

```
# Cấu trúc thư mục điển hình
infrastructure/
├── modules/                   ← reusable modules
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── eks-cluster/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── rds/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
└── environments/
    ├── prod/
    │   ├── main.tf            ← gọi modules
    │   ├── variables.tf
    │   ├── outputs.tf
    │   └── terraform.tfvars
    └── staging/
        ├── main.tf
        └── terraform.tfvars
```

```hcl
# modules/vpc/variables.tf — input của module
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
}

variable "environment" {
  type        = string
  description = "Environment name (prod, staging, dev)"
}

variable "public_subnet_count" {
  type        = number
  default     = 2
}

variable "private_subnet_count" {
  type        = number
  default     = 2
}
```

```hcl
# modules/vpc/main.tf — logic của module
data "aws_availability_zones" "available" {}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  tags = { Name = "${var.environment}-vpc", Environment = var.environment }
}

resource "aws_subnet" "public" {
  count                   = var.public_subnet_count
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "${var.environment}-public-${count.index}" }
}

resource "aws_subnet" "private" {
  count             = var.private_subnet_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "${var.environment}-private-${count.index}" }
}
```

```hcl
# modules/vpc/outputs.tf — output của module
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.this.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}
```

```hcl
# environments/prod/main.tf — gọi modules và compose
# Local module
module "vpc" {
  source = "../../modules/vpc"    # local path

  vpc_cidr             = "10.0.0.0/16"
  environment          = "prod"
  public_subnet_count  = 3
  private_subnet_count = 3
}

# Dùng output của vpc module làm input cho eks module
module "eks" {
  source = "../../modules/eks-cluster"

  cluster_name    = "prod-cluster"
  vpc_id          = module.vpc.vpc_id              # output của module trên
  subnet_ids      = module.vpc.private_subnet_ids  # output của module trên
  node_group_size = 3
}

# Registry module (public Terraform Registry)
module "rds" {
  source  = "terraform-aws-modules/rds/aws"  # registry.terraform.io
  version = "~> 6.0"                         # version constraint BẮT BUỘC

  identifier     = "prod-orders-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.medium"
  db_subnet_group_name   = module.vpc.database_subnet_group
  vpc_security_group_ids = [aws_security_group.rds.id]
}

# Git source (private modules)
module "internal_vpc" {
  source = "git::https://github.com/mycompany/terraform-modules.git//vpc?ref=v2.1.0"
}
```

```hcl
# environments/prod/outputs.tf — re-export module outputs
output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  value     = module.rds.db_instance_endpoint
  sensitive = true   # không hiện trong CLI output
}
```

## Ứng Dụng Thực Tế

Version pin registry modules (`version = "~> 6.0"` cho phép patch updates, chặn breaking changes). Test module với `terraform plan` trong `environments/dev/` trước khi apply prod. Tên output nên consistent: `vpc_id`, `subnet_ids`, `cluster_endpoint` — dễ compose giữa modules. Không hardcode region hay account ID trong module — nhận qua variable để module reusable cross-account.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Module giải quyết vấn đề gì? Khi nào nên tách code thành module?</strong></summary>

**A:** Module giải quyết **DRY** (Don't Repeat Yourself) — tránh copy-paste config VPC, RDS, EKS cluster giữa prod và staging. Khi nào tách: (1) Cùng pattern được dùng ≥ 2 lần (VPC setup, ECS service, RDS instance). (2) Logic phức tạp nên ẩn sau interface đơn giản (EKS cluster với node groups, add-ons, IAM roles). (3) Cần version riêng cho infrastructure component. **Không** tách quá sớm — nếu chỉ dùng 1 lần, inline trong root module vẫn ok hơn premature abstraction.

</details>

<details>
<summary><strong>Version constraint `~> 6.0` có nghĩa gì? Cách chọn constraint?</strong></summary>

**A:** `~> 6.0` = "pessimistic constraint operator" — cho phép `6.x` (patch + minor), chặn `7.x` (major). Tương đương `>= 6.0, < 7.0`. Các dạng phổ biến: `= 6.2.1` (pin exact), `>= 6.0` (any từ 6.0 trở lên — rủi ro), `~> 6.2` (cho phép `6.2.x`, chặn `6.3`), `~> 6.0` (cho phép `6.x`). **Recommendation**: dùng `~> X.Y` (minor locked) cho production — nhận patch fixes nhưng tránh minor breaking changes. Sau khi upgrade test xong, update constraint và commit.

</details>

<details>
<summary><strong>Module output có thể sensitive không? Xử lý thế nào?</strong></summary>

**A:** Output có thể mark `sensitive = true` — Terraform ẩn giá trị trong CLI output (`(sensitive value)`), nhưng vẫn lưu plaintext trong state file. Khi gọi `module.rds.db_password`, giá trị vẫn dùng được trong resource khác, chỉ không hiện ra màn hình. **Lưu ý**: sensitive output của module propagate lên — nếu root module dùng sensitive output làm resource argument, resource đó cũng trở thành sensitive trong plan output. Để thực sự bảo mật: không lưu secret trong Terraform state — dùng AWS Secrets Manager và data source để lấy secret, không hardcode trong tfvars.

</details>
