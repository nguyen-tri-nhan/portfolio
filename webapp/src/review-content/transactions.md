---
key: "Transactions"
title: "Database Transaction"
crumb: "4. Database"
---

Transaction nhóm nhiều thao tác thành đơn vị atomic — tất cả thành công (COMMIT) hoặc tất cả thất bại (ROLLBACK) — đảm bảo thuộc tính ACID cho tính toàn vẹn dữ liệu.

## Điểm Chính

- <strong>ACID</strong>: Atomicity, Consistency, Isolation, Durability.
- BEGIN → thao tác → COMMIT hoặc ROLLBACK.
- Savepoint: rollback một phần trong transaction.
- Isolation level kiểm soát transaction đồng thời có thể thấy gì từ thay đổi đang thực hiện của nhau.
- Transaction dài giữ lock — giữ transaction ngắn để giảm contention.

## Ví Dụ Code

*SQL transaction (multi-step payment) + Spring @Transactional + Savepoint pattern*

```sql
-- ✅ SQL transaction: payment capture must debit wallet AND record payment atomically
BEGIN;
  -- Step 1: debit customer wallet — fail if insufficient balance
  UPDATE users
  SET wallet_balance = wallet_balance - 250.00
  WHERE id = 101 AND wallet_balance >= 250.00;  -- conditional update

  -- Step 2: verify exactly 1 row was updated (i.e., balance was sufficient)
  DO $$ BEGIN
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient balance for user 101';
    END IF;
  END $$;

  -- Step 3: create payment record
  INSERT INTO payments (order_id, user_id, amount, status, paid_at)
  VALUES (5001, 101, 250.00, 'CAPTURED', NOW());

  -- Step 4: mark order as paid
  UPDATE orders SET status = 'PAID', updated_at = NOW() WHERE id = 5001;

COMMIT;  -- all 3 writes committed together (Atomicity)
-- If any step throws → implicit ROLLBACK (no partial state)

-- ✅ Spring @Transactional equivalent — same guarantees, less boilerplate
@Service
public class PaymentService {

    @Transactional  // starts transaction before method, commits on return, rolls back on RuntimeException
    public PaymentResult capturePayment(Long orderId, Long userId, BigDecimal amount) {
        // All repository calls share the SAME Connection / EntityManager
        User user = userRepository.findByIdForUpdate(userId);  // SELECT FOR UPDATE (pessimistic lock)
        if (user.getWalletBalance().compareTo(amount) < 0) {
            throw new InsufficientBalanceException("Balance too low");
            // ↑ RuntimeException → @Transactional triggers ROLLBACK automatically
        }
        user.deductBalance(amount);                      // dirty check → UPDATE on flush
        Payment payment = new Payment(orderId, userId, amount, PaymentStatus.CAPTURED);
        paymentRepository.save(payment);                 // INSERT
        orderRepository.updateStatus(orderId, OrderStatus.PAID);  // UPDATE
        return PaymentResult.success(payment.getId());
    }  // Transaction commits here; all changes flushed to DB atomically
}

// ✅ Savepoint: partial rollback within a transaction
// BEGIN;
//   INSERT INTO payments ...;
//   SAVEPOINT after_payment;
//   INSERT INTO audit_log ...;   -- this might fail
//   ROLLBACK TO SAVEPOINT after_payment;  -- undo only audit_log insert
//   COMMIT;  -- payment still committed
```

## Ứng Dụng Thực Tế

Giữ method <code>@Transactional</code> ngắn và tránh HTTP call bên ngoài trong transaction (giữ DB connection + lock trong suốt thời gian đó). Dùng <code>@Transactional(timeout=5)</code> để ngăn transaction runaway.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>ACID properties giải thích cụ thể trong context của DB?</strong></summary>

**A:** **Atomicity**: transaction là "all or nothing" — nếu bất kỳ operation nào fail, toàn bộ rollback. Implement bằng undo log. **Consistency**: transaction dẫn từ consistent state này sang consistent state khác — constraints (FK, UNIQUE) không bị vi phạm. **Isolation**: concurrent transactions không thấy intermediate state của nhau — implement bằng MVCC hoặc locking. **Durability**: committed transaction persist ngay cả khi crash — implement bằng redo log (WAL). Thực tế: C và I có trade-off với performance.

</details>

<details>
<summary><strong>@Transactional(readOnly=true) có tác dụng gì?</strong></summary>

**A:** (1) **Performance hint**: Hibernate flush mode set sang NEVER — không cần dirty checking, tiết kiệm CPU. (2) **Routing**: với DataSource routing (read replica), readOnly=true → route đến replica. (3) **Optimization**: InnoDB có thể skip lock acquisition cho consistent read. (4) **Fail-fast**: nếu code try write trong readOnly transaction → DataAccessException. Không bảo vệ khỏi stale read trong REPEATABLE READ. Luôn dùng readOnly=true cho service method chỉ SELECT.

</details>
