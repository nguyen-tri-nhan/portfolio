---
key: "synchronized keyword"
title: "Từ Khóa synchronized"
crumb: "2. Concurrency › Synchronization"
---

Từ khóa <code>synchronized</code> lấy intrinsic lock của object, đảm bảo mutual exclusion và thiết lập quan hệ happens-before cho memory visibility.

## Điểm Chính

- Reentrant: thread đang giữ lock có thể re-enter cùng synchronized block mà không tự deadlock.
- Synchronized block giải phóng lock khi có exception — an toàn khỏi việc giữ lock vĩnh cửu.
- Hiệu năng: biased locking (đường dẫn đơn thread nhanh) → lightweight lock (CAS) → heavyweight (OS mutex).
- Double-checked locking yêu cầu <code>volatile</code> trên field để hoạt động đúng (Java 5+).
- Đừng bao giờ synchronize trên literal <code>String</code> hoặc integer autoboxed — chúng có thể được intern/share.

## Ví Dụ Code

*synchronized: reentrant, block-scope, double-checked locking, holder pattern*

```java
import java.util.concurrent.*;

// ---- synchronized keyword: reentrant, visibility + mutual exclusion ----

// Pattern 1: synchronized instance method — guards 'this' object state
public class OrderIdGenerator {
    private long nextId = 1000L;

    // Reentrant: if allocateBatch() calls nextOrderId() internally, same thread
    // re-enters the monitor without deadlocking
    public synchronized long nextOrderId() {
        return nextId++;                   // read → increment → write — all atomic
    }

    public synchronized long[] allocateBatch(int count) {
        long[] ids = new long[count];
        for (int i = 0; i < count; i++) {
            ids[i] = nextOrderId();        // re-enters synchronized — safe (reentrant)
        }
        return ids;
    }
}

// Pattern 2: synchronized block with explicit lock object — finer granularity
public class PaymentGatewayRouter {
    private final Map<String, PaymentGateway> gateways = new HashMap<>();
    private final Object routingLock = new Object();

    public void registerGateway(String name, PaymentGateway gw) {
        synchronized (routingLock) {       // lock scope is minimal
            gateways.put(name, gw);
        }
        // Other work (logging, metrics) runs outside the lock
        metricsRegistry.recordGatewayRegistered(name);
    }

    public PaymentGateway getGateway(String name) {
        synchronized (routingLock) {
            return gateways.getOrDefault(name, defaultGateway);
        }
    }
}

// Pattern 3: Double-checked locking (lazy singleton with heavy init)
// WARNING: MUST use volatile — without it, partial construction is visible to other threads
public class OrderSearchIndex {
    private static volatile OrderSearchIndex INSTANCE;  // volatile required!

    private final List<String> index;

    private OrderSearchIndex() {
        // Expensive: load 50K product names into search index
        this.index = loadIndex();
    }

    public static OrderSearchIndex getInstance() {
        if (INSTANCE == null) {                    // first check — no lock (fast path)
            synchronized (OrderSearchIndex.class) {
                if (INSTANCE == null) {            // second check — under lock
                    INSTANCE = new OrderSearchIndex();
                    // volatile write establishes happens-before:
                    // fully constructed object visible to all threads reading INSTANCE
                }
            }
        }
        return INSTANCE;
    }
}

// Pattern 4 (PREFERRED): initialization-on-demand holder — simpler, no volatile needed
// JVM guarantees class initialization is thread-safe
public class PricingEngine {
    private PricingEngine() { /* heavy init */ }

    private static final class Holder {
        // Initialized once when Holder class is first accessed
        static final PricingEngine INSTANCE = new PricingEngine();
    }

    public static PricingEngine getInstance() { return Holder.INSTANCE; }
}
```

## Ứng Dụng Thực Tế

Trong Spring, singleton được container quản lý — bạn hiếm khi cần tự đồng bộ hóa cho khởi tạo. Dùng <code>volatile</code> cho field lazy-initialized ngoài ngữ cảnh Spring.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>synchronized method và synchronized block khác nhau thế nào?</strong></summary>

**A:** `synchronized method` lock trên `this` (instance method) hoặc `Class` object (static method) — lock toàn bộ method. `synchronized(lock) { ... }` lock trên object bất kỳ, chỉ bảo vệ critical section nhỏ → throughput cao hơn. Ưu tiên synchronized block: lock granularity nhỏ hơn, dễ kiểm soát lock object, tránh lock leak khi dùng return hoặc exception (try-with-resources tự unlock không dùng được với synchronized — dùng ReentrantLock).

</details>

<details>
<summary><strong>Reentrant lock là gì? synchronized có phải reentrant không?</strong></summary>

**A:** Reentrant: thread đang giữ lock có thể acquire cùng lock đó lại mà không bị deadlock — lock đếm số lần acquire. Java `synchronized` là reentrant — nếu `methodA()` synchronized gọi `methodB()` synchronized trên cùng object, không bị deadlock. `ReentrantLock` cũng reentrant và phải gọi `unlock()` đúng số lần `lock()`. Non-reentrant lock (hiếm) sẽ deadlock trong tình huống này.

</details>

<details>
<summary><strong>Tại sao wait() phải gọi trong while loop chứ không phải if?</strong></summary>

**A:** Spurious wakeup: thread có thể wake up từ `wait()` mà không có `notify()` — đây là behavior được phép bởi JVM spec và xảy ra trên một số OS. Nếu dùng `if`: check condition một lần, spurious wakeup → tiếp tục execute dù condition chưa đúng. Nếu dùng `while`: check lại condition sau wakeup → đúng mới tiếp tục. Pattern chuẩn: `while (!condition) { wait(); }` — đây là best practice bắt buộc.

</details>
