---
key: "Capacity Planning"
title: "Capacity Planning — QPS / TPS"
crumb: "7. System Design › High Concurrency"
---

Capacity planning dùng Little's Law và back-of-envelope estimation để xác định nhu cầu thread pool, DB connection và infrastructure trước khi load test xác nhận con số.

## Điểm Chính

- <strong>Little's Law</strong>: <code>N = λ × W</code> — concurrency trung bình (N) = arrival rate (λ, req/s) × avg response time (W, giây).
- Ví dụ: 1000 RPS ở 100ms avg → 1000 × 0.1 = 100 request đồng thời → cần ≥ 100 thread slot.
- <strong>DAU → QPS</strong>: 10M DAU × 10 req/ngày = 100M req/ngày ÷ 86400s ≈ 1157 avg RPS. Peak = 3-5× avg.
- Load test để tìm <em>điểm gãy (knee)</em>: throughput plateau nhưng latency bắt đầu tăng nhanh.
- Safety margin: thiết kế cho 3× peak để xử lý flash sale và spike bất ngờ.
- Giới hạn phần cứng tham khảo: 1 core MySQL ≈ 1000 query đơn/s; 1 Redis node ≈ 100K ops/s.

## Ví Dụ Code

*Little's Law, DAU→QPS, chiến lược load test*

```bash
# Little's Law áp dụng vào sizing
# Mục tiêu: xử lý 5000 RPS với p99 < 200ms
# N = 5000 × 0.2 = 1000 request đồng thời

# Thread pool (I/O-bound, 8 cores):
# 8 cores × (1 + 50ms DB / 5ms compute) = 88 → làm tròn 100

# Back-of-envelope: DAU → peak QPS
# 50M DAU, 5 hành động/ngày = 250M req/ngày
# Daily avg: 250M / 86400 ≈ 2893 RPS
# Peak hour (20% daily): 50M req / 3600s ≈ 13,889 RPS
# Với 3× safety: thiết kế cho 41,667 RPS

# JMeter load test: tìm điểm gãy
# - Ramp từ 10 → 1000 thread trong 5 phút
# - Xem p99 latency vs throughput
# - Điểm gãy = throughput plateau + latency tăng mạnh
# Đó là giới hạn service → scale horizontal trước điểm đó

# Prometheus: tính utilization hiện tại
# Throughput: rate(http_requests_total[1m])
# P99 latency: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

## Ứng Dụng Thực Tế

Trong system design interview: luôn anchor ước tính capacity bằng Little's Law. Nó làm quyết định sizing thread pool và connection pool trông có cơ sở thay vì tùy tiện. Biết giới hạn phần cứng tham khảo: một app server đơn thường xử lý được 5K-20K RPS cho CRUD đơn giản (tùy tốc độ DB). Vượt đó thì scale horizontal — stateless service làm điều này trong suốt.

## Câu Hỏi Phỏng Vấn

1. Áp dụng Little's Law để tính thread pool cho 2000 RPS ở 150ms avg latency?
1. Chuyển 10M daily active user thành ước tính QPS thế nào?
1. "Điểm gãy" trong load test là gì?
