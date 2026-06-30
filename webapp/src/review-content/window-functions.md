---
key: "Window Functions"
title: "Window Functions"
crumb: "4. Database › SQL"
---

Window function tính toán giá trị trên tập hàng liên quan đến hàng hiện tại (một "window") mà không gộp chúng — khác GROUP BY làm giảm số hàng.

## Điểm Chính

- Cú pháp: <code>FUNCTION() OVER (PARTITION BY col ORDER BY col ROWS/RANGE frame)</code>.
- <strong>Ranking</strong>: <code>ROW_NUMBER()</code> (tuần tự duy nhất), <code>RANK()</code> (có khoảng khi bằng nhau), <code>DENSE_RANK()</code> (không khoảng).
- <strong>Offset</strong>: <code>LAG(col, n)</code> (hàng trước), <code>LEAD(col, n)</code> (hàng sau).
- <strong>Aggregate</strong>: <code>SUM()</code>, <code>AVG()</code>, <code>COUNT()</code> trên window.
- Frame clause: <code>ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code> cho running total.

## Ví Dụ Code

*ROW_NUMBER vs RANK vs DENSE_RANK + Top-N per group + LAG/LEAD per customer*

```sql
-- ✅ ROW_NUMBER vs RANK vs DENSE_RANK — key differences
-- Given orders: totals 500, 500, 300, 200
-- ROW_NUMBER:  1, 2, 3, 4  (always unique, arbitrary tie-breaking)
-- RANK:        1, 1, 3, 4  (tie gets same rank; next rank skips)
-- DENSE_RANK:  1, 1, 2, 3  (tie gets same rank; no gaps)

-- ✅ Top 3 products by revenue within each category (common interview question)
SELECT category, product_id, product_name, revenue, rnk
FROM (
    SELECT
        p.category,
        p.id          AS product_id,
        p.name        AS product_name,
        SUM(oi.quantity * oi.unit_price) AS revenue,
        -- RANK gives same position to ties; use ROW_NUMBER to guarantee exactly 3 rows
        RANK() OVER (PARTITION BY p.category ORDER BY SUM(oi.quantity * oi.unit_price) DESC) AS rnk
    FROM products p
    JOIN order_items oi ON oi.product_id = p.id
    JOIN orders o       ON o.id = oi.order_id
    WHERE o.status = 'COMPLETED'
      AND o.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY p.category, p.id, p.name
) ranked
WHERE rnk <= 3
ORDER BY category, rnk;

-- ✅ LAG / LEAD: compare each order's total to the customer's previous order
SELECT
    o.id           AS order_id,
    o.customer_id,
    o.total,
    o.created_at,
    LAG(o.total)  OVER (PARTITION BY o.customer_id ORDER BY o.created_at) AS prev_order_total,
    LEAD(o.total) OVER (PARTITION BY o.customer_id ORDER BY o.created_at) AS next_order_total,
    o.total - LAG(o.total) OVER (PARTITION BY o.customer_id ORDER BY o.created_at) AS change_vs_prev
FROM orders o
WHERE o.status = 'COMPLETED'
ORDER BY o.customer_id, o.created_at;
```

## Ứng Dụng Thực Tế

Window function mạnh cho báo cáo nhưng chạy trên DB server — đảm bảo index phù hợp trên cột PARTITION BY và ORDER BY. Với dataset rất lớn, xem xét pre-aggregate trong materialized view.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa ROW_NUMBER và RANK là gì?
1. Làm thế nào để lấy giá trị hàng trước đó trong SQL?
1. Bạn có thể dùng window function trong mệnh đề WHERE không?
