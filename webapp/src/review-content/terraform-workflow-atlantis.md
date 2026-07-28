---
key: "Terraform Workflow & Atlantis"
title: "Terraform Workflow & Atlantis"
crumb: "15. Cloud & DevOps › Terraform"
---

Terraform workflow chuẩn hóa quy trình review infra thay đổi qua PR. Atlantis tự động hóa workflow đó bằng cách trigger terraform plan/apply từ GitHub/GitLab comment — không cần SSH vào server.

## Điểm Chính

- **GitOps for infra**: PR = infra change request, merge = apply. Mọi thay đổi có audit trail.
- **Atlantis**: webhook server — nhận GitHub comment, chạy terraform trên server, post kết quả lên PR.
- Atlantis cần cloud credentials (IAM role) và access vào remote state backend.
- **atlantis.yaml**: config file tại root repo — định nghĩa projects, workflows, autoplan rules.
- **Locking**: Atlantis lock workspace khi plan/apply, chặn concurrent operation trên cùng infra.
- Alternative: GitHub Actions + Terraform, Terraform Cloud, Spacelift.

## Ví Dụ Code

*GitOps workflow, atlantis.yaml, custom workflow, lệnh comment*

```
# GitOps Terraform Workflow
─────────────────────────────────────────────────────────
Developer
  │
  ├─ 1. git checkout -b feature/add-rds-instance
  ├─ 2. Sửa .tf files
  ├─ 3. git push + open PR
  │
GitHub PR
  │
  ├─ 4. Atlantis auto-detect thay đổi → tự chạy `terraform plan`
  │     (nếu autoplan enabled trong atlantis.yaml)
  │
  ├─ 5. Atlantis post plan output lên PR comment
  │
Reviewer
  │
  ├─ 6. Review plan output — kiểm tra resource nào thay đổi
  ├─ 7. Approve PR
  │
Developer/Reviewer
  │
  ├─ 8. Comment "atlantis apply" trên PR
  │
Atlantis
  │
  ├─ 9. Run terraform apply
  ├─ 10. Post apply output lên PR
  │
  └─ 11. Auto-merge PR (nếu configured)
─────────────────────────────────────────────────────────
```

```yaml
# atlantis.yaml — đặt ở root repo
version: 3

projects:
  - name: prod-vpc
    dir: environments/prod/vpc
    workspace: default
    autoplan:
      when_modified:
        - "**/*.tf"
        - "../../modules/vpc/**/*.tf"   # plan khi module thay đổi
      enabled: true
    apply_requirements:
      - approved      # ít nhất 1 approval trước khi apply
      - mergeable     # PR không có conflict

  - name: staging-vpc
    dir: environments/staging/vpc
    workspace: default
    autoplan:
      enabled: true
    # staging không cần approval

  - name: prod-eks
    dir: environments/prod/eks
    workflow: eks-workflow   # dùng custom workflow
    autoplan:
      when_modified: ["**/*.tf"]
      enabled: false   # manual plan only cho EKS (risky)
    apply_requirements:
      - approved
      - mergeable

workflows:
  eks-workflow:
    plan:
      steps:
        - init:
            extra_args: ["-backend-config=backend.hcl"]
        - run: echo "Planning EKS changes — review carefully"
        - plan:
            extra_args: ["-var-file=prod.tfvars", "-compact-warnings"]
    apply:
      steps:
        - run: echo "Applying EKS changes at $(date)"
        - apply:
            extra_args: ["-parallelism=5"]
        - run: aws eks update-kubeconfig --name prod-cluster --region ap-southeast-1
```

```bash
# Các lệnh comment trên GitHub PR

atlantis plan                        # plan tất cả project bị ảnh hưởng
atlantis plan -p prod-vpc            # plan project cụ thể theo name
atlantis plan -d environments/prod/vpc  # plan theo directory

atlantis apply                       # apply tất cả project đã plan
atlantis apply -p prod-vpc           # apply project cụ thể
atlantis apply -d environments/prod/vpc

atlantis unlock                      # release lock (sau crash hoặc abandon PR)
atlantis approve_policies            # approve OPA policy checks (nếu dùng OPA)
```

```bash
# Atlantis server setup (Docker)
docker run -d \
  --name atlantis \
  -p 4141:4141 \
  -e ATLANTIS_GH_TOKEN=$GITHUB_TOKEN \
  -e ATLANTIS_GH_WEBHOOK_SECRET=$WEBHOOK_SECRET \
  -e ATLANTIS_REPO_ALLOWLIST="github.com/mycompany/*" \
  -e AWS_ROLE_ARN=arn:aws:iam::123456789:role/atlantis-role \
  -v /atlantis-data:/home/atlantis \
  ghcr.io/runatlantis/atlantis:latest server \
  --gh-user=atlantis-bot \
  --gh-token=$GITHUB_TOKEN \
  --gh-webhook-secret=$WEBHOOK_SECRET \
  --repo-allowlist="github.com/mycompany/*"
```

```hcl
# IAM Role cho Atlantis server (EKS pod hoặc EC2)
# IRSA (IAM Role for Service Account) nếu chạy trong EKS
resource "aws_iam_role" "atlantis" {
  name = "atlantis-terraform-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.eks.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.oidc_provider}:sub" = "system:serviceaccount:atlantis:atlantis"
        }
      }
    }]
  })
}

# Policy — Atlantis cần quyền để tạo tất cả resource trong repo
resource "aws_iam_role_policy_attachment" "atlantis_admin" {
  role       = aws_iam_role.atlantis.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"  # hoặc custom policy
}
```

## Ứng Dụng Thực Tế

Bật `apply_requirements: [approved, mergeable]` cho production — buộc peer review plan output trước khi apply. Dùng `autoplan: enabled: false` cho risky infrastructure (EKS, RDS production) — chỉ plan khi chủ động comment, không tự trigger. Log Atlantis apply output trong audit system. Tách workspace theo risk level: staging autoplan + autoapply, prod require manual approval.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Atlantis hoạt động như thế nào về mặt kỹ thuật?</strong></summary>

**A:** Atlantis là một **HTTP server** (viết bằng Go) expose endpoint `POST /events`. GitHub được config webhook trỏ vào endpoint này với HMAC secret. Khi có PR comment event, GitHub gửi JSON payload đến Atlantis → Atlantis validate HMAC signature → parse comment text → nếu match command (`atlantis plan/apply`) → clone PR branch về local → chạy terraform init/plan/apply thật trên server → capture output → gọi GitHub API post comment lên PR. Atlantis cần: (1) GitHub token để đọc PR và post comment, (2) Cloud credentials (IAM role) để terraform chạy được, (3) Access tới remote state backend (S3).

</details>

<details>
<summary><strong>Tại sao phải review `terraform plan` output trước khi apply?</strong></summary>

**A:** Plan output cho thấy chính xác những gì sẽ thay đổi — cần đặc biệt chú ý: (1) **`-/+` (destroy + recreate)**: một số resource change sẽ gây downtime — ví dụ thay đổi AMI của EC2, thay đổi subnet của RDS → destroy và tạo lại. (2) **`-` (destroy)**: resource bị xóa — có thể là do rename, refactor, hoặc nhầm lẫn. (3) **Số lượng thay đổi lớn bất thường**: nếu plan hiện 50+ resources bị affect trong khi chỉ sửa 1 variable → có gì đó sai. (4) **Sensitive data**: password, key xuất hiện plaintext trong plan. Trong team: không bao giờ apply production mà không có ít nhất 1 người khác review plan.

</details>

<details>
<summary><strong>Atlantis khác GitHub Actions Terraform workflow thế nào?</strong></summary>

**A:** **Atlantis**: tự host, stateful (có locking), workflow trực tiếp qua PR comment, dễ setup. Nhược điểm: cần maintain server, cloud credentials cần cấu hình trên server. **GitHub Actions**: serverless (chạy trong GitHub infrastructure), integrate tốt với GitHub ecosystem, dễ dùng OIDC để assume IAM role (không cần store credentials). Nhược điểm: không có built-in locking, phải implement custom locking, workflow phức tạp hơn (YAML verbose). **Terraform Cloud/Enterprise**: managed service của HashiCorp, có UI, policy as code (Sentinel), audit log, SSO. Phù hợp enterprise. **Tóm lại**: Atlantis tốt cho team nhỏ/medium muốn self-host đơn giản; GitHub Actions cho team đã dùng GitHub Actions cho CI; Terraform Cloud cho enterprise cần managed solution.

</details>
