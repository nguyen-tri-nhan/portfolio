---
key: "Covering Index"
title: "Covering Index"
crumb: "4. Database › Indexing"
---

Covering index chứa tất cả cột cần thiết cho query, cho phép DB trả lời hoàn toàn từ index mà không cần truy cập table heap — tối đa hóa hiệu năng đọc.

## Điểm Chính

- Index "covers" một query khi cột SELECT, WHERE và ORDER BY đều nằm trong index.
- Loại bỏ "heap fetch" (random I/O đến table page) — đặc biệt có tác động cho bảng lớn.
- PostgreSQL: mệnh đề <code>INCLUDE</code> thêm cột không phải key vào index leaf page.
- Trade-off: covering index lớn hơn — chỉ bao gồm cột được đọc thường xuyên.
- Output EXPLAIN hiển thị "Index Only Scan" cho covering index (không truy cập heap).

## Ví Dụ Code

*Covering index với INCLUDE: từ Index Scan (heap fetch) sang Index Only Scan (0 heap fetch)*

```sql
-- ✅ Target query for covering index: order list API endpoint (called thousands/sec)
-- Columns needed: WHERE customer_id, SELECT id + status + total + created_at
SELECT id, status, total, created_at
FROM orders
WHERE customer_id = 42
  AND status IN ('PENDING', 'PROCESSING')
ORDER BY created_at DESC
LIMIT 20;

-- ❌ Without covering index: two-phase lookup
-- Phase 1: B-Tree index scan on customer_id → get row pointers
-- Phase 2: heap fetch for EACH matching row to read status, total, created_at
--          (random I/O — expensive on spinning disk or large tables)

-- ✅ Covering index: key columns in index, extra payload in INCLUDE
-- INCLUDE columns are stored in leaf pages but NOT in internal B-Tree pages
-- → index is smaller (INCLUDE columns not used for tree navigation)
CREATE INDEX idx_orders_customer_covering
    ON orders(customer_id, status, created_at DESC)   -- key cols: used for lookup + sort
    INCLUDE (id, total);                               -- payload cols: read from leaf, no heap fetch

-- Now the query uses Index Only Scan — no heap access at all:
-- EXPLAIN output:
-- Index Only Scan using idx_orders_customer_covering on orders
--   Index Cond: ((customer_id = 42) AND (status = ANY ('{PENDING,PROCESSING}'::text[])))
--   Heap Fetches: 0          ← key metric: 0 means full covering
--   Buffers: shared hit=4    ← 4 index pages read; no table pages
-- Rows Removed by Filter: 0

-- ✅ Verify covering effectiveness:
-- pg_stat_user_indexes tracks idx_tup_read vs idx_tup_fetch
-- idx_tup_fetch = 0 means Index Only Scan is working (no heap fetch)
SELECT indexrelname, idx_tup_read, idx_tup_fetch,
       ROUND(100.0 * idx_tup_fetch / NULLIF(idx_tup_read, 0), 1) AS heap_fetch_pct
FROM pg_stat_user_indexes
WHERE indexrelname = 'idx_orders_customer_covering';
```

## Ứng Dụng Thực Tế

Với hot read path (ví dụ: API endpoint được query hàng nghìn lần/giây), thiết kế covering index cụ thể cho những query đó. Monitor heap fetch ratio qua <code>pg_stat_user_indexes.idx_tup_fetch</code> vs <code>idx_tup_read</code>.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Covering index là gì và cải thiện hiệu năng thế nào?</strong></summary>

**A:** **Covering index**: index chứa tất cả column mà query cần (WHERE, SELECT, ORDER BY) — DB không cần access table data, chỉ cần đọc index. Ví dụ: `CREATE INDEX idx ON orders(user_id, status, total)` cho query `SELECT total FROM orders WHERE user_id=? AND status='ACTIVE'` — tất cả column đều có trong index. Giảm I/O dramatically vì index tree nhỏ hơn table nhiều, fit vào buffer pool.

</details>

<details>
<summary><strong>"Index Only Scan" trong output EXPLAIN có nghĩa gì?</strong></summary>

**A:** `Index Only Scan` trong PostgreSQL EXPLAIN (hoặc `Using index` trong MySQL EXPLAIN Extra) — query được satisfy hoàn toàn từ index mà không cần access heap table. Đây là dấu hiệu **covering index đang hoạt động**. PostgreSQL: phải check visibility map vì MVCC — nếu table chưa được VACUUM, vẫn có thể cần heap access. So sánh: `Index Scan` = dùng index để navigate nhưng vẫn cần fetch row từ table.

</details>

<details>
<summary><strong>Khi nào covering index KHÔNG có lợi?</strong></summary>

**A:** (1) **SELECT *** — phải include tất cả column vào index, index to bằng table, không có lợi. (2) **Write-heavy table**: mỗi INSERT/UPDATE phải update thêm covering index — overhead ghi tăng. (3) **Column có giá trị lớn** (TEXT, BLOB) trong SELECT — index quá to, chậm hơn table scan. (4) **Low selectivity query trả về nhiều row**: overhead traverse index rồi filter không worth it so với full table scan.

</details>
