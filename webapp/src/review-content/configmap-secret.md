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

<details>
<summary><strong>Sự khác biệt giữa ConfigMap và Secret trong Kubernetes là gì?</strong></summary>

**A:** **ConfigMap**: lưu non-sensitive config (URL, port, feature flag) dạng plain text, có thể xem bằng `kubectl get configmap -o yaml`. **Secret**: lưu sensitive data (password, API key, certificate) — encode bằng **Base64** (không encrypt), có thể restrict access qua RBAC. Base64 chỉ là encoding, không phải encryption — Secret vẫn cần encrypt at rest (K8s EncryptionConfiguration hoặc Vault).

</details>

<details>
<summary><strong>Làm thế nào để quản lý secret an toàn trong Kubernetes production?</strong></summary>

**A:** (1) **Enable encryption at rest**: `EncryptionConfiguration` trong kube-apiserver để encrypt Secret trong etcd. (2) **External secret management**: HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager + External Secrets Operator sync vào K8s Secret. (3) **RBAC**: giới hạn `get/list` Secret chỉ cho service account cần thiết. (4) **Sealed Secrets**: encrypt Secret bằng public key, chỉ cluster có thể decrypt — safe để commit lên Git.

</details>

<details>
<summary><strong>Điều gì xảy ra với pod khi bạn cập nhật ConfigMap mà chúng mount?</strong></summary>

**A:** Khi ConfigMap được mount dạng **volume**: K8s tự động cập nhật file trong pod sau một khoảng thời gian (mặc định 60s sync period) — pod không cần restart, nhưng app cần tự detect và reload config (inotify/watch). Khi ConfigMap inject dạng **env variable**: pod **không** tự cập nhật — phải restart pod để env mới có hiệu lực. Dùng volume mount để hot-reload config, env variable cho config ít thay đổi.

</details>
