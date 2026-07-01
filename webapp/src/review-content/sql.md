---
key: "SQL"
title: "SQL"
crumb: "4. Database"
---

SQL là ngôn ngữ chuẩn cho cơ sở dữ liệu quan hệ — thành thạo JOIN, window function, indexing và transaction là thiết yếu cho phỏng vấn backend.

## Điểm Chính

- DDL: CREATE, ALTER, DROP. DML: SELECT, INSERT, UPDATE, DELETE. DCL: GRANT, REVOKE.
- JOIN: INNER (hàng khớp), LEFT (tất cả bên trái + khớp bên phải), RIGHT, FULL OUTER, CROSS.
- Aggregate: GROUP BY + HAVING lọc aggregate; WHERE lọc hàng trước khi nhóm.
- Window function: <code>ROW_NUMBER()</code>, <code>RANK()</code>, <code>LAG()</code>, <code>LEAD()</code> — tính toán trên partition mà không gộp hàng.
- Subquery vs CTE: CTE (<code>WITH</code>) cải thiện đọc hiểu và có thể đệ quy.

## Ví Dụ Code

*CTE cho customer ranking + window function cho running total và MoM growth*

```sql
-- ✅ CTE: readable multi-step query — find high-value orders per customer
WITH customer_totals AS (
    -- Step 1: aggregate order totals per customer
    SELECT u.id          AS customer_id,
           u.email,
           COUNT(o.id)   AS order_count,
           SUM(o.total)  AS lifetime_value
    FROM users u
    JOIN orders o ON o.customer_id = u.id
    WHERE o.status = 'COMPLETED'
    GROUP BY u.id, u.email
),
ranked_customers AS (
    -- Step 2: rank within each country by lifetime value
    SELECT *,
           RANK() OVER (ORDER BY lifetime_value DESC) AS value_rank
    FROM customer_totals
)
SELECT customer_id, email, order_count, lifetime_value, value_rank
FROM ranked_customers
WHERE value_rank <= 10;      -- top 10 customers by lifetime value

-- ✅ Window function: running revenue total + month-over-month growth
SELECT
    DATE_TRUNC('month', o.created_at)               AS month,
    SUM(o.total)                                    AS monthly_revenue,
    -- Running cumulative total (all rows from start up to current month)
    SUM(SUM(o.total)) OVER (ORDER BY DATE_TRUNC('month', o.created_at)
                            ROWS UNBOUNDED PRECEDING) AS cumulative_revenue,
    -- Previous month revenue for comparison
    LAG(SUM(o.total)) OVER (ORDER BY DATE_TRUNC('month', o.created_at)) AS prev_month,
    -- Growth % vs previous month
    ROUND(
        100.0 * (SUM(o.total) - LAG(SUM(o.total)) OVER (ORDER BY DATE_TRUNC('month', o.created_at)))
              / NULLIF(LAG(SUM(o.total)) OVER (ORDER BY DATE_TRUNC('month', o.created_at)), 0),
        2
    )                                               AS growth_pct
FROM orders
WHERE status = 'COMPLETED'
  AND created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', o.created_at)
ORDER BY month;
```

## Ứng Dụng Thực Tế

Trong Spring app, viết query analytics phức tạp dưới dạng native SQL qua <code>@Query(nativeQuery=true)</code> hoặc dùng QueryDSL cho dynamic query type-safe. Đừng cố diễn đạt window function qua JPA — làm nó trong SQL.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa HAVING và WHERE?</strong></summary>

**A:** **`WHERE`**: filter rows **trước** khi GROUP BY — không dùng aggregate functions. **`HAVING`**: filter groups **sau** GROUP BY — có thể dùng aggregate functions (`COUNT`, `SUM`, `AVG`). Ví dụ: `SELECT department, COUNT(*) FROM employees WHERE salary > 50000 GROUP BY department HAVING COUNT(*) > 5`. WHERE lọc employee có salary > 50k trước; HAVING chỉ giữ department có hơn 5 employees sau group. Sai phổ biến: dùng HAVING thay WHERE (chậm hơn — WHERE filter sớm hơn, ít row hơn để group).

</details>

<details>
<summary><strong>Giải thích LEFT JOIN và INNER JOIN với ví dụ.</strong></summary>

**A:** **INNER JOIN**: chỉ trả row có **match trong cả hai bảng**. **LEFT JOIN**: trả **tất cả row của bảng trái** + matched rows từ bảng phải (NULL nếu không match). `SELECT u.name, o.total FROM users u LEFT JOIN orders o ON u.id = o.user_id` → user không có order vẫn xuất hiện (order columns = NULL). INNER JOIN → user đó bị loại. Dùng LEFT JOIN: muốn tất cả users kể cả chưa có order. INNER JOIN: chỉ muốn user có order. RIGHT JOIN = LEFT JOIN reversed (ít dùng). FULL OUTER JOIN: tất cả rows từ cả hai bảng.

</details>

<details>
<summary><strong>EXPLAIN output trong MySQL có nghĩa gì?</strong></summary>

**A:** Key columns: `type` — access method (tệ nhất → tốt nhất: ALL → index → range → ref → eq_ref → const). `ALL` = full table scan. `key` — index được dùng (NULL = không dùng index). `rows` — estimated rows scanned. `Extra` — thêm info: "Using filesort" (sort không dùng index — slow), "Using temporary" (temp table — slow), "Using index" (covering index — fast). Action: nếu `type=ALL` và rows nhiều → thêm index. Nếu "Using filesort" → thêm index trên ORDER BY column.

</details>
