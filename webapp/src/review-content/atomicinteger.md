---
key: "AtomicInteger"
title: "AtomicInteger"
crumb: "2. Concurrency › Atomic Classes"
---

<code>AtomicInteger</code> bọc giá trị <code>int</code> và cung cấp thao tác atomic lock-free qua CAS, an toàn cho concurrent increment/decrement mà không cần synchronization.

## Điểm Chính

- <code>incrementAndGet()</code>: tăng và trả về giá trị mới. <code>getAndIncrement()</code>: trả về cũ, rồi tăng.
- <code>compareAndSet(expected, update)</code>: cập nhật atomic nếu hiện tại == expected.
- <code>updateAndGet(fn)</code> / <code>accumulateAndGet(x, fn)</code>: áp dụng function atomic (Java 8+).
- Được hỗ trợ bởi CAS của <code>sun.misc.Unsafe</code> — gọi trực tiếp lệnh CPU atomic.
- Non-blocking: thread không sleep khi thất bại, chúng retry — tốt cho low-contention, kém cho high.

## Ví Dụ Code

*AtomicInteger: getAndDecrement, CAS reserve loop, updateAndGet, state machine*

```java
import java.util.concurrent.atomic.*;

// ---- AtomicInteger patterns in a Payment / Inventory system ----

public class InventoryManager {
    // Tracks available stock atomically — concurrent orders can read/update
    private final AtomicInteger availableStock;

    public InventoryManager(int initialStock) {
        this.availableStock = new AtomicInteger(initialStock);
    }

    // Pattern 1: simple decrement and return old value
    public int reserveOne() {
        return availableStock.getAndDecrement();   // returns value BEFORE decrement
        // Caller checks: if returned value <= 0, stock was already empty
    }

    // Pattern 2: CAS loop — reserve N units only if enough stock available
    // Cannot use simple addAndGet(-qty) — need to check precondition atomically
    public boolean reserve(int qty) {
        int current, updated;
        do {
            current = availableStock.get();
            if (current < qty) return false;   // not enough stock — no update needed
            updated = current - qty;
        } while (!availableStock.compareAndSet(current, updated));
        // compareAndSet fails if another thread changed 'current' between get() and CAS
        // Loop retries with fresh 'current' → eventually one thread wins
        return true;
    }

    // Pattern 3: updateAndGet with lambda — cap stock to warehouse maximum
    public void restock(int qty, int maxCapacity) {
        int added = availableStock.updateAndGet(cur -> Math.min(cur + qty, maxCapacity));
        System.out.printf("Restocked to: %d (max: %d)%n", added, maxCapacity);
    }

    // Pattern 4: accumulateAndGet — more flexible than updateAndGet
    // Takes current value AND external value, applies BiIntUnaryOperator atomically
    public void adjustByPercent(int percent) {
        availableStock.accumulateAndGet(percent,
            (current, pct) -> (int)(current * (1.0 + pct / 100.0)));
    }

    // Pattern 5: compareAndSet for state machine (PENDING → RESERVED)
    // 0=AVAILABLE, 1=RESERVED — single slot reservation gate
    private final AtomicInteger reservationLock = new AtomicInteger(0);

    public boolean tryReserveSlot() {
        return reservationLock.compareAndSet(0, 1);  // only ONE thread succeeds
    }
    public void releaseSlot() {
        reservationLock.set(0);
    }
}
```

## Ứng Dụng Thực Tế

Dùng AtomicInteger cho sequence generator, rate counter và connection pool sizing. Với throughput rất cao (hàng triệu op/giây), benchmark LongAdder — nó chia ghi trên nhiều cell để giảm CAS contention.

## Câu Hỏi Phỏng Vấn

1. getAndIncrement() đảm bảo atomicity bằng cách nào?
1. Sự khác biệt giữa updateAndGet và accumulateAndGet là gì?
1. Trong tình huống nào AtomicInteger hoạt động kém hơn synchronized?
