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

<details>
<summary><strong>Window function khác GROUP BY thế nào?</strong></summary>

**A:** **GROUP BY**: collapse nhiều rows thành **một row per group** — mất individual row data. **Window function** (OVER): tính aggregate **giữ nguyên individual rows** — mỗi row có thêm computed column dựa trên window. Ví dụ: `SELECT name, salary, AVG(salary) OVER (PARTITION BY department) AS dept_avg FROM employees` → mỗi employee row có thêm avg salary của department mình. GROUP BY: `SELECT department, AVG(salary) FROM employees GROUP BY department` → chỉ còn department rows. Dùng window function khi: cần so sánh row với aggregate của nhóm của nó.

</details>

<details>
<summary><strong>PARTITION BY và ORDER BY trong OVER clause là gì?</strong></summary>

**A:** `OVER (PARTITION BY col1 ORDER BY col2)`: **PARTITION BY**: chia rows thành partitions — window function tính riêng trong mỗi partition (tương tự GROUP BY nhưng không collapse). **ORDER BY**: sắp xếp rows trong partition — quan trọng cho running total, rank, lag/lead. Ví dụ: `ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC)` → rank nhân viên trong mỗi department theo salary. `SUM(salary) OVER (PARTITION BY department ORDER BY hire_date)` → running total salary theo hire date trong mỗi department.

</details>

<details>
<summary><strong>LAG và LEAD function dùng để làm gì?</strong></summary>

**A:** **`LAG(col, offset, default)`**: truy cập giá trị của row **trước đó** N rows trong window. **`LEAD(col, offset, default)`**: truy cập giá trị của row **tiếp theo** N rows. Default: giá trị trả về khi không có row (đầu/cuối window). Ví dụ: month-over-month growth:
```sql
SELECT month, revenue,
       LAG(revenue, 1, 0) OVER (ORDER BY month) AS prev_revenue,
       revenue - LAG(revenue, 1, 0) OVER (ORDER BY month) AS growth
FROM monthly_sales;
```
Dùng: time-series analysis (price change, velocity), compare with previous/next row, detect gaps.

</details>
