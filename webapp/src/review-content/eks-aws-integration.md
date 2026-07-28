---
key: "EKS & AWS Integration"
title: "EKS & AWS Integration"
crumb: "15. Cloud & DevOps › Kubernetes"
---

EKS (Elastic Kubernetes Service) là managed Kubernetes của AWS — AWS quản lý control plane (API Server, etcd, scheduler), bạn chỉ quản lý worker nodes và workloads.

## Điểm Chính

- **Control plane**: AWS managed, multi-AZ, auto-patched. Bạn không SSH vào đây.
- **Node groups**: EC2 instances chạy pods — Managed Node Group (AWS quản lý update), Self-managed, hoặc Fargate (serverless, không có node).
- **IRSA** (IAM Roles for Service Accounts): cấp AWS permissions cho pod cụ thể — không dùng Node IAM role cho tất cả.
- **VPC CNI**: pod nhận IP trực tiếp từ VPC subnet — pod có thể communicate với RDS, ElastiCache trong cùng VPC.
- **ALB Ingress Controller**: tạo AWS ALB từ Ingress resource — thay thế nginx trong EKS.
- **EBS CSI Driver**: cần cài thêm để PersistentVolume dùng EBS.

## Ví Dụ Code

*EKS cluster với Terraform, IRSA, ALB Ingress Controller, kubectl config*

```hcl
# Tạo EKS cluster với Terraform (dùng registry module)
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "prod-cluster"
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids  # nodes chạy trong private subnet

  # Control plane endpoint — chỉ accessible từ trong VPC
  cluster_endpoint_public_access  = false
  cluster_endpoint_private_access = true

  # Managed Node Groups
  eks_managed_node_groups = {
    app = {
      min_size       = 2
      max_size       = 10
      desired_size   = 3
      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"

      labels = { role = "app" }
      taints = []
    }

    spot = {
      min_size       = 0
      max_size       = 20
      desired_size   = 3
      instance_types = ["t3.medium", "t3.large"]
      capacity_type  = "SPOT"  # rẻ hơn 70%, phù hợp cho stateless workload

      labels = { role = "spot" }
      taints = [{
        key    = "spot"
        value  = "true"
        effect = "NO_SCHEDULE"  # chỉ schedule pod có toleration
      }]
    }
  }

  # EKS Add-ons (AWS managed)
  cluster_addons = {
    coredns                = { most_recent = true }
    kube-proxy             = { most_recent = true }
    vpc-cni                = { most_recent = true }
    aws-ebs-csi-driver     = { most_recent = true }  # cần cho PersistentVolume EBS
  }
}
```

```hcl
# IRSA — cấp AWS permission cho specific pod, không phải toàn Node
# Ví dụ: order-service cần đọc S3 và gửi SQS

# 1. Tạo IAM Role với trust policy cho Service Account
module "order_service_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "order-service-role"

  # Chỉ service account này mới có thể assume role
  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["default:order-service"]  # namespace:serviceaccount
    }
  }
}

# 2. Attach policy cho role
resource "aws_iam_role_policy" "order_service" {
  role = module.order_service_irsa.iam_role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "arn:aws:s3:::order-bucket/*"
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage", "sqs:ReceiveMessage"]
        Resource = aws_sqs_queue.orders.arn
      }
    ]
  })
}
```

```yaml
# 3. Annotate Kubernetes ServiceAccount với IAM Role ARN
apiVersion: v1
kind: ServiceAccount
metadata:
  name: order-service
  namespace: default
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/order-service-role
---
# 4. Deployment dùng ServiceAccount đó
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  template:
    spec:
      serviceAccountName: order-service   # pod sẽ nhận AWS credentials qua IRSA
      containers:
        - name: order-service
          image: myregistry/order-service:1.0.0
          # Không cần hardcode AWS_ACCESS_KEY_ID
          # SDK tự lấy credentials từ IRSA via OIDC token
```

```hcl
# ALB Ingress Controller — tạo AWS Application Load Balancer từ Ingress resource
resource "helm_release" "aws_load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"

  set {
    name  = "clusterName"
    value = module.eks.cluster_name
  }
  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.alb_controller_irsa.iam_role_arn  # IRSA cho controller
  }
}
```

```yaml
# Ingress với ALB annotations — tạo AWS ALB thay vì nginx
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: order-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip            # route đến pod IP trực tiếp
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:...  # ACM certificate
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/group.name: prod-apps      # share ALB giữa nhiều Ingress
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 80
```

```bash
# Setup kubectl để trỏ vào EKS cluster
aws eks update-kubeconfig \
  --name prod-cluster \
  --region ap-southeast-1 \
  --role-arn arn:aws:iam::123456789:role/eks-admin-role  # assume role nếu cần

# Verify
kubectl get nodes
kubectl get pods -A

# Debug IRSA — check token được inject vào pod không
kubectl exec -it <pod-name> -- env | grep AWS
# AWS_ROLE_ARN=arn:aws:iam::123456789:role/order-service-role
# AWS_WEB_IDENTITY_TOKEN_FILE=/var/run/secrets/eks.amazonaws.com/serviceaccount/token
```

## Ứng Dụng Thực Tế

Dùng IRSA thay vì Node IAM role — Node role cấp permission cho tất cả pod trên node (vi phạm least privilege). Spot instances cho stateless workload (API servers, workers) + On-demand cho stateful (databases, critical services) để giảm ~60-70% chi phí EC2. Bật cluster autoscaler hoặc Karpenter để auto-scale nodes theo workload. Dùng `alb.ingress.kubernetes.io/group.name` để nhiều Ingress share cùng ALB — tiết kiệm chi phí ALB.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>IRSA là gì? Tại sao không dùng Node IAM Role cho tất cả?</strong></summary>

**A:** **IRSA** (IAM Roles for Service Accounts): cơ chế cấp AWS permissions cho individual pod thông qua Kubernetes Service Account + OIDC federation. Hoạt động: EKS inject OIDC token vào pod → pod dùng token để assume IAM role qua `sts:AssumeRoleWithWebIdentity`. **Tại sao không dùng Node IAM Role**: Node role cấp permission cho *tất cả pod* trên node — nếu `order-service` cần S3 access, mọi pod trên node đó (kể cả bị compromise) đều có S3 access → vi phạm **Principle of Least Privilege**. IRSA: chỉ `order-service` ServiceAccount mới có quyền, pod khác trên cùng node không có. AWS SDK tự động pick up credentials từ OIDC token — không cần thay đổi code.

</details>

<details>
<summary><strong>EKS Managed Node Group khác Self-managed Node và Fargate thế nào?</strong></summary>

**A:** **Managed Node Group**: AWS tạo và quản lý EC2 instances, tự động update AMI (rolling update), tích hợp với cluster autoscaler. Bạn vẫn có quyền SSH vào nodes. **Self-managed Node**: bạn hoàn toàn kiểm soát EC2 lifecycle, cấu hình bootstrap script, custom AMI — phức tạp hơn nhưng flexible. **Fargate**: serverless — không có worker node, mỗi pod chạy trong isolated micro-VM. Không cần quản lý nodes, tự động scale, pay per pod resource. Nhược điểm Fargate: không hỗ trợ DaemonSet, StatefulSet với persistent storage hạn chế, cold start chậm hơn, giá cao hơn EC2. Fargate phù hợp cho batch jobs, dev/test environment. Production API thường dùng Managed Node Group.

</details>

<details>
<summary><strong>ALB Ingress Controller khác nginx Ingress Controller thế nào?</strong></summary>

**A:** **nginx Ingress Controller**: chạy như pod trong cluster, nginx process HTTP traffic bên trong cluster, cần 1 Service `LoadBalancer` (tạo NLB/CLB). Tốt cho self-hosted hoặc khi cần advanced nginx config (rate limiting, custom auth). **ALB Ingress Controller**: mỗi Kubernetes Ingress resource → tạo AWS ALB thật. Traffic từ internet → ALB → pod IP trực tiếp (không đi qua nginx pod). Ưu điểm ALB: tích hợp AWS WAF, ACM certificate management, target group health check native AWS, `group.name` để share 1 ALB cho nhiều services (tiết kiệm chi phí). Nhược điểm: vendor lock-in AWS, ALB provision mất ~2-3 phút, giá ALB cao hơn NLB.

</details>

<details>
<summary><strong>VPC CNI trong EKS khác networking của K8s thông thường thế nào?</strong></summary>

**A:** Kubernetes mặc định dùng overlay network (flannel, calico) — pod IP là virtual, không visible trong VPC. **VPC CNI**: pod nhận IP trực tiếp từ VPC subnet — pod IP là real VPC IP. Ưu điểm: pod communicate trực tiếp với RDS, ElastiCache, Lambda trong cùng VPC (không qua NAT), Security Group có thể apply trực tiếp cho pod (Security Groups for Pods feature). Nhược điểm: mỗi EC2 instance chỉ có giới hạn số secondary IP (phụ thuộc instance type) → giới hạn số pod per node. Ví dụ: `t3.medium` có tối đa 6 ENI × 6 IP = 36 pod per node. Giải pháp: dùng instance type lớn hơn, hoặc bật prefix delegation để tăng IPs per ENI.

</details>
