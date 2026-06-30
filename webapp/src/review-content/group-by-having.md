---
key: "GROUP BY / HAVING"
title: "GROUP BY / HAVING"
crumb: "4. Database › SQL"
---

GROUP BY gộp hàng thành nhóm để aggregate; HAVING lọc nhóm sau aggregate — tương tự WHERE nhưng cho kết quả aggregated.

## Điểm Chính

- Cột SELECT phải nằm trong GROUP BY hoặc được bọc trong aggregate (<code>SUM</code>, <code>COUNT</code>, <code>MAX</code>).
- Thứ tự thực thi: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.
- HAVING vs WHERE: WHERE lọc hàng riêng lẻ <em>trước</em> khi nhóm; HAVING lọc nhóm <em>sau</em>.
- <code>GROUP BY ROLLUP</code>: thêm subtotal. <code>GROUPING SETS</code>: nhiều tổ hợp nhóm.

## Ví Dụ Code

*GROUP BY + HAVING cho VIP customers + ROLLUP cho multi-level sales report*

```sql
-- ✅ Basic GROUP BY + HAVING: VIP customers (5+ completed orders, spent > $500)
-- Execution order: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY
SELECT
    u.id           AS customer_id,
    u.email,
    COUNT(o.id)    AS order_count,
    SUM(o.total)   AS total_spent,
    AVG(o.total)   AS avg_order_value,
    MAX(o.created_at) AS last_order_date
FROM users u
JOIN orders o ON o.customer_id = u.id
WHERE o.status = 'COMPLETED'           -- ✅ WHERE filters individual rows BEFORE grouping
  AND o.created_at >= '2024-01-01'     --    (cheaper: reduces rows that enter GROUP BY)
GROUP BY u.id, u.email
HAVING COUNT(o.id) >= 5               -- ✅ HAVING filters groups AFTER aggregation
   AND SUM(o.total) > 500             --    (can reference aggregate functions here)
ORDER BY total_spent DESC
LIMIT 100;

-- ✅ ROLLUP: sales report with subtotals per category and grand total
-- NULL in the result = the subtotal/grand-total row for that dimension
SELECT
    p.category,
    DATE_TRUNC('month', o.created_at) AS month,
    SUM(oi.quantity * oi.unit_price)  AS revenue,
    COUNT(DISTINCT o.id)              AS order_count
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p     ON p.id = oi.product_id
WHERE o.status = 'COMPLETED'
  AND o.created_at >= NOW() - INTERVAL '6 months'
GROUP BY ROLLUP(p.category, DATE_TRUNC('month', o.created_at))
-- Result rows include:
--   (Electronics, 2024-01) → specific month subtotal
--   (Electronics, NULL)    → Electronics total across all months
--   (NULL, NULL)           → grand total across all categories
ORDER BY p.category NULLS LAST, month NULLS LAST;
```

## Ứng Dụng Thực Tế

Luôn đặt điều kiện trên cột không aggregate vào WHERE (không phải HAVING) để hiệu năng — DB có thể lọc hàng trước khi nhóm, giảm công việc. Chỉ dùng HAVING cho điều kiện trên kết quả aggregate.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa WHERE và HAVING là gì?
1. Bạn có thể dùng HAVING mà không có GROUP BY không?
1. Thứ tự thực thi SQL là gì?
