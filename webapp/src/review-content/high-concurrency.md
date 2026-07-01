---
key: "High Concurrency"
title: "Pattern High Concurrency trong Java"
crumb: "7. System Design"
---

Kỹ thuật High Concurrency (HC) đảm bảo ứng dụng Java xử lý hàng nghìn request đồng thời. Đòn bẩy chính: sizing thread pool đúng, tuning connection pool DB, service stateless, cache hot data, và async processing cho công việc không quan trọng.

## Điểm Chính

- <strong>Stateless service</strong>: không có session state trên server — cho phép scale ngang mà không cần sticky session.
- <strong>Sizing thread pool</strong>: I/O-bound = <code>CPU × (1 + wait/compute)</code>; CPU-bound = <code>CPU + 1</code>.
- <strong>Connection pool</strong>: quá nhỏ = bottleneck; quá lớn = DB quá tải. Cân bằng là chìa khóa.
- <strong>Async offloading</strong>: <code>@Async</code> + message queue cho công việc không quan trọng (email, notification).
- <strong>Caching</strong>: Redis cho hot data distributed; Caffeine cho ultra-hot data trong process (dưới microsecond).
- <strong>Circuit breaker</strong>: fail fast khi downstream chậm — ngăn thread pool exhaustion cascade.
- <strong>Little's Law</strong>: <code>N = λ × W</code> — concurrency = arrival_rate × avg_response_time.

## Ứng Dụng Thực Tế

HC là concern xuyên suốt. Trong phỏng vấn: đừng chỉ nói "thêm server". Mô tả full stack: load balancer → stateless app server → connection pool → cache → DB với read replica. Xác định bottleneck thực trước (thường là DB, không phải app). Biết Little's Law để justify sizing bằng con số cụ thể.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Phát biểu Little's Law và dùng để size thread pool.</strong></summary>

**A:** **L = λ × W**: L = số item trong system (concurrent requests), λ = throughput (request/s), W = thời gian xử lý (s). Ví dụ: 500 RPS, avg latency 200ms → L = 500 × 0.2 = **100 concurrent requests** → cần thread pool size = 100 (plus buffer 20% → 120). Lưu ý: W = *service time + wait time*, nên khi queue build up, W tăng → cần L tăng → pool không đủ → queue càng dài → latency tăng (spiral). Target: utilization < 70-80%.

</details>

<details>
<summary><strong>Walk me through thiết kế system xử lý 50K request/giây.</strong></summary>

**A:** (1) **Load balancer layer**: 2-3 LB instances (L4/L7), sticky session nếu cần. (2) **App tier**: horizontal scale — tính số instance theo Little's Law: 50K × 0.1s (avg) = 5000 concurrent → mỗi instance 500 thread → 10 instances. (3) **Caching**: Redis cluster giảm 80% DB load — cache hot data. (4) **DB layer**: read replica, connection pooling (HikariCP). (5) **Async**: heavy operation → Kafka, không block request. (6) **CDN**: static assets. (7) **Rate limiting**: protect backend.

</details>

<details>
<summary><strong>Khi latency spike dưới high load, điều đầu tiên bạn kiểm tra là gì?</strong></summary>

**A:** Theo thứ tự: (1) **Thread pool saturation**: `/actuator/metrics/executor.active` — nếu active ≈ max → thread pool full → queue building. (2) **DB slow query**: slow query log, connection pool wait time. (3) **GC pressure**: GC log — Full GC hoặc long pause. (4) **External dependency**: downstream service latency (distributed trace). (5) **CPU throttling**: Docker/K8s CPU limit hit → throttle. Dùng distributed tracing để thấy span nào đang chậm.

</details>
