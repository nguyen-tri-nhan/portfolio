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

1. Sự khác biệt giữa WHERE và HAVING là gì?
1. Giải thích INNER JOIN vs LEFT JOIN bằng ví dụ.
1. Window function khác GROUP BY thế nào?
