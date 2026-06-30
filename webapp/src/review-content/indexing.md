---
key: "Indexing"
title: "Database Indexing"
crumb: "4. Database"
---

Index là cấu trúc dữ liệu (thường là B-Tree) tăng tốc truy xuất dữ liệu với chi phí write overhead và storage, biến đổi full table scan thành lookup nhanh.

## Điểm Chính

- Không có index: full table scan O(n). Với B-Tree index: O(log n) cho range query.
- Index tăng tốc SELECT với WHERE, JOIN, ORDER BY, GROUP BY trên cột được index.
- Index làm chậm INSERT, UPDATE, DELETE (index phải được duy trì).
- Index chọn lọc hoạt động tốt nhất — cột cardinality cao (email, UUID) hơn thấp (boolean, status).
- Dùng <code>EXPLAIN ANALYZE</code> để xem index có được dùng không và số hàng thực tế vs ước tính.

## Ví Dụ Code

*Single, composite, covering, partial index + EXPLAIN ANALYZE*

```sql
-- ✅ Single-column index: speeds up WHERE / JOIN / ORDER BY on one column
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_created_at  ON orders(created_at DESC);  -- DESC for "latest first" queries

-- ✅ Composite index: (customer_id, status) — leftmost prefix rule
-- Serves: WHERE customer_id = ?                       (uses first column only)
--         WHERE customer_id = ? AND status = ?        (uses both columns)
-- Does NOT serve: WHERE status = ?                    (skips first column → full scan)
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);

-- ✅ Covering index with INCLUDE (PostgreSQL): store extra columns in leaf page
-- Query: SELECT id, total, created_at FROM orders WHERE customer_id = 42 AND status = 'COMPLETED'
-- With INCLUDE, DB can answer entirely from the index → Index Only Scan (no heap fetch)
CREATE INDEX idx_orders_covering
    ON orders(customer_id, status)
    INCLUDE (id, total, created_at);

-- ✅ Partial index: only index the rows you actually query
-- Much smaller index, faster writes on the majority of rows
CREATE INDEX idx_orders_pending ON orders(customer_id, created_at)
    WHERE status = 'PENDING';   -- only ~5% of rows → tiny index

-- ✅ EXPLAIN ANALYZE: verify index is used and check actual vs estimated rows
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, total, created_at
FROM orders
WHERE customer_id = 42
  AND status = 'COMPLETED'
ORDER BY created_at DESC
LIMIT 10;
-- Look for: "Index Only Scan" or "Index Scan" (good) vs "Seq Scan" (bad)
-- "Buffers: shared hit=3" means 3 index pages read — very fast
-- "rows=10 (actual rows=8)" — good estimate; large divergence → run ANALYZE
```

## Ứng Dụng Thực Tế

Thêm index dựa trên slow query log thực tế (<code>pg_stat_statements</code> trong PostgreSQL), không phải đoán mò. Composite index theo leftmost prefix rule — <code>(a, b)</code> phục vụ query trên <code>a</code> hoặc <code>(a, b)</code> nhưng không phải <code>b</code> đơn độc.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa clustered và non-clustered index là gì?
1. Khi nào bạn dùng composite index?
1. Index selectivity là gì và tại sao quan trọng?
