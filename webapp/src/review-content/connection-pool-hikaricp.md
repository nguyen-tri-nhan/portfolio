---
key: "Connection Pool (HikariCP)"
title: "Connection Pool — HikariCP"
crumb: "4. Database › MySQL Deep Dive"
---

HikariCP là JDBC connection pool mặc định của Spring Boot. Duy trì pool các kết nối DB sẵn sàng dùng, loại bỏ overhead tạo kết nối mỗi request. Sizing đúng là yếu tố quan trọng cho service throughput cao.

## Điểm Chính

- <code>maximumPoolSize</code>: tổng connection DB. Tất cả app instance cộng lại không vượt <code>max_connections</code> của MySQL.
- <code>minimumIdle</code>: connection idle cần giữ ấm. Đặt bằng <code>maximumPoolSize</code> cho load ổn định (tránh overhead resize).
- <code>connectionTimeout</code>: thời gian chờ lấy connection từ pool. Mặc định 30s — giảm xuống 3s để fail fast.
- <code>maxLifetime</code>: tuổi thọ tối đa connection. Phải nhỏ hơn <code>wait_timeout</code> MySQL (mặc định 8h) tránh stale connection.
- <code>leakDetectionThreshold</code>: log warning nếu connection bị giữ quá N ms — phát hiện connection leak.
- Triệu chứng pool quá nhỏ: <code>HikariPool — Connection is not available, request timed out after Xms.</code>

## Ví Dụ Code

*Config HikariCP và sizing multi-instance*

```yaml
# application.yml — HikariCP tuning
spring:
  datasource:
    url: jdbc:mysql://db-host:3306/mydb
         ?useSSL=true&characterEncoding=UTF-8&serverTimezone=UTC
    username: app_user
    password: ${DB_PASSWORD}
    hikari:
      pool-name: AppPool
      maximum-pool-size: 20          # ceiling mỗi instance
      minimum-idle: 20               # = max → pool ổn định
      connection-timeout: 3000       # 3s fail-fast
      idle-timeout: 600000           # 10 phút idle rồi remove
      max-lifetime: 1800000          # 30 phút < MySQL wait_timeout (28800s)
      leak-detection-threshold: 60000 # warn nếu giữ > 60s

# Tính pool cho multi-instance:
# MySQL max_connections = 200
# App instances = 5
# Mỗi instance = 200 / 5 = 40, trừ 20 cho DBA → dùng 30

# Monitor (Prometheus qua Actuator + Micrometer):
management:
  metrics:
    enable:
      hikaricp: true
# Alert khi:
# hikaricp_connections_pending_total > 5 → pool bão hòa
# hikaricp_connections_acquire_seconds (p99) > 100ms → pool quá nhỏ
```

## Ứng Dụng Thực Tế

Pattern incident production phổ biến nhất: traffic spike → pool hết → thread xếp hàng chờ connection → connection timeout cascade → HTTP 500. Phòng ngừa: đặt <code>connectionTimeout=3000ms</code> để fail fast, alert trên <code>connections_pending</code>, scale horizontally trước khi pool bão hòa. HikariCP khuyến nghị: <code>pool size = (CPU_cores * 2) + effective_spindle_count</code> là điểm khởi đầu cho I/O-bound workload.

## Câu Hỏi Phỏng Vấn

1. Điều gì xảy ra khi tất cả HikariCP connection đang được dùng và có request mới?
1. Tính maximumPoolSize thế nào khi deploy 5 app instance?
1. Connection leak detection là gì và cấu hình thế nào?
