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

1. Tính maximumPoolSize thế nào khi chạy 5 app instance?
1. Điều gì gây ra "Connection is not available, request timed out" trong HikariCP?
1. Khi nào cần thêm ProxySQL trước MySQL?
