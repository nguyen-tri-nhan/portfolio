---
key: "Race Condition"
title: "Race Condition"
crumb: "2. Concurrency"
---

Race condition xảy ra khi tính đúng đắn của chương trình phụ thuộc vào thời điểm tương đối của các thread, dẫn đến bug không xác định khó tái tạo.

## Điểm Chính

- Ví dụ điển hình: <code>if(map.containsKey(k)) map.get(k)</code> — key có thể bị xóa giữa check và get.
- Check-then-act và read-modify-write là hai pattern race condition.
- Sửa: dùng atomic operation (<code>computeIfAbsent</code>), synchronization hoặc dữ liệu bất biến.
- Race condition không phải lúc nào cũng gây crash — thường chỉ là data corruption im lặng.
- Công cụ: Thread Sanitizer (C++), Java race detector (hạn chế), stress test với nhiều thread.

## Ví Dụ Code

*Race conditions: check-then-act (coupon), read-modify-write (stock), JPA @Version*

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

// ---- Race Condition Pattern 1: Check-Then-Act ----
// Bug: two threads check if coupon unused at the same time → both see unused → both redeem

public class CouponService {

    // BAD: non-atomic check-then-act — two threads can redeem the same coupon
    private final Map<String, Boolean> usedCoupons = new HashMap<>(); // NOT thread-safe!

    public boolean redeemCouponBad(String couponCode, String orderId) {
        if (!usedCoupons.containsKey(couponCode)) {  // Thread 1 AND Thread 2 both pass this
            usedCoupons.put(couponCode, true);        // BOTH put — coupon used twice!
            applyDiscount(orderId);
            return true;
        }
        return false;
    }

    // FIXED: ConcurrentHashMap.putIfAbsent — atomic check-then-put
    private final ConcurrentHashMap<String, String> redeemedCoupons = new ConcurrentHashMap<>();

    public boolean redeemCouponFixed(String couponCode, String orderId) {
        // putIfAbsent is atomic: only ONE thread can set the value for a given key
        String previous = redeemedCoupons.putIfAbsent(couponCode, orderId);
        if (previous == null) {
            applyDiscount(orderId);   // we won the race — we set it
            return true;
        }
        return false;  // another thread already redeemed this coupon
    }
}

// ---- Race Condition Pattern 2: Read-Modify-Write ----
// Bug: two threads read same stock count, both decrement, both write → oversell

public class InventoryService {

    // BAD: non-atomic decrement — race between read and write
    private int stockCount = 100;

    public boolean reserveBad() {
        if (stockCount > 0) {           // Thread 1 and Thread 2 both pass check
            stockCount--;               // Thread 1: 100→99, Thread 2 also writes 100→99
            return true;               // But we sold 2 units, stock only decremented by 1!
        }
        return false;
    }

    // FIXED with AtomicInteger CAS loop: atomic decrement-if-positive
    private final AtomicInteger stock = new AtomicInteger(100);

    public boolean reserveFixed() {
        int current, updated;
        do {
            current = stock.get();
            if (current <= 0) return false;
            updated = current - 1;
        } while (!stock.compareAndSet(current, updated));
        // Only ONE thread succeeds the CAS at any moment
        return true;
    }

    // ---- Race Condition Pattern 3: JPA Optimistic Locking ----
    // Two users update the same product's stock via HTTP at the same time
    // @Version field: each update reads version, DB rejects stale writes
}

@Entity
public class Product {
    @Id Long id;
    int stockQty;

    @Version                    // Hibernate increments this on every UPDATE
    Long version;               // if version mismatch → OptimisticLockException → retry
}
```

## Ứng Dụng Thực Tế

Dùng atomic operation của ConcurrentHashMap (<code>compute</code>, <code>merge</code>, <code>computeIfAbsent</code>) thay vì cặp get/put riêng biệt. Với JPA, dùng optimistic locking (<code>@Version</code>) để phát hiện concurrent update.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa race condition và data race là gì?
1. Đưa ví dụ về check-then-act race condition.
1. Optimistic locking trong JPA ngăn race condition như thế nào?
