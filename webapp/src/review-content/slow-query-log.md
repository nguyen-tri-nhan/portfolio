---
key: "Slow Query Log"
title: "Slow Query Log"
crumb: "4. Database › MySQL Deep Dive"
---

MySQL slow query log ghi lại query vượt ngưỡng thời gian cấu hình. Đây là cách đáng tin cậy nhất để xác định bottleneck hiệu năng thực từ traffic production, khác với benchmark tổng hợp.

## Điểm Chính

- Bật: <code>slow_query_log=ON</code>, <code>long_query_time=1</code> (giây), <code>slow_query_log_file=/var/log/mysql/slow.log</code>.
- <code>log_queries_not_using_indexes=ON</code>: log cả query không dùng index bất kể thời gian.
- <strong>mysqldumpslow</strong>: aggregator tích hợp sẵn. Sort theo <code>-s t</code> (total time) hoặc <code>-s c</code> (count).
- <strong>pt-query-digest</strong> (Percona Toolkit): group query tương tự theo fingerprint, hiển thị total time, p95 latency, và query ví dụ.
- Ưu tiên theo <strong>total time</strong>, không phải count — query chạy 1M lần/ngày ở 1ms tốn hơn query chạy 1 lần ở 5s.
- <strong>Performance Schema</strong>: thay thế granular hơn, tích hợp sẵn MySQL 5.7+ (mặc định bật).

## Ví Dụ Code

*Bật slow query log và phân tích*

```sql
-- Bật slow query log (runtime, không cần restart)
SET GLOBAL slow_query_log      = 'ON';
SET GLOBAL long_query_time     = 1;       -- log query > 1 giây
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';
SET GLOBAL log_queries_not_using_indexes = 'ON';

-- Verify
SHOW VARIABLES LIKE '%slow%';

-- Phân tích bằng mysqldumpslow (có sẵn)
# Top 10 query theo total time:
mysqldumpslow -s t -t 10 /var/log/mysql/slow.log

# Top 10 theo count:
mysqldumpslow -s c -t 10 /var/log/mysql/slow.log

-- Percona pt-query-digest (mạnh hơn — group theo fingerprint)
pt-query-digest /var/log/mysql/slow.log --limit 10

-- Performance Schema (không cần log file)
SELECT digest_text, count_star,
       avg_timer_wait / 1e12  AS avg_sec,
       sum_timer_wait / 1e12  AS total_sec
FROM performance_schema.events_statements_summary_by_digest
ORDER BY sum_timer_wait DESC
LIMIT 10;
```

## Ứng Dụng Thực Tế

Production: đặt <code>long_query_time=1</code> (hoặc 0.5 cho service SLA chặt). Dùng pt-query-digest để group query tương tự theo fingerprint — nó map "WHERE id=1" và "WHERE id=2" thành cùng canonical query. Fix query theo <strong>total time</strong>: query chạy 100K lần/ngày ở 50ms mỗi lần đóng góp 5000 giây load dù trông có vẻ nhanh.

## Câu Hỏi Phỏng Vấn

1. Bật và phân tích MySQL slow query log thế nào?
1. Query fingerprinting là gì và tại sao quan trọng?
1. Performance Schema khác slow query log thế nào?
