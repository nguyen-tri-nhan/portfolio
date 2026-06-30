---
key: "Pod / Deployment / Service"
title: "Pod, Deployment & Service"
crumb: "8. Cloud & DevOps › Kubernetes"
---

Pod là đơn vị deployable nhỏ nhất; Deployment quản lý Pod replica theo declarative; Service cung cấp truy cập network ổn định đến Pod bất kể IP động của chúng.

## Điểm Chính

- <strong>Pod</strong>: một hoặc nhiều container chia sẻ network namespace và volume. Ephemeral — được tái tạo khi thất bại.
- <strong>Deployment</strong>: desired-state controller cho Pod. Xử lý replica count, rolling update, rollback.
- <strong>Loại Service</strong>: ClusterIP (chỉ internal), NodePort (external qua node port), LoadBalancer (cloud LB), ExternalName.
- Service dùng label selector để tìm Pod mục tiêu — decoupled khỏi Pod IP address.
- <code>kubectl rollout status deployment/name</code>: monitor rolling update. <code>kubectl rollout undo</code>: rollback.

## Ví Dụ Code

*Cấu hình Service và Ingress*

```bash
# Service: stable endpoint for the deployment
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector:
    app: order-service  # matches deployment pods
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP       # internal only

# External access via Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: order-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /orders
        pathType: Prefix
        backend:
          service: {name: order-service, port: {number: 80}}
```

## Ứng Dụng Thực Tế

Luôn dùng Deployment, đừng bao giờ tạo Pod trực tiếp — Deployment xử lý self-healing, rolling update và desired-state reconciliation. Dùng ClusterIP cho internal service; chỉ expose bên ngoài qua Ingress với TLS.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa ClusterIP và LoadBalancer service là gì?
1. Kubernetes Service khám phá Pod nào để route đến thế nào?
1. Điều gì xảy ra trong khi Kubernetes rolling update?
