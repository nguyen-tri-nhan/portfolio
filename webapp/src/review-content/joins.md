---
key: "Joins"
title: "SQL Joins"
crumb: "4. Database › SQL"
---

JOIN kết hợp hàng từ nhiều bảng dựa trên cột liên quan — hiểu từng loại là quan trọng để viết query đúng.

## Điểm Chính

- <strong>INNER JOIN</strong>: chỉ trả về hàng nơi điều kiện join khớp ở cả hai bảng.
- <strong>LEFT JOIN</strong>: tất cả hàng từ bảng trái; NULL cho hàng bên phải không khớp.
- <strong>RIGHT JOIN</strong>: tất cả hàng từ bảng phải; NULL cho hàng bên trái không khớp.
- <strong>FULL OUTER JOIN</strong>: tất cả hàng từ cả hai; NULL nơi không khớp.
- <strong>CROSS JOIN</strong>: tích Descartes — mỗi hàng × mỗi hàng.
- <strong>SELF JOIN</strong>: join bảng với chính nó (ví dụ: nhân viên → quản lý).

## Ví Dụ Code

*INNER JOIN, LEFT JOIN (with aggregation), anti-join pattern, FULL OUTER JOIN*

```sql
-- ✅ INNER JOIN: only orders that have items (both sides must match)
SELECT o.id AS order_id, o.total, oi.quantity, p.name AS product_name
FROM orders o
INNER JOIN order_items oi ON oi.order_id = o.id
INNER JOIN products p     ON p.id = oi.product_id
WHERE o.status = 'COMPLETED'
ORDER BY o.created_at DESC;

-- ✅ LEFT JOIN: all users, even those with no orders yet
SELECT u.id, u.email,
       COUNT(o.id)  AS order_count,   -- 0 when no orders (NULL → 0 via COUNT)
       SUM(o.total) AS total_spent     -- NULL when no orders
FROM users u
LEFT JOIN orders o ON o.customer_id = u.id
GROUP BY u.id, u.email
ORDER BY total_spent DESC NULLS LAST;

-- ✅ Anti-join pattern: users who have NEVER placed an order
-- LEFT JOIN + NULL check is more portable than NOT EXISTS in some DBs
SELECT u.id, u.email, u.created_at
FROM users u
LEFT JOIN orders o ON o.customer_id = u.id
WHERE o.id IS NULL                     -- no matching order row → user never ordered
  AND u.created_at < NOW() - INTERVAL '30 days';  -- signed up 30+ days ago

-- ✅ FULL OUTER JOIN: all products and all order_items, including orphans on either side
-- Use case: data quality check — find products never ordered AND order_items with no product
SELECT p.id AS product_id, p.name, oi.order_id
FROM products p
FULL OUTER JOIN order_items oi ON oi.product_id = p.id
WHERE p.id IS NULL           -- orphaned order_item (product deleted)
   OR oi.product_id IS NULL; -- product that was never ordered
```

## Ứng Dụng Thực Tế

LEFT JOIN với NULL check là pattern phổ biến "tìm bản ghi không có bản ghi liên quan". Cẩn thận với nhiều LEFT JOIN — thất bại khớp ở một join có thể lan truyền NULL qua các join tiếp theo.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa LEFT JOIN và INNER JOIN là gì?</strong></summary>

**A:** **INNER JOIN**: chỉ trả về row có match ở cả hai table. **LEFT JOIN** (LEFT OUTER JOIN): trả về tất cả row từ table bên trái; nếu không có match bên phải → column bên phải là NULL. Ví dụ: `SELECT u.name, o.id FROM users u LEFT JOIN orders o ON u.id=o.user_id` → trả về tất cả user kể cả user chưa có đơn hàng (order_id = NULL). INNER JOIN = "chỉ user có đơn hàng". Dùng LEFT JOIN khi muốn giữ tất cả record của table chính.

</details>

<details>
<summary><strong>Làm thế nào để tìm hàng trong Bảng A không có khớp trong Bảng B?</strong></summary>

**A:** Dùng **LEFT JOIN + IS NULL** pattern:
```sql
SELECT a.* FROM table_a a
LEFT JOIN table_b b ON a.id = b.a_id
WHERE b.a_id IS NULL;
```
Hoặc `NOT EXISTS`:
```sql
SELECT * FROM table_a a
WHERE NOT EXISTS (SELECT 1 FROM table_b b WHERE b.a_id = a.id);
```
Hoặc `NOT IN` (cẩn thận: nếu subquery có NULL → NOT IN trả về empty). LEFT JOIN + IS NULL thường được optimizer tối ưu tốt nhất.

</details>

<details>
<summary><strong>Tích Descartes là gì và khi nào có thể vô tình xảy ra?</strong></summary>

**A:** Tích Descartes (Cartesian product): kết hợp mỗi row của table A với mỗi row của table B — N×M rows. Vô tình xảy ra khi: (1) Quên ON condition trong JOIN: `FROM a, b` hoặc `FROM a JOIN b` không có ON — cross join tất cả. (2) JOIN condition sai/không đủ selective: `ON a.year = b.year` khi nhiều row có cùng year. (3) Aggregate nhiều JOIN: mỗi 1-to-many JOIN nhân rows — dùng `SUM` có thể bị double-count (aggregate join anti-pattern).

</details>
