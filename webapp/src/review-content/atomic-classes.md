---
key: "Atomic Classes"
title: "Atomic Classes"
crumb: "2. Concurrency"
---

Package <code>java.util.concurrent.atomic</code> của Java cung cấp các kiểu nguyên thủy thread-safe lock-free sử dụng lệnh phần cứng Compare-And-Swap (CAS).

## Điểm Chính

- <code>AtomicInteger</code>, <code>AtomicLong</code>, <code>AtomicBoolean</code>, <code>AtomicReference</code>.
- Thao tác: <code>get()</code>, <code>set()</code>, <code>getAndIncrement()</code>, <code>compareAndSet(expect,update)</code>.
- CAS: "đặt giá trị mới chỉ khi giá trị hiện tại == expected" — một lệnh phần cứng, không lock.
- <code>LongAdder</code> / <code>LongAccumulator</code>: throughput cao hơn <code>AtomicLong</code> khi contention cao (chia nhỏ nội bộ).
- ABA problem: CAS thấy cùng giá trị nhưng nó đã thay đổi rồi thay đổi lại — giải quyết bằng <code>AtomicStampedReference</code>.

## Ví Dụ Code

*Atomic classes: sequence generator, revenue accumulator, CAS cart update, LongAdder metrics*

```java
import java.util.concurrent.atomic.*;
import java.math.BigDecimal;

// ---- Atomic classes in Order / Payment domain ----

// Use case 1: AtomicInteger — order sequence generator (no sync overhead)
public class OrderSequenceGenerator {
    private final AtomicInteger sequence = new AtomicInteger(10_000);

    public String nextOrderNumber() {
        int seq = sequence.incrementAndGet();   // atomic: read→+1→write as one CPU op
        return String.format("ORD-%06d", seq);  // "ORD-010001"
    }
}

// Use case 2: AtomicLong — concurrent revenue accumulator
public class RevenueAccumulator {
    private final AtomicLong totalRevenueCents = new AtomicLong(0);
    private final AtomicLong orderCount        = new AtomicLong(0);

    public void recordSale(long amountCents) {
        totalRevenueCents.addAndGet(amountCents);  // atomic add
        orderCount.incrementAndGet();
    }

    public BigDecimal getAverageOrderValue() {
        long count = orderCount.get();
        if (count == 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf(totalRevenueCents.get())
                         .divide(BigDecimal.valueOf(count), 2, java.math.RoundingMode.HALF_UP)
                         .divide(BigDecimal.valueOf(100));   // cents → dollars
    }
}

// Use case 3: AtomicReference — lock-free cart state update
public class ShoppingCart {
    // Immutable snapshot — replaced atomically on each update
    private final AtomicReference<CartSnapshot> snapshot;

    public ShoppingCart(String customerId) {
        this.snapshot = new AtomicReference<>(CartSnapshot.empty(customerId));
    }

    // CAS loop: optimistic update — no lock, but retry if another thread updated first
    public void addItem(OrderItem item) {
        CartSnapshot current, updated;
        do {
            current = snapshot.get();
            updated = current.withItem(item);    // creates new immutable snapshot
        } while (!snapshot.compareAndSet(current, updated));
        // If compareAndSet fails: another thread modified cart between get() and CAS
        // Retry with the fresh 'current' — eventually one attempt will win
    }

    public CartSnapshot getSnapshot() { return snapshot.get(); }
}

// Use case 4: LongAdder — high-throughput metrics counter
public class ApiMetrics {
    // LongAdder: internally uses per-thread cells to reduce CAS contention
    // Faster than AtomicLong when many threads increment simultaneously
    private final LongAdder requestCount = new LongAdder();
    private final LongAdder errorCount   = new LongAdder();

    public void recordRequest() { requestCount.increment(); }
    public void recordError()   { errorCount.increment(); }

    // sum() aggregates all cells — slightly stale under concurrent updates (OK for metrics)
    public void report() {
        System.out.printf("Requests: %d  Errors: %d  Error rate: %.2f%%%n",
            requestCount.sum(), errorCount.sum(),
            errorCount.sum() * 100.0 / Math.max(requestCount.sum(), 1));
    }
}
```

## Ứng Dụng Thực Tế

Dùng <code>LongAdder</code> cho metrics counter (request count, error count) khi concurrency cao — nhanh hơn <code>AtomicLong</code> khi nhiều thread ghi đồng thời. Dùng <code>AtomicReference</code> cho đầu linked list/stack lock-free.

## Câu Hỏi Phỏng Vấn

1. Compare-And-Swap là gì và hoạt động thế nào?
1. Khi nào bạn chọn LongAdder thay vì AtomicLong?
1. ABA problem là gì và bạn giải quyết nó thế nào?
