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

<details>
<summary><strong>Sự khác biệt giữa WHERE và HAVING là gì?</strong></summary>

**A:** **WHERE**: filter rows **trước** khi aggregate — không dùng được aggregate function (`SUM`, `COUNT`). **HAVING**: filter **sau** khi GROUP BY, dùng được aggregate function. Ví dụ: `WHERE age > 18` lọc rows trước; `HAVING COUNT(*) > 5` lọc group sau. Rule: filter non-aggregate condition → WHERE (hiệu quả hơn, loại rows sớm); filter aggregate condition → HAVING. Có thể dùng cả hai: `WHERE age > 18 GROUP BY city HAVING COUNT(*) > 100`.

</details>

<details>
<summary><strong>Bạn có thể dùng HAVING mà không có GROUP BY không?</strong></summary>

**A:** **Có** — toàn bộ result set được treat như một group. Ví dụ: `SELECT COUNT(*) FROM orders HAVING COUNT(*) > 1000` — trả về count nếu total orders > 1000, trả về empty nếu không. Tương đương với `SELECT COUNT(*) FROM orders WHERE (SELECT COUNT(*) FROM orders) > 1000` nhưng ngắn hơn. Thực tế ít dùng pattern này; thường HAVING đi kèm GROUP BY.

</details>

<details>
<summary><strong>Thứ tự thực thi SQL là gì?</strong></summary>

**A:** Logical execution order: (1) **FROM / JOIN** — xác định table, join. (2) **WHERE** — filter rows. (3) **GROUP BY** — group rows. (4) **HAVING** — filter groups. (5) **SELECT** — compute column, expression. (6) **DISTINCT** — remove duplicate. (7) **ORDER BY** — sort. (8) **LIMIT/OFFSET** — paginate. Lý do không dùng SELECT alias trong WHERE: alias được resolve ở bước 5, sau bước 2 WHERE. PostgreSQL cho phép dùng alias trong ORDER BY vì ORDER BY ở bước 7.

</details>
