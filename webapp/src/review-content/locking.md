---
key: "Locking"
title: "Database Locking"
crumb: "4. Database › Transactions"
---

Lock ngăn transaction đồng thời làm hỏng dữ liệu chia sẻ — từ table-level đến row-level, với loại lock shared (đọc) và exclusive (ghi).

## Điểm Chính

- <strong>Shared lock (S)</strong>: nhiều reader được phép đồng thời. <code>SELECT FOR SHARE</code>.
- <strong>Exclusive lock (X)</strong>: một writer duy nhất; block tất cả reader/writer khác. <code>SELECT FOR UPDATE</code>.
- <strong>Row-level locking</strong>: chi tiết nhất; concurrency cao. Table-level: thô hơn, overhead thấp hơn.
- <strong>Optimistic locking</strong>: không lock khi đọc; kiểm tra version lúc ghi (thất bại nếu thay đổi).
- <strong>Pessimistic locking</strong>: lock khi đọc (<code>SELECT FOR UPDATE</code>); giữ đến khi commit.
- Deadlock: hai transaction giữ lock mà cái kia cần. DB phát hiện và rollback một.

## Ví Dụ Code

*Pessimistic (SELECT FOR UPDATE, FOR SHARE, deadlock) + Optimistic (@Version, @Retryable)*

```sql
-- ✅ Pessimistic locking: SELECT FOR UPDATE — lock the row before reading
-- Use when: high-contention (flash sale, ticket booking) and retry is too expensive
BEGIN;
-- Locks the product row immediately; other transactions block on this line until we COMMIT
SELECT id, stock FROM products WHERE id = 99 FOR UPDATE;
-- Now safe: no other transaction can modify stock until we release the lock
UPDATE products SET stock = stock - 2 WHERE id = 99;
INSERT INTO order_items(order_id, product_id, quantity) VALUES (5001, 99, 2);
COMMIT;  -- lock released here

-- SELECT FOR SHARE: allows other readers but blocks writers
BEGIN;
SELECT * FROM orders WHERE id = 5001 FOR SHARE;  -- other readers OK; writers wait
-- Use when: you read data that must stay stable but don't need to write it
COMMIT;

-- ✅ Deadlock scenario (and how DB detects it):
-- T1: LOCK product 99 → then tries to lock product 100
-- T2: LOCK product 100 → then tries to lock product 99
-- DB detects cycle → rolls back one transaction with "deadlock detected" error
-- Prevention: always acquire locks in the same order (e.g., by ascending product ID)

-- ✅ Optimistic locking (JPA @Version): version field checked on every UPDATE
-- Use when: low-contention (user profile updates) and retry is cheap
@Entity
@Table(name = "products")
public class Product {
    @Id
    private Long id;
    private String name;
    private int stock;

    @Version
    private Long version;  // incremented automatically by Hibernate on each flush
}

@Transactional
@Retryable(value = OptimisticLockException.class, maxAttempts = 3, backoff = @Backoff(delay = 100))
public void decrementStock(Long productId, int qty) {
    Product p = productRepository.findById(productId).orElseThrow();
    if (p.getStock() < qty) throw new OutOfStockException();
    p.setStock(p.getStock() - qty);
    // Hibernate issues: UPDATE products SET stock=?, version=? WHERE id=? AND version=?
    //                                                               ^^^^^^^^^^^^^^^^^^^^^^^^
    //                                                               If version changed → 0 rows → OptimisticLockException
}  // @Retryable retries up to 3 times with 100ms delay
```

## Ứng Dụng Thực Tế

Dùng optimistic locking (<code>@Version</code>) cho tình huống low-contention — tránh lock overhead và scale tốt hơn. Dùng pessimistic locking cho tài nguyên contention cao (ví dụ: đặt chỗ) nơi xung đột thường xuyên và retry tốn kém.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa optimistic và pessimistic locking là gì?
1. Deadlock trong DB có thể xảy ra khi nào và DB giải quyết thế nào?
1. @Version implement optimistic locking trong JPA thế nào?
