---
key: "Blue-Green & Canary Deploy"
title: "Blue-Green & Canary Deployment"
crumb: "8. Cloud & DevOps › CI/CD"
---

Blue-Green chạy hai môi trường giống nhau và chuyển traffic ngay lập tức; Canary dần dần chuyển tỷ lệ phần trăm traffic sang phiên bản mới — cả hai cho zero-downtime deployment với rollback dễ dàng.

## Điểm Chính

- <strong>Blue-Green</strong>: hai môi trường (blue=live, green=mới). Sau khi test, chuyển LB sang green. Instant rollback: chuyển lại blue. Cần 2× tài nguyên.
- <strong>Canary</strong>: route X% traffic sang phiên bản mới. Tăng tỷ lệ khi độ tin tưởng tăng. Rollback bằng cách route 0% sang canary. Hiệu quả tài nguyên.
- Canary vs feature flag: canary là infrastructure-level (tất cả user trong tỷ lệ đó). Feature flag là code-level (user cụ thể).
- Kubernetes: Argo Rollouts hoặc Flux Flagger cho automated canary với metrics-based promotion.

## Ví Dụ Code

*Blue-Green K8s manifest + Argo Rollouts canary với Prometheus analysis*

```bash
# ── Blue-Green: 2 Deployments, switch Service selector ──────────────────────
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service-blue   # currently live
  labels: { app: order-service, slot: blue }
spec:
  replicas: 5
  selector: { matchLabels: { app: order-service, slot: blue } }
  template:
    metadata: { labels: { app: order-service, slot: blue } }
    spec:
      containers:
        - name: app
          image: registry/order-service:v1.9   # old version keeps running
---
# Switch traffic: patch Service selector to "green" after health check
# kubectl patch svc order-service -p '{"spec":{"selector":{"slot":"green"}}}'

# ── Canary: Argo Rollouts với automated Prometheus analysis ─────────────────
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: order-service
spec:
  replicas: 10
  selector: { matchLabels: { app: order-service } }
  template:
    spec:
      containers:
        - name: app
          image: registry/order-service:v2.0   # new version
  strategy:
    canary:
      canaryService: order-service-canary   # 10% traffic
      stableService: order-service-stable   # 90% traffic
      steps:
        - setWeight: 10
        - pause: { duration: 5m }           # observe metrics
        - analysis:
            templates:
              - templateName: success-rate  # auto-check before promoting
        - setWeight: 50
        - pause: { duration: 10m }
        - setWeight: 100                    # full rollout if analysis passes
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  metrics:
    - name: success-rate
      interval: 1m
      successCondition: result[0] >= 0.95   # fail if success rate < 95%
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{app="order-service",status!~"5.."}[5m]))
            / sum(rate(http_requests_total{app="order-service"}[5m]))
```

## Ứng Dụng Thực Tế

Dùng Argo Rollouts cho automated canary với Prometheus-based promotion gate. Định nghĩa tiêu chí thành công (latency p99, error rate) như analysis template — tự động rollback nếu giảm chất lượng. Điều này cho bạn an toàn deployment mà không cần monitor thủ công.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Trade-off chính giữa blue-green và canary deployment là gì?</strong></summary>

**A:** **Blue-Green**: switch toàn bộ traffic một lần (0%→100%), rollback nhanh bằng cách switch lại. Cần double infrastructure cost — phải chạy 2 full environment. Bug ảnh hưởng 100% user ngay khi switch. **Canary**: gradually tăng traffic (1%→5%→100%), phát hiện bug sớm với ít user bị ảnh hưởng, infrastructure cost thấp hơn nhưng setup phức tạp hơn.

</details>

<details>
<summary><strong>Argo Rollouts tự động hóa quyết định canary promotion thế nào?</strong></summary>

**A:** Tích hợp với **analysis providers** (Prometheus, Datadog) để evaluate metrics trong khi rollout tiến hành. Ví dụ: nếu error rate > 5% → tự động rollback; nếu tất cả metrics pass → promote lên step tiếp theo. Kết hợp với `steps` config: `setWeight 20 → pause 5m → setWeight 50 → pause 10m → setWeight 100` tạo progressive rollout với automated guardrails.

</details>

<details>
<summary><strong>Feature flag là gì và khác canary deployment thế nào?</strong></summary>

**A:** **Feature flag**: code được deploy nhưng feature ẩn sau conditional check (`if featureEnabled("new-ui")`), bật/tắt runtime không cần redeploy, thường per-user/segment. Tools: LaunchDarkly, Unleash. **Canary**: infrastructure-level routing, route % traffic đến new version instance. Feature flag ở code level; canary ở infra level. Nhiều team kết hợp: deploy với flag disabled → dần bật flag theo % user.

</details>
