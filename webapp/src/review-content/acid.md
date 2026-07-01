---
key: "ACID"
title: "Thuộc Tính ACID"
crumb: "4. Database › Transactions"
---

ACID đảm bảo transaction DB được xử lý đáng tin cậy: Atomicity (tất cả hoặc không), Consistency (trạng thái hợp lệ), Isolation (ẩn concurrent), Durability (tồn tại sau crash).

## Điểm Chính

- <strong>Atomicity</strong>: tất cả thao tác trong transaction thành công hoặc tất cả rollback. Không có update một phần.
- <strong>Consistency</strong>: transaction đưa DB từ trạng thái hợp lệ này sang trạng thái hợp lệ khác (constraint, trigger vẫn được đảm bảo).
- <strong>Isolation</strong>: transaction đồng thời được cô lập — chúng thấy snapshot nhất quán, không phải công việc đang thực hiện của nhau.
- <strong>Durability</strong>: transaction đã commit tồn tại sau crash — dữ liệu được ghi vào storage bền vững (WAL/redo log).
- Hệ thống NoSQL thường nới lỏng ACID để đổi lấy availability/performance — BASE (Basically Available, Soft state, Eventually consistent).

## Ví Dụ Code

*ACID trong e-commerce: Atomicity (order), Consistency (constraints), Isolation (levels), Durability (WAL)*

```sql
-- ✅ ATOMICITY: place order = deduct stock + create order + create payment
-- All succeed together or all roll back — no half-placed orders
BEGIN;
  UPDATE products SET stock = stock - 2 WHERE id = 99 AND stock >= 2;
  INSERT INTO orders(customer_id, status, total) VALUES (42, 'PROCESSING', 199.98);
  INSERT INTO payments(order_id, amount, status) VALUES (LASTVAL(), 199.98, 'PENDING');
COMMIT;
-- If the INSERT into payments fails → the UPDATE to stock and the first INSERT both roll back

-- ✅ CONSISTENCY: DB constraints enforce domain rules within every transaction
-- Schema-level consistency rules:
ALTER TABLE orders ADD CONSTRAINT chk_total_positive CHECK (total > 0);
ALTER TABLE products ADD CONSTRAINT chk_stock_non_negative CHECK (stock >= 0);
-- FK constraint: every order must reference a real customer
ALTER TABLE orders ADD CONSTRAINT fk_orders_users FOREIGN KEY (customer_id) REFERENCES users(id);
-- Any transaction that violates these → rolls back immediately

-- ✅ ISOLATION demonstration (PostgreSQL READ COMMITTED default)
-- Session T1: calculating order total for checkout
-- T1: BEGIN;
-- T1: SELECT SUM(unit_price * quantity) FROM order_items WHERE order_id = 501; → 150.00
-- (T2 concurrently: UPDATE order_items SET quantity=3 WHERE id=5; COMMIT;)
-- T1: SELECT SUM(...) again → might return 165.00  ← non-repeatable read under READ COMMITTED
-- T1: COMMIT;
-- → Use REPEATABLE READ to get same value both times within T1

-- ✅ DURABILITY: PostgreSQL Write-Ahead Log (WAL)
-- Every committed change is written to WAL BEFORE data pages are flushed to disk
-- If server crashes after COMMIT: WAL replay restores all committed transactions
-- pg_walfile_name(pg_current_wal_lsn())  ← current WAL position
-- On crash: PostgreSQL replays WAL from last checkpoint → fully consistent state
```

## Ứng Dụng Thực Tế

Hiểu DB của bạn cung cấp thuộc tính ACID nào vs bạn phải implement. Redis không ACID theo mặc định; dùng MULTI/EXEC cho atomicity. Kafka cung cấp at-least-once delivery — bạn phải implement idempotency cho consistency.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Giải thích durability — cơ chế nào đảm bảo nó trong PostgreSQL?</strong></summary>

**A:** Durability đảm bảo dữ liệu tồn tại vĩnh viễn sau commit dù crash. PostgreSQL dùng **WAL (Write-Ahead Log)**: ghi thay đổi vào WAL file trước khi áp dụng vào data page; khi crash, replay WAL để phục hồi. `fsync` đảm bảo WAL thực sự xuống disk — tắt `fsync` có thể mất dữ liệu ngay cả khi commit thành công.

</details>

<details>
<summary><strong>Isolation khác atomicity thế nào?</strong></summary>

**A:** **Atomicity** — transaction là "tất cả hoặc không có gì" (rollback nếu bất kỳ bước nào fail). **Isolation** — concurrent transaction không thấy intermediate state của nhau. Ví dụ transfer: atomicity đảm bảo cả debit lẫn credit xảy ra cùng lúc; isolation đảm bảo transaction khác không thấy trạng thái "đã trừ nhưng chưa cộng".

</details>

<details>
<summary><strong>BASE có nghĩa gì và DB NoSQL nào theo nó?</strong></summary>

**A:** BASE = **Basically Available, Soft state, Eventually consistent** — đối lập ACID. Hệ thống luôn trả lời (dù có thể stale), state có thể thay đổi do replication, và các replica hội tụ sau thời gian không có update mới. NoSQL theo BASE: **Cassandra**, **DynamoDB** (eventual consistency mặc định), **CouchDB** — ưu tiên availability hơn strong consistency.

</details>
