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

<details>
<summary><strong>Sự khác biệt giữa clustered và non-clustered index là gì?</strong></summary>

**A:** **Clustered index**: data rows được **sắp xếp vật lý** theo index key — chỉ có một clustered index per table vì không thể sắp xếp vật lý theo hai chiều. InnoDB: Primary Key là clustered index mặc định, data pages chứa actual rows. **Non-clustered index**: B-tree riêng, leaf node chứa index key + pointer đến row (row ID hoặc PK). Nhiều non-clustered index per table. Lookup qua non-clustered: traverse index → fetch row từ clustered index (double lookup).

</details>

<details>
<summary><strong>Khi nào bạn dùng composite index?</strong></summary>

**A:** Dùng composite index khi: (1) Query thường filter theo nhiều column cùng lúc: `WHERE status='ACTIVE' AND user_id=?` → index `(status, user_id)`. (2) Muốn **covering index**: include SELECT columns vào index để tránh table lookup. (3) ORDER BY theo nhiều column: `ORDER BY a, b` → index `(a, b)` eliminate filesort. Rule: đặt equality column trước, range column sau. Số lượng: đừng tạo quá nhiều — mỗi index tốn write overhead.

</details>

<details>
<summary><strong>Index selectivity là gì và tại sao quan trọng?</strong></summary>

**A:** **Selectivity** = số distinct values / tổng rows. Cao (gần 1.0): index rất selective — gender (M/F) selectivity ≈ 0.5, email selectivity ≈ 1.0. DB optimizer dùng selectivity để quyết định có dùng index hay không. Index với selectivity thấp (ví dụ: boolean column, status với 3 giá trị) thường không hiệu quả — DB có thể chọn full table scan nhanh hơn. Kiểm tra: `SHOW INDEX FROM table` → cardinality column.

</details>
