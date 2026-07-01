---
key: "Redis SETNX / Redlock"
title: "Redis SETNX / Redlock"
crumb: "7. System Design › Distributed Lock"
---

SETNX (SET if Not eXists) là primitive atomic của Redis cho distributed locking đơn giản; Redlock mở rộng nó lên N Redis node độc lập cho fault-tolerant distributed consensus.

## Điểm Chính

- <code>SET key value NX EX seconds</code>: set-if-not-exists atomic với TTL. Thay thế cách tiếp cận hai lệnh cũ <code>SETNX</code>+<code>EXPIRE</code>.
- Single Redis: hoạt động cho hầu hết trường hợp. Rủi ro: Redis restart mất tất cả lock (AOF có thể giảm nhẹ).
- <strong>Redlock</strong>: acquire lock trên majority (N/2+1) của N Redis node độc lập. Fault-tolerant hơn.
- Phê bình (Martin Kleppmann): Redlock có thể thất bại với clock skew hoặc GC pause — cho an toàn thực sự, dùng fencing token.
- Fencing token: số tăng đơn điệu được bao gồm trong tất cả write, bị storage từ chối nếu quá cũ.

## Ví Dụ Code

*Lua atomic acquire/release với lockId; multi-resource lock pattern; Redlock vs fencing token trade-off*

```java
// Raw Redis lock with Lua (atomic acquire + release)
// Lua scripts execute atomically on Redis — no race between commands
@Service @RequiredArgsConstructor
public class RedisDistributedLock {
    private final RedisTemplate<String, String> redis;

    private static final String ACQUIRE_SCRIPT =
        "if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then " +
        "  return 1 " +
        "else " +
        "  return 0 " +
        "end";

    private static final String RELEASE_SCRIPT =
        "if redis.call('GET', KEYS[1]) == ARGV[1] then " +  // only release if we own it
        "  return redis.call('DEL', KEYS[1]) " +
        "else " +
        "  return 0 " +
        "end";

    public String tryAcquire(String resource, int ttlSeconds) {
        String lockId = UUID.randomUUID().toString(); // unique per lock attempt
        Long result = redis.execute(
            new DefaultRedisScript<>(ACQUIRE_SCRIPT, Long.class),
            List.of("lock:" + resource),  // KEYS[1]
            lockId,                        // ARGV[1] = lock owner ID
            String.valueOf(ttlSeconds)     // ARGV[2] = TTL
        );
        return (result != null && result == 1L) ? lockId : null; // null = lock not acquired
    }

    public boolean release(String resource, String lockId) {
        Long result = redis.execute(
            new DefaultRedisScript<>(RELEASE_SCRIPT, Long.class),
            List.of("lock:" + resource),
            lockId  // must match — prevents releasing another holder's lock
        );
        return result != null && result == 1L;
    }
}

// Usage
public void processPayment(String orderId, BigDecimal amount) {
    String lockId = redisLock.tryAcquire("payment:" + orderId, 30); // 30s TTL
    if (lockId == null) throw new LockNotAcquiredException("payment:" + orderId);
    try {
        paymentService.charge(orderId, amount);
    } finally {
        redisLock.release("payment:" + orderId, lockId); // Lua ensures atomic check+delete
    }
}

// Redlock (multi-node): acquire lock on majority (N/2+1) of N independent Redis nodes
// Protects against single Redis node failure
// In practice: use Redisson RLock which implements Redlock correctly
// Martin Kleppmann's critique: Redlock unsafe with clock skew / GC pause
// → for financial ops, add fencing token (monotonically increasing ID) to all writes
```

## Ứng Dụng Thực Tế

Dùng Redisson (<code>RLock</code>) trong production thay vì Lua script thô — nó xử lý TTL renewal (watchdog), release đúng và Redlock ngay trong hộp. Với yêu cầu an toàn cực cao (giao dịch tài chính), thêm fencing token ở phía resource.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>SETNX tại sao không đủ cho distributed lock?</strong></summary>

**A:** `SETNX key value` (Set if Not eXists) có vấn đề: không atomic với expiry. Pattern: `SETNX lock 1` rồi `EXPIRE lock 30` → nếu crash giữa hai lệnh → lock không có expiry → **deadlock permanent**. Fix bằng Redis 2.6+: `SET key value NX EX 30` — atomic set-with-expiry. Nhưng vẫn còn vấn đề: (1) Lock expire quá sớm khi task chạy lâu → hai client cùng có lock. (2) Client A expire → Client B lấy lock → Client A xong DELETE key của B (sai owner). Fix: value = unique token, chỉ delete nếu value match.

</details>

<details>
<summary><strong>Redlock algorithm hoạt động thế nào?</strong></summary>

**A:** Redlock (Redis Distributed Lock) của Antirez — dùng **N independent Redis nodes** (khuyến nghị 5): (1) Client ghi timestamp `T1`. (2) Thử acquire lock trên **tất cả N nodes** tuần tự với timeout nhỏ. (3) Lock acquired nếu ≥ `⌊N/2⌋ + 1` nodes thành công (quorum). (4) Validity time = TTL - (T_now - T1) - clock drift. (5) Nếu không đủ quorum: release lock trên tất cả nodes. Đảm bảo: ngay cả khi minority nodes fail, lock vẫn đúng. Vẫn có tranh cãi (Martin Kleppmann): clock drift và GC pause có thể vi phạm safety. Dùng cho: non-critical distributed coordination.

</details>

<details>
<summary><strong>Khi nào dùng Redis lock thay vì database lock?</strong></summary>

**A:** **Redis lock**: low latency (~1ms), không liên quan đến DB transaction, phù hợp cross-service coordination, distributed job scheduling (chỉ một instance chạy cron). **Database lock** (`SELECT FOR UPDATE`): strong consistency (ACID), tự động release khi transaction end (không cần manage expiry), phù hợp khi operation thực sự phải modify DB atomically. Chọn Redis: idempotent operations, performance critical, rate limiting, cache update coordination. Chọn DB lock: money transfer, inventory update — cần transaction guarantee cùng DB.

</details>
