---
key: "Horizontal vs Vertical"
title: "Horizontal vs Vertical Scaling"
crumb: "7. System Design › Scalability"
---

Vertical scaling nâng cấp tài nguyên một máy; horizontal scaling thêm nhiều máy — kiến trúc cloud hiện đại ưu tiên horizontal cho resilience và scale không giới hạn.

## Điểm Chính

- Vertical: dễ implement (không thay đổi code), bị giới hạn bởi phần cứng, single point of failure, đắt.
- Horizontal: cần load balancer + thiết kế stateless, scale vô hạn trên lý thuyết, fault tolerance tốt hơn.
- Auto-scaling: cloud (AWS ASG, K8s HPA) scale out trên CPU/memory/custom metric, scale in khi tải thấp.
- Database: vertical scaling phổ biến (loại instance RDS); horizontal = read replica hoặc sharding.
- Quy tắc ngón tay cái: scale vertically cho đến khi đau, sau đó scale horizontally.

## Ví Dụ Code

*K8s HPA: CPU + Kafka lag metrics; VPA cho vertical; decision guide vertical vs horizontal*

```bash
# Kubernetes HPA: horizontal auto-scaling for order-service
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 2      # always 2+ for HA (no single point of failure)
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70   # scale out when avg CPU > 70%
  - type: External
    external:
      metric:
        name: kafka_consumer_lag  # scale based on Kafka consumer lag
        selector:
          matchLabels:
            topic: order-events
      target:
        type: AverageValue
        averageValue: "1000"      # scale out when lag > 1000 messages per pod

# Vertical scaling via VPA (Vertical Pod Autoscaler) — adjust CPU/memory limits
# Use when: single-threaded workload, stateful (can't easily add more pods),
# or during initial sizing before HPA tuning
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: order-service-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  updatePolicy:
    updateMode: "Off"   # Recommendation only — apply manually to avoid restarts

# Decision guide:
# Start vertical (increase pod resources) → cheaper, zero-code change
# Hit vertical limit OR need HA → go horizontal (add replicas)
# DB bottleneck → read replica first, then sharding (sharding = last resort)
# I/O-bound service: HPA on request rate or queue depth, not CPU
```

## Ứng Dụng Thực Tế

Luôn đặt <code>minReplicas: 2</code> cho HA. Scale trên metric cụ thể ứng dụng (Kafka lag, queue depth) không chỉ CPU — CPU thường không phải bottleneck cho I/O-bound service. Đặt resource request/limit để tính toán HPA chính xác.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào vertical scaling không còn hiệu quả?</strong></summary>

**A:** Vertical scaling (thêm RAM/CPU) có giới hạn vật lý và kinh tế: (1) **Hardware ceiling**: máy lớn nhất có giới hạn (AWS r6a.48xlarge: 192 vCPU, 1.5TB RAM). (2) **Cost**: máy to đắt hơn phi tuyến — 2x resource thường > 3x chi phí. (3) **Single point of failure**: một node không có HA. (4) **Downtime khi scale**: thường cần restart để resize. Khi traffic tăng 10x cần 10x resource → vertical không còn viable → horizontal.

</details>

<details>
<summary><strong>Service cần gì để hỗ trợ horizontal scaling?</strong></summary>

**A:** (1) **Stateless**: không lưu session state in-memory — dùng Redis/DB cho session. (2) **Idempotent**: request có thể retry khi LB re-route. (3) **External config**: không hardcode host/port — dùng env var hoặc config service. (4) **Health check endpoint**: LB cần để biết instance healthy. (5) **Externalize state**: DB, cache, message queue là shared state, không nằm trong instance. (6) **Distributed locking**: nếu cần lock, dùng Redis/ZooKeeper không phải in-memory.

</details>

<details>
<summary><strong>Kubernetes HPA quyết định khi nào scale thế nào?</strong></summary>

**A:** HPA (Horizontal Pod Autoscaler) periodically (default 15s) query metrics server: CPU usage, memory, hoặc custom metrics (RPS, queue length qua KEDA). Algorithm: `desiredReplicas = ceil(currentReplicas × currentMetricValue / targetMetricValue)`. Ví dụ: target CPU = 50%, hiện 80%, 3 pods → ceil(3 × 80/50) = ceil(4.8) = 5 pods. Scale-up: ngay khi metric vượt threshold. Scale-down: chờ 5 phút (cooldown) để tránh flapping.

</details>
