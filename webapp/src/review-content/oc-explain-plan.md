---
key: "Đọc EXPLAIN Plan"
title: "Đọc EXPLAIN Plan"
crumb: "4. Database › MySQL Deep Dive"
---

EXPLAIN hiển thị cách MySQL thực thi query: join type, index dùng, số row ước tính, và các thao tác phụ. Đây là công cụ đầu tiên cần dùng khi optimize slow query.

## Điểm Chính

- <strong>Cột type</strong> (tốt → tệ): <code>system > const > eq_ref > ref > range > index > ALL</code>.
- <code>ALL</code>: full table scan — query chạm vào mọi row. Thường nghĩa là thiếu index hoặc index không dùng được.
- <strong>key</strong>: index MySQL chọn (<code>NULL</code> = không dùng index).
- <strong>rows</strong>: số row ước tính phải xét — càng thấp càng tốt.
- <code>Extra: Using index</code>: covering index (tất cả data lấy từ index tree — rất nhanh).
- <code>Extra: Using filesort</code>: sort không được bao bởi index — thêm cột ORDER BY vào index.
- <code>Extra: Using temporary</code>: tạo bảng tạm cho GROUP BY hoặc DISTINCT — tốn kém, thường fix được bằng composite index.
- <code>EXPLAIN ANALYZE</code> (MySQL 8.0+): thực thi thật query và hiển thị timing thực tế.

## Ví Dụ Code

*Đọc EXPLAIN output và cách fix*

```sql
-- EXPLAIN cơ bản
EXPLAIN
SELECT u.name, COUNT(o.id) AS cnt
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE o.status = 'PAID'
  AND o.created_at > '2024-01-01'
GROUP BY u.id;

-- Kết quả mẫu:
-- id | type  | table | key  | rows   | Extra
-- 1  | ALL   | o     | NULL | 500000 | Using where; Using temporary; Using filesort
-- 1  | ref   | u     | PRIMARY | 1   |

-- Vấn đề: type=ALL trên orders, Using temporary, Using filesort
-- Fix: thêm composite index bao gồm WHERE + GROUP BY
CREATE INDEX idx_orders_status_date ON orders (status, created_at, user_id);

-- Sau khi thêm index:
-- id | type  | table | key                    | rows  | Extra
-- 1  | range | o     | idx_orders_status_date | 8230  | Using index condition
-- 1  | ref   | u     | PRIMARY                | 1     |

-- EXPLAIN ANALYZE (MySQL 8.0) — xem timing thực tế
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 42 AND status = 'PENDING'
ORDER BY created_at DESC LIMIT 10;
```

## Ứng Dụng Thực Tế

Trong phỏng vấn mô tả quy trình: 1) EXPLAIN slow query, 2) tìm type=ALL hoặc key NULL, 3) kiểm tra Extra xem có filesort/temporary, 4) thiết kế composite index bao gồm WHERE + ORDER BY + SELECT columns (covering index). Covering index thấy <code>Extra: Using index</code> — query phục vụ hoàn toàn từ index B-tree, không cần chạm data page.

## Câu Hỏi Phỏng Vấn

1. type=ALL trong EXPLAIN có nghĩa gì?
1. Covering index là gì và verify thế nào trong EXPLAIN?
1. Fix query có "Using filesort" trong Extra column thế nào?
