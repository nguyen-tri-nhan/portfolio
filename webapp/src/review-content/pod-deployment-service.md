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

<details>
<summary><strong>Service ClusterIP, NodePort, và LoadBalancer khác nhau thế nào?</strong></summary>

**A:** **ClusterIP** (default): chỉ accessible trong cluster — internal service-to-service communication. **NodePort**: expose service trên port cố định của mỗi Node (30000-32767) — accessible từ ngoài cluster qua `NodeIP:NodePort`. **LoadBalancer**: tạo cloud load balancer (AWS ALB/NLB, GCP LB) tự động — expose service ra internet với stable external IP. Cho production: dùng LoadBalancer hoặc Ingress controller (nginx, traefik) + ClusterIP service. NodePort thường chỉ dùng dev/test.

</details>

<details>
<summary><strong>Deployment rollback hoạt động thế nào trong Kubernetes?</strong></summary>

**A:** `kubectl rollout undo deployment/my-app` → rollback về revision trước. `kubectl rollout undo deployment/my-app --to-revision=2` → rollback về revision cụ thể. Kubernetes giữ rollout history (default 10 revisions) — mỗi `kubectl apply` với template thay đổi tạo revision mới. Xem history: `kubectl rollout history deployment/my-app`. Theo dõi status: `kubectl rollout status deployment/my-app`. Rollback tức thì — K8s apply revision cũ vào Deployment spec và tạo lại Pods theo rolling update strategy.

</details>

<details>
<summary><strong>Pod lifecycle từ Pending đến Running là gì?</strong></summary>

**A:** (1) **Pending**: Pod được tạo, scheduler tìm Node phù hợp (resource, affinity, taint). (2) **Scheduled**: Node được chọn, kubelet được thông báo. (3) **ContainerCreating**: kubelet pull image (nếu chưa có), create container. (4) **Running**: tất cả container đang chạy. (5) **readinessProbe**: nếu configured, K8s chờ probe pass trước khi add Pod vào Service endpoints. **livenessProbe**: nếu fail → restart container. Pod bị stuck Pending: check `kubectl describe pod` → Events section — thường do không đủ resource, image pull error, hoặc PVC không bound.

</details>
