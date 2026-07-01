---
key: "Tuning Connection Pool"
title: "Tuning Connection Pool cho High Concurrency"
crumb: "7. System Design › High Concurrency"
---

Dưới high concurrency, kết nối DB trở thành bottleneck. Pool quá nhỏ → thread chờ (latency spike); pool quá lớn → DB quá tải (query chậm cho tất cả). Cân bằng là then chốt.

## Điểm Chính

- Mỗi thread gọi DB cần một connection — thread pool size nên ≤ connection pool size.
- Tổng connection tất cả app instance không vượt <code>max_connections</code> MySQL trừ headroom DBA.
- <code>connectionTimeout</code>: nếu pool hết, request chờ thời gian này rồi throw exception. Giữ 3s để fail fast.
- <code>maxLifetime</code>: connection phải được recycle trước khi MySQL đóng phía server (<code>wait_timeout</code>).
- <strong>PgBouncer / ProxySQL</strong>: connection multiplexer — nhiều app connection share ít DB connection hơn.
- Alert threshold: <code>hikaricp_connections_pending > 5</code> là dấu hiệu pool bão hòa trước khi error bắt đầu.

## Ví Dụ Code

*Sizing pool multi-instance và monitoring*

```bash
# Sizing HikariCP multi-instance
# MySQL max_connections = 500
# Headroom DBA/monitoring: 20
# App connections: 480
# App instances: 6
# Pool mỗi instance: 480 / 6 = 80

spring:
  datasource:
    hikari:
      maximum-pool-size: 80
      minimum-idle: 80          # stable pool = không resize overhead
      connection-timeout: 3000  # 3s fail-fast
      max-lifetime: 1800000     # 30 phút < MySQL wait_timeout

# MySQL: kiểm tra max_connections
SHOW VARIABLES LIKE 'max_connections';  # default 151

# Tăng MySQL max_connections
SET GLOBAL max_connections = 600;

# Prometheus query để monitor:
# Pool utilization: hikaricp_connections_active / hikaricp_connections_max
# Pending waits (alert > 0): hikaricp_connections_pending_total
```

## Ứng Dụng Thực Tế

Pattern incident production điển hình: traffic spike → pool hết → request xếp hàng → 30s default timeout fire → HTTP 500 cascade. Phòng ngừa: 1) <code>connectionTimeout=3000ms</code> để fail fast, 2) alert trên <code>connections_pending</code>, 3) scale app instance trước khi pool bão hòa. Với concurrency rất cao, ProxySQL hoặc PgBouncer multiplex nhiều app connection thành ít DB connection hơn, giảm overhead DB.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Cách tìm connection pool size phù hợp cho HikariCP?</strong></summary>

**A:** Formula từ PostgreSQL wiki: `pool_size = (core_count × 2) + effective_spindle_count`. Với SSD/NVMe: effective_spindle = 1. 8 cores → pool = 17. Nhưng đây là starting point — phải đo. Process: (1) Set pool size nhỏ (10), load test. (2) Monitor: `hikaricp.connections.pending` (waiting) và `hikaricp.connections.usage` (active). (3) Nếu pending > 0 thường xuyên → tăng. (4) Nếu DB CPU idle nhưng latency cao → bottleneck không phải pool size. HikariCP: `maximumPoolSize`, `minimumIdle`, `connectionTimeout=30000`.

</details>

<details>
<summary><strong>Connection pool exhaustion dẫn đến gì?</strong></summary>

**A:** Tất cả connections đang dùng, request mới → chờ trong queue. Nếu chờ quá `connectionTimeout` (HikariCP default 30s) → `SQLTimeoutException: Connection is not available, request timed out after 30000ms`. Cascade: nhiều thread timeout → request queue backup → OutOfMemoryError. Triệu chứng: thread dump thấy nhiều thread blocked tại connection acquisition. Nguyên nhân thường: (1) Slow queries hold connection lâu. (2) Transaction không close đúng cách. (3) Pool size quá nhỏ cho load. Fix: increase pool size (short-term), fix slow queries, optimize transaction scope.

</details>

<details>
<summary><strong>Leak detection trong HikariCP là gì?</strong></summary>

**A:** `leakDetectionThreshold` (HikariCP): nếu connection được hold lâu hơn threshold (ví dụ 2000ms = 2s) → log warning với stack trace của caller. Giúp phát hiện: connection không close, long-running transaction, forgetting to close ResultSet. Config: `spring.datasource.hikari.leak-detection-threshold=2000`. Trong test: đặt threshold nhỏ (200ms) để phát hiện leak. Không nên enable trong production với threshold quá thấp — false positive warning. Log: `[HikariPool-1] Connection leak detection triggered for ... stack trace`.

</details>
