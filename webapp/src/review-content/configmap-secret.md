---
key: "ConfigMap & Secret"
title: "ConfigMap & Secret"
crumb: "8. Cloud & DevOps › Kubernetes"
---

ConfigMap lưu cấu hình không nhạy cảm dưới dạng key-value; Secret lưu dữ liệu nhạy cảm (base64-encoded, mã hóa khi lưu) — cả hai có thể mount như env var hoặc volume file.

## Điểm Chính

- <strong>ConfigMap</strong>: config không nhạy cảm (URL, feature flag, log level). Plaintext trong etcd.
- <strong>Secret</strong>: dữ liệu nhạy cảm (password, API key, TLS cert). Base64 trong etcd; bật encryption-at-rest.
- Tùy chọn mount: biến môi trường, volume file hoặc đọc qua K8s API.
- External Secrets Operator: sync secret từ AWS Secrets Manager, Vault, GCP Secret Manager vào K8s Secret.
- Không bao giờ commit Secrets YAML với giá trị thật — dùng sealed secret hoặc external secrets operator.

## Ví Dụ Code

*ConfigMap và Secret mount như env var*

```yaml
# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata: {name: app-config}
data:
  SPRING_PROFILES_ACTIVE: "prod"
  LOG_LEVEL: "INFO"
  APP_FEATURE_FLAG: "true"

# Secret (values must be base64 encoded)
apiVersion: v1
kind: Secret
metadata: {name: app-secrets}
type: Opaque
data:
  DB_PASSWORD: cGFzc3dvcmQxMjM=  # base64("password123")
  JWT_SECRET: c2VjcmV0a2V5      # base64("secretkey")

# Mount in Deployment
spec:
  containers:
  - envFrom:
    - configMapRef: {name: app-config}
    - secretRef:   {name: app-secrets}
```

## Ứng Dụng Thực Tế

Dùng External Secrets Operator để sync từ AWS Secrets Manager hoặc HashiCorp Vault — tránh lưu secret trong Git. Rotate secret bằng cách cập nhật source; operator tự động truyền thay đổi đến pod.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa ConfigMap và Secret trong Kubernetes là gì?
1. Làm thế nào để quản lý secret an toàn trong Kubernetes production?
1. Điều gì xảy ra với pod khi bạn cập nhật ConfigMap mà chúng mount?
