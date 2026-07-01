---
key: "HPA & Rolling Update"
title: "HPA & Rolling Update"
crumb: "8. Cloud & DevOps › Kubernetes"
---

HPA (Horizontal Pod Autoscaler) tự động scale Deployment replica dựa trên metric; Rolling Update thay thế pod dần dần để đạt zero-downtime deployment.

## Điểm Chính

- <strong>HPA</strong>: theo dõi metric (CPU, memory, custom), scale replica trong bounds min/max.
- HPA cần resource <code>requests</code> được đặt trên container để tính utilization.
- <strong>Rolling Update</strong>: Kubernetes thay thế pod cũ bằng mới dần dần. <code>maxSurge</code>: pod thêm trong khi update. <code>maxUnavailable</code>: pod có thể không available.
- Readiness probe gate: pod mới chỉ nhận traffic sau khi pass readiness check.
- <code>PodDisruptionBudget</code>: đảm bảo số lượng pod tối thiểu luôn available trong khi node maintenance.

## Ví Dụ Code

*Cấu hình HPA và zero-downtime rolling update*

```bash
# HPA with CPU and custom metric
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {name: order-service-hpa}
spec:
  scaleTargetRef: {apiVersion: apps/v1, kind: Deployment, name: order-service}
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target: {type: Utilization, averageUtilization: 70}

# Rolling update strategy in Deployment
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # allow 1 extra pod during update
      maxUnavailable: 0  # never reduce below desired count (zero-downtime)
```

## Ứng Dụng Thực Tế

Đặt <code>maxUnavailable: 0</code> cho zero-downtime deployment. Đặt <code>minReplicas: 2</code> để luôn có ít nhất một pod available trong rolling update. Kết hợp với PodDisruptionBudget cho node drain operation.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Kubernetes đảm bảo zero downtime trong rolling update thế nào?</strong></summary>

**A:** Rolling update tuân theo cấu hình `strategy.rollingUpdate`: `maxSurge` (số pod extra được tạo vượt replicas, default 25%) và `maxUnavailable` (số pod có thể unavailable trong quá trình, default 25%). Kubernetes chỉ terminate pod cũ khi pod mới đã **Ready** (pass readiness probe). Với `maxUnavailable=0`: không terminate pod cũ cho đến khi pod mới ready → true zero downtime nhưng cần thêm resource.

</details>

<details>
<summary><strong>HPA có thể dùng metric nào ngoài CPU và memory?</strong></summary>

**A:** HPA v2 hỗ trợ **custom metrics** và **external metrics**: (1) Prometheus metrics qua Prometheus Adapter: RPS, queue depth, error rate. (2) **KEDA (Kubernetes Event-Driven Autoscaler)**: scale theo Kafka consumer lag, RabbitMQ queue length, Redis list length, SQS queue depth, HTTP request count. (3) Cloud provider metrics: AWS SQS, Azure Service Bus. Ví dụ: scale consumer pods khi Kafka lag > 1000 → `ScaledObject` in KEDA.

</details>

<details>
<summary><strong>PodDisruptionBudget là gì và khi nào bạn cần?</strong></summary>

**A:** **PDB** giới hạn số pod của một deployment có thể bị disrupted (voluntarily) cùng lúc: `minAvailable: 2` hoặc `maxUnavailable: 1`. Khi nào cần: (1) **Node drain** (rolling upgrade, scaling down node): kubectl drain terminate pod — PDB ngăn không để quá nhiều pod bị terminate đồng thời, đảm bảo service availability. (2) Cluster upgrade, node maintenance. Không ảnh hưởng involuntary disruption (node crash). Rule: set PDB cho mọi production service với replicas > 1.

</details>
