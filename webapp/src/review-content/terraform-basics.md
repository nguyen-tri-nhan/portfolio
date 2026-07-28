---
key: "Terraform Basics & HCL Syntax"
title: "Terraform Basics & HCL Syntax"
crumb: "15. Cloud & DevOps › Terraform"
---

Terraform là Infrastructure as Code (IaC) tool của HashiCorp — mô tả hạ tầng bằng HCL (HashiCorp Configuration Language), sau đó tạo/update/destroy resource thật trên cloud provider.

## Điểm Chính

- **Provider**: plugin kết nối với AWS, GCP, Azure, Kubernetes... Mỗi provider expose resource types.
- **Resource**: đơn vị hạ tầng cơ bản (`aws_vpc`, `aws_instance`, `kubernetes_deployment`).
- **Variable**: input param để reuse config. **Output**: export value ra ngoài module.
- **Data source**: đọc resource đã tồn tại (không tạo mới) — ví dụ lấy AMI ID mới nhất.
- **Locals**: computed values dùng nội bộ trong module, không expose ra ngoài.
- Workflow: `init` → `plan` → `apply` → `destroy`.

## Ví Dụ Code

*Cấu trúc file HCL cơ bản — provider, variable, resource, data source, output*

```hcl
# provider.tf — khai báo provider và version
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"    # minor updates ok, major không
    }
  }
  # Remote state (sẽ nói kỹ ở State Management)
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/vpc/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "terraform-lock"
  }
}

provider "aws" {
  region = var.aws_region
}
```

```hcl
# variables.tf — input parameters
variable "aws_region" {
  type        = string
  description = "AWS region to deploy resources"
  default     = "ap-southeast-1"
}

variable "environment" {
  type    = string
  # không có default → bắt buộc phải pass vào
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}
```

```hcl
# main.tf — resource definitions
locals {
  common_tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# Data source: lấy thông tin đã có, không tạo mới
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# Resource: tạo VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(local.common_tags, { Name = "main-vpc" })
}

# Resource dùng attribute của resource khác
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id          # reference resource attribute
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = merge(local.common_tags, { Name = "public-${count.index}" })
}
```

```hcl
# outputs.tf — export values cho module khác hoặc CLI output
output "vpc_id" {
  description = "ID of the created VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}
```

```bash
# Workflow cơ bản
terraform init          # download providers, setup backend
terraform validate      # check syntax (không cần creds)
terraform plan          # diff: current state vs config (dry run)
terraform plan -out=tfplan  # save plan để apply sau
terraform apply tfplan  # apply saved plan (không prompt)
terraform apply -auto-approve  # skip confirmation (dùng trong CI)
terraform destroy       # xóa tất cả resource trong state

# Pass variables
terraform plan -var="environment=staging"
terraform plan -var-file="staging.tfvars"
```

```hcl
# staging.tfvars — variable values file
aws_region  = "ap-southeast-1"
environment = "staging"
vpc_cidr    = "10.1.0.0/16"
tags = {
  Team    = "platform"
  CostCenter = "engineering"
}
```

## Ứng Dụng Thực Tế

Tách file theo mục đích: `provider.tf`, `variables.tf`, `main.tf`, `outputs.tf`. Dùng `locals` để tránh lặp tag — define một lần, reuse khắp nơi. `data source` thay vì hardcode AMI ID hay subnet ID — infra tự cập nhật khi resource thay đổi. Luôn dùng `terraform validate` trong CI trước khi plan.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Terraform khác Ansible và CloudFormation thế nào?</strong></summary>

**A:** **Terraform vs Ansible**: Terraform là *declarative* IaC — mô tả *trạng thái mong muốn* (desired state), Terraform tự tính ra diff và apply. Ansible là *imperative* config management — mô tả *các bước thực hiện* (procedural). Terraform quản lý infra lifecycle (create/update/destroy), Ansible quản lý config bên trong server (install packages, config files). Dùng kết hợp: Terraform tạo EC2, Ansible configure EC2. **Terraform vs CloudFormation**: CloudFormation là AWS-native (chỉ AWS), Terraform multi-cloud (AWS + GCP + Azure + Kubernetes...). CloudFormation dùng JSON/YAML verbose, Terraform dùng HCL ngắn gọn hơn. State management: CloudFormation tự quản lý, Terraform cần setup remote state. CloudFormation tích hợp tốt hơn với AWS services (StackSets, Service Catalog).

</details>

<details>
<summary><strong>`count` và `for_each` khác nhau thế nào? Khi nào dùng cái nào?</strong></summary>

**A:** `count` dùng index (0, 1, 2...) — khi xóa phần tử giữa list, index thay đổi → Terraform plan destroy/recreate tất cả resource phía sau. `for_each` dùng key từ map hoặc set — stable keys, xóa một phần tử chỉ affect resource đó. **Rule**: dùng `for_each` khi resource có identity riêng biệt (subnet per AZ, IAM role per team). Dùng `count` cho boolean on/off (`count = var.enabled ? 1 : 0`). Ví dụ `for_each`: `for_each = toset(["us-east-1a", "us-east-1b"])` → key là AZ name, stable khi thêm/bớt AZ.

</details>

<details>
<summary><strong>Data source khác resource thế nào?</strong></summary>

**A:** **Resource**: Terraform *tạo và quản lý* lifecycle (create/update/destroy). Xóa resource block → Terraform destroy resource thật. **Data source**: Terraform chỉ *đọc* thông tin từ resource đã tồn tại — không tạo, không destroy. Dùng khi: lấy AMI ID mới nhất (`data.aws_ami`), lấy VPC ID của environment khác (`data.aws_vpc`), lấy secret từ AWS Secrets Manager. Data source refresh mỗi lần plan — luôn có giá trị mới nhất.

</details>

<details>
<summary><strong>`terraform plan` output có ý nghĩa gì? Đọc plan như thế nào?</strong></summary>

**A:** Plan output dùng ký hiệu: `+` create mới, `-` destroy, `~` update in-place, `-/+` destroy rồi recreate (immutable attribute thay đổi — ví dụ AMI ID của EC2). **Quan trọng**: `-/+` gây downtime — phải review kỹ. `(known after apply)` = giá trị chỉ biết sau khi tạo resource (ví dụ IP address). Luôn đọc plan trước apply, đặc biệt chú ý `-` và `-/+` vì đây là destructive operations. Trong CI/CD: save plan với `-out=tfplan`, apply từ saved plan để tránh drift giữa plan và apply.

</details>
