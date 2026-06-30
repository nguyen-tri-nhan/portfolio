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

1. Phát biểu Little's Law và dùng để size thread pool.
1. Walk me through thiết kế system xử lý 50K request/giây.
1. Khi latency spike dưới high load, điều đầu tiên bạn kiểm tra là gì?
