---
key: "Composite Index"
title: "Composite Index"
crumb: "4. Database › Indexing"
---

Composite index (nhiều cột) bao gồm nhiều cột theo thứ tự định nghĩa, theo leftmost prefix rule — hiệu quả khi query lọc trên cột đầu.

## Điểm Chính

- Index trên <code>(a, b, c)</code> phục vụ query trên: <code>a</code>, <code>(a,b)</code>, hoặc <code>(a,b,c)</code> — KHÔNG phải <code>b</code> đơn độc hay <code>c</code> đơn độc.
- Thứ tự cột quan trọng: đặt cột selectivity cao / equality trước, cột range sau.
- Điều kiện range trên cột N vô hiệu hóa dùng index cho cột N+1 trở đi.
- Composite index có thể loại bỏ sort nếu ORDER BY khớp thứ tự cột index.
- Index trên <code>(user_id, created_at DESC)</code>: hoàn hảo cho query "đơn hàng gần đây của user".

## Ví Dụ Code

*Leftmost prefix rule: full/partial index use, range breaks further columns*

```sql
-- ✅ Design composite index for the most common access pattern
-- Pattern: "give me a customer's recent orders by status"
-- Index: (customer_id, status, created_at DESC)
CREATE INDEX idx_orders_customer_status_date
    ON orders(customer_id, status, created_at DESC);

-- ✅ Uses full composite index (equality on first two, sort/range on third):
SELECT id, total, created_at
FROM orders
WHERE customer_id = 42
  AND status = 'COMPLETED'
ORDER BY created_at DESC
LIMIT 20;
-- → Index Scan using idx_orders_customer_status_date (3 columns used)

-- ✅ Uses leftmost prefix only (first column matches):
SELECT id, total FROM orders WHERE customer_id = 42;
-- → Index Scan using idx_orders_customer_status_date (1 column used — still fine)

-- ✅ Uses first two columns (equality on both):
SELECT id FROM orders WHERE customer_id = 42 AND status = 'PENDING';
-- → Index Scan using idx_orders_customer_status_date (2 columns used)

-- ❌ CANNOT use this composite index (skips leftmost column):
SELECT id FROM orders WHERE status = 'PENDING';
-- → Seq Scan — needs a separate index on (status) or (status, created_at)

-- ❌ Range on first column breaks usage for second column:
SELECT id FROM orders
WHERE customer_id > 100 AND status = 'COMPLETED';
-- → Only customer_id part of index is used; status filter applied as recheck
-- (range on column N disables index use for columns N+1 onward)

-- ✅ Rule of thumb for column order:
-- 1. Equality columns first (highest selectivity first among them)
-- 2. Range / sort column last
-- Index (customer_id=equality, status=equality, created_at=sort) is optimal here
```

## Ứng Dụng Thực Tế

Thiết kế index xung quanh query thường xuyên nhất. Kiểm tra <code>pg_stat_user_indexes</code> cho index không dùng đang lãng phí write overhead. Chạy <code>EXPLAIN (ANALYZE, BUFFERS)</code> để xác minh dùng index.

## Câu Hỏi Phỏng Vấn

1. Giải thích leftmost prefix rule cho composite index.
1. Với index (a, b), query nào có thể dùng nó: WHERE b=1, WHERE a=1 hay WHERE a=1 AND b=1?
1. Thứ tự cột trong composite index ảnh hưởng hiệu năng thế nào?
