---
key: "Distributed Lock"
title: "Distributed Lock"
crumb: "7. System Design"
---

Distributed lock đảm bảo chỉ một instance trong cluster thực thi critical section tại một thời điểm — ngăn race condition trong service được scale horizontally.

## Điểm Chính

- Use case: scheduled job chạy trên nhiều instance, giảm tồn kho, đặt chỗ.
- Redis <code>SETNX</code>: "SET if Not eXists" — atomic. Thêm TTL để ngăn deadlock nếu holder chết.
- <strong>Redlock</strong>: lock dựa trên quorum qua N Redis node cho fault tolerance cao hơn.
- Lease renewal: nếu critical section mất lâu hơn TTL, background thread phải renew.
- Thay thế: DB advisory lock (<code>pg_advisory_lock</code>), ZooKeeper, etcd.

## Ví Dụ Code

*Redisson RLock: inventory reservation với tryLock + watchdog; scheduled job dedup; Spring Integration alternative*

```java
// Distributed Lock: prevent race conditions when multiple instances run concurrently
// Use case: inventory decrement, scheduled job dedup, double-booking prevention

// Redisson RLock: implements Redlock algorithm with lease renewal (watchdog)
@Service @RequiredArgsConstructor
public class InventoryService {
    private final RedissonClient redisson;
    private final InventoryRepository inventoryRepo;

    public boolean reserveStock(String productId, int qty) {
        // Lock key scoped to product — allows concurrent locks on DIFFERENT products
        RLock lock = redisson.getLock("lock:inventory:" + productId);

        // tryLock(waitTime=5s, leaseTime=10s)
        // waitTime: how long to wait if lock is held by another instance
        // leaseTime: auto-release after 10s (prevents deadlock if holder crashes)
        // Redisson watchdog: auto-renews lease every 10s/3 while lock is held
        try {
            if (!lock.tryLock(5, 10, TimeUnit.SECONDS)) {
                log.warn("Could not acquire inventory lock: productId={}", productId);
                return false; // caller can retry
            }
            try {
                int available = inventoryRepo.getAvailableQty(productId);
                if (available < qty) {
                    throw new InsufficientStockException(productId, qty, available);
                }
                inventoryRepo.decrement(productId, qty);
                log.info("Reserved {} units of {}", qty, productId);
                return true;
            } finally {
                if (lock.isHeldByCurrentThread()) {
                    lock.unlock(); // always release in inner finally
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}

// Scheduled job deduplication: only one instance runs the job
@Scheduled(fixedDelay = 60_000)
public void processExpiredOrders() {
    RLock lock = redisson.getLock("lock:job:process-expired-orders");
    if (!lock.tryLock()) return; // another instance is running this job
    try {
        orderService.cancelExpiredOrders();
    } finally {
        if (lock.isHeldByCurrentThread()) lock.unlock();
    }
}

// Alternative: Spring Integration distributed lock with Redis
// @Bean LockRegistry lockRegistry(RedisConnectionFactory factory) {
//     return new RedisLockRegistry(factory, "spring-lock", 10_000L);
// }
```

## Ứng Dụng Thực Tế

Dùng Redisson cho distributed lock trong Spring Boot — nó implement Redlock đúng cách bao gồm lease renewal. Đừng bao giờ dùng <code>SETNX</code> thô từ code app — bạn sẽ làm sai TTL và renewal logic. Luôn unlock trong <code>finally</code>.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Vấn đề với dùng Redis SETNX đơn giản cho distributed lock là gì?</strong></summary>

**A:** Vấn đề: `SETNX key value` để set lock, `DEL key` để release — hai operation không atomic. Nếu process crash sau SETNX nhưng trước DEL → lock **never released** (deadlock). Fix: `SET key value NX EX 30` — set với TTL trong một atomic command. Nhưng vẫn có vấn đề: release sai lock của người khác nếu mình hold lock quá lâu và TTL expired trước khi release.

</details>

<details>
<summary><strong>Thuật toán Redlock là gì?</strong></summary>

**A:** Redlock (Antirez): acquire lock trên **N/2+1 independent Redis nodes** (thường 5) trong tổng thời gian nhỏ hơn TTL. Nếu không acquire đủ quorum trong thời gian → release tất cả và retry. Mục đích: tránh single point of failure. Tranh cãi: Martin Kleppmann chỉ ra Redlock không an toàn khi có GC pause hoặc clock skew — process nghĩ mình đang hold lock nhưng TTL đã expire. **Recommendation**: dùng Redlock + **fencing token** cho critical sections.

</details>

<details>
<summary><strong>Làm thế nào để ngăn deadlock với distributed lock nếu lock holder crash?</strong></summary>

**A:** (1) **TTL (Time-To-Live)**: lock tự expire sau khoảng thời gian cố định — nếu holder crash, lock tự release. Nhưng TTL phải đủ dài cho operation. (2) **Fencing token**: mỗi lần acquire lock nhận một monotonically increasing token; resource server reject request với token cũ hơn token hiện tại — ngăn stale lock holder tác động sau khi TTL hết. (3) **Heartbeat**: holder renew lock periodically; nếu heartbeat dừng → lock expire.

</details>
