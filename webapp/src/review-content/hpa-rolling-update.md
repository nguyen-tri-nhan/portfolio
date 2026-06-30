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

1. Kubernetes đảm bảo zero downtime trong rolling update thế nào?
1. HPA có thể dùng metric nào ngoài CPU và memory?
1. PodDisruptionBudget là gì và khi nào bạn cần?
