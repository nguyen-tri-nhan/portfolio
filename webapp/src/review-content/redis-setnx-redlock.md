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

1. Tại sao phải dùng Lua script để release Redis distributed lock?
1. Fencing token là gì và tại sao cần?
1. Tình huống thất bại nào mà Redlock KHÔNG bảo vệ chống lại?
