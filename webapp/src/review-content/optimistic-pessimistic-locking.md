---
key: "Optimistic / Pessimistic Locking"
title: "Optimistic vs Pessimistic Locking"
crumb: "4. Database › JPA / Hibernate"
---

Optimistic locking kiểm tra xung đột tại thời điểm ghi (dùng version field); pessimistic locking ngăn xung đột bằng cách giữ DB lock trong khi đọc.

## Điểm Chính

- <strong>Optimistic</strong>: field <code>@Version</code>. Hibernate thêm <code>AND version=?</code> vào UPDATE. Nếu 0 hàng cập nhật → <code>OptimisticLockException</code>.
- <strong>Pessimistic</strong>: <code>LockModeType.PESSIMISTIC_WRITE</code> → <code>SELECT FOR UPDATE</code>. Row bị lock đến khi commit.
- Optimistic: throughput tốt hơn, tốt cho low-contention. Có thể cần retry logic khi xung đột.
- Pessimistic: ngăn xung đột hoàn toàn nhưng làm tổn hại concurrency (người khác chờ hoặc timeout).
- <code>@Retryable</code> (Spring Retry) có thể tự động retry khi <code>OptimisticLockException</code>.

## Ví Dụ Code

*Optimistic (@Version + @Retryable) vs Pessimistic (@Lock PESSIMISTIC_WRITE + SELECT FOR UPDATE) — khi nào dùng mỗi loại*

```java
// ✅ Optimistic Locking — use when contention is LOW (e.g., user profile update)
// @Version field: Hibernate adds AND version=? to every UPDATE
@Entity
@Table(name = "products")
public class Product {
    @Id
    private Long id;
    private String name;
    private int stock;

    @Version
    private Long version;  // starts at 0; Hibernate increments on every successful UPDATE
}

@Service
public class ProductService {

    @Transactional
    @Retryable(value = OptimisticLockException.class,
               maxAttempts = 3,
               backoff = @Backoff(delay = 50, multiplier = 2))
    public void decrementStock(Long productId, int qty) {
        Product p = productRepository.findById(productId).orElseThrow();
        if (p.getStock() < qty) throw new OutOfStockException();
        p.setStock(p.getStock() - qty);
        // At flush: UPDATE products SET stock=8, version=2 WHERE id=99 AND version=1
        //                                                         ↑ version mismatch?
        // If another thread updated stock between our load and flush:
        //   → Hibernate sees 0 rows updated → throws OptimisticLockException
        //   → @Retryable retries (re-reads fresh stock, tries again)
    }
}

// ✅ Pessimistic Locking — use when contention is HIGH (e.g., flash sale, ticket booking)
// SELECT FOR UPDATE: locks the row immediately; other transactions wait until we commit
@Service
public class TicketService {

    @Transactional
    public BookingResult bookTicket(Long eventId, Long userId) {
        // PESSIMISTIC_WRITE → SELECT * FROM events WHERE id=? FOR UPDATE
        Event event = eventRepository.findById(eventId, LockModeType.PESSIMISTIC_WRITE)
                                     .orElseThrow();
        if (event.getAvailableSeats() <= 0) {
            throw new SoldOutException("Event " + eventId + " is sold out");
        }
        event.setAvailableSeats(event.getAvailableSeats() - 1);  // safe — we hold the row lock
        Booking booking = new Booking(eventId, userId, LocalDateTime.now());
        bookingRepository.save(booking);
        return BookingResult.success(booking.getId());
    }  // ← COMMIT: lock released, next waiting transaction proceeds
}

// ✅ Repository helper for pessimistic lock:
public interface EventRepository extends JpaRepository<Event, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM Event e WHERE e.id = :id")
    Optional<Event> findByIdForUpdate(@Param("id") Long id);
}
```

## Ứng Dụng Thực Tế

Với tình huống đặt chỗ hoặc giảm tồn kho, pessimistic an toàn hơn khi contention cao (ngăn oversell mà không retry). Với cập nhật profile user có xác suất xung đột thấp, optimistic với retry có thể scale tốt hơn.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>JPA ném exception nào khi xung đột optimistic lock?</strong></summary>

**A:** JPA ném `javax.persistence.OptimisticLockException` (hoặc `jakarta.persistence.OptimisticLockException` trong Jakarta EE). Spring Data JPA wrap thành `ObjectOptimisticLockingFailureException`. Hibernate ném `StaleObjectStateException` nếu version không khớp. Client cần catch và **retry**: đọc lại entity mới nhất → reapply thay đổi → save lại. Annotation `@Retryable` từ Spring Retry tự động retry khi gặp `OptimisticLockingFailureException`.

</details>

<details>
<summary><strong>@Version hoạt động nội bộ thế nào?</strong></summary>

**A:** Hibernate tự quản lý `@Version` field (int/long/Timestamp). Khi UPDATE entity: generate `UPDATE entity SET ..., version=version+1 WHERE id=? AND version=?`. Nếu 0 rows affected: version không khớp (concurrent update xảy ra) → throw `OptimisticLockException`. Khi đọc entity: load version vào snapshot. Khi INSERT: version=0 (hoặc 0L cho long). Lưu ý: chỉ so sánh version của **entity root**, không theo dõi version của collection item.

</details>

<details>
<summary><strong>Khi nào pessimistic locking có thể gây deadlock?</strong></summary>

**A:** Deadlock xảy ra khi hai transaction lock theo **thứ tự ngược nhau**: T1 lock A → chờ B; T2 lock B → chờ A → circular wait. Ví dụ: T1 `SELECT FOR UPDATE` account A rồi B; T2 `SELECT FOR UPDATE` account B rồi A. Phòng tránh: (1) **Lock theo thứ tự cố định** — luôn lock account ID nhỏ trước lớn. (2) **Lock ít nhất có thể** — scope nhỏ nhất, transaction ngắn nhất. (3) **Lock timeout**: `@Lock(PESSIMISTIC_WRITE)` với timeout hint để không chờ mãi.

</details>
