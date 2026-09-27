---
key: "ReentrantLock"
title: "ReentrantLock"
crumb: "6. Concurrency › Synchronization"
---

<code>ReentrantLock</code> là lock tường minh có ngữ nghĩa giống <code>synchronized</code> nhưng thêm <code>tryLock()</code>, timeout, interruptibility và fairness.

## Điểm Chính

- <code>tryLock()</code>: lấy lock mà không block — trả về false nếu không có.
- <code>tryLock(time, unit)</code>: lấy với timeout — tránh block vô thời hạn.
- <code>lockInterruptibly()</code>: lấy nhưng phản hồi thread interruption.
- Fairness: <code>new ReentrantLock(true)</code> — thread chờ lâu nhất được lock trước (throughput thấp hơn, giảm starvation). Javadoc lưu ý: fairness của lock không đảm bảo fairness của việc lập lịch thread, và <code>tryLock()</code> <em>không timeout</em> bỏ qua fairness — nó lấy lock ngay nếu đang rảnh dù có thread đang chờ.
- Giữ critical section ngắn: không gọi I/O (DB, HTTP, payment gateway) khi đang giữ lock.
- Phải giải phóng trong block <code>finally</code> — không tự giải phóng khi exception như synchronized.
- Đối tượng <code>Condition</code> (<code>lock.newCondition()</code>) thay thế wait/notify với nhiều condition mỗi lock.

## Ví Dụ Code

*ReentrantLock: tryLock timeout, lockInterruptibly, multiple Condition queues, fair lock*

```java
import java.util.concurrent.locks.*;
import java.util.concurrent.*;
import java.util.*;

// ---- ReentrantLock vs synchronized ----
// Use ReentrantLock when you need:
//   tryLock() — acquire without blocking (avoid deadlock)
//   tryLock(timeout) — timed acquisition
//   lockInterruptibly() — respond to Thread.interrupt()
//   Multiple Condition queues per lock
//   Fairness (FIFO ordering)

public class OrderCheckoutService {

    // Two separate Condition variables on ONE lock — impossible with synchronized
    private final ReentrantLock lock     = new ReentrantLock(true); // fair=true: FIFO
    private final Condition paymentReady = lock.newCondition();
    private final Condition inventoryOk  = lock.newCondition();

    // State trong bộ nhớ được lock bảo vệ
    private final Map<String, Integer> stockBySku = new HashMap<>();
    private final Set<Long> paidOrderIds          = new HashSet<>();

    // ---- tryLock with timeout: back off instead of waiting forever ----
    // Lock chỉ bảo vệ state trong bộ nhớ. KHÔNG gọi I/O (payment gateway, DB, HTTP)
    // khi đang giữ lock — mọi thread khác sẽ phải chờ theo độ trễ của mạng.
    public boolean markPaid(Order order, long timeoutMs) throws InterruptedException {
        if (!lock.tryLock(timeoutMs, TimeUnit.MILLISECONDS)) {
            return false;                  // caller retries or returns 503
        }
        try {
            paidOrderIds.add(order.getId());
            paymentReady.signalAll();      // wake threads waiting for payment only
            return true;
        } finally {
            lock.unlock();   // MUST be in finally — otherwise lock is held forever
        }
    }
    // Luồng đúng: gọi gateway NGOÀI lock, xong mới cập nhật state
    //   PaymentResult result = paymentGateway.charge(order);   // I/O, không giữ lock
    //   if (result.isSuccess()) markPaid(order, 200);

    // ---- lockInterruptibly: allow cancellation while waiting ----
    public void reserveInventory(Order order) throws InterruptedException {
        lock.lockInterruptibly();  // can be cancelled by Thread.interrupt()
        try {
            while (stockBySku.getOrDefault(order.getSku(), 0) < order.getQty()) {
                // await() releases the lock while waiting; woken by restock()
                inventoryOk.await(5, TimeUnit.SECONDS);
            }
            stockBySku.merge(order.getSku(), -order.getQty(), Integer::sum);
        } finally {
            lock.unlock();
        }
    }

    public void restock(String sku, int qty) {
        lock.lock();
        try {
            stockBySku.merge(sku, qty, Integer::sum);
            inventoryOk.signalAll();   // only threads waiting for stock are woken
        } finally {
            lock.unlock();
        }
    }

    public void waitForPayment(Order order) throws InterruptedException {
        lock.lock();
        try {
            while (!paidOrderIds.contains(order.getId())) {
                paymentReady.await();  // waits on paymentReady condition only
                // Other threads waiting on inventoryOk are NOT disturbed
            }
        } finally {
            lock.unlock();
        }
    }

    // ---- Fair lock for equal-priority checkout requests ----
    public int getQueueLength() {
        lock.lock();
        try {
            return lock.getQueueLength();  // ReentrantLock exposes this; synchronized does not
        } finally {
            lock.unlock();
        }
    }
}
```

## Ứng Dụng Thực Tế

Dùng ReentrantLock khi cần: timed lock để không chờ vô hạn, interruptible lock wait, nhiều condition queue mỗi lock, hoặc fairness. Nếu không, <code>synchronized</code> đơn giản hơn và JVM tối ưu tốt hơn.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>ReentrantLock có những ưu điểm gì so với synchronized?</strong></summary>

**A:** (1) **Timed tryLock**: `lock.tryLock(100, MILLISECONDS)` — tránh deadlock, có thể retry hoặc give up. (2) **Interruptible**: `lockInterruptibly()` — thread chờ lock có thể bị interrupt. (3) **Fairness**: `new ReentrantLock(true)` — FIFO ordering, tránh starvation (synchronized không đảm bảo fairness). (4) **Multiple Condition**: `lock.newCondition()` — có thể có nhiều wait set thay vì một như synchronized. (5) Trylock không block: test lock availability mà không chờ.

</details>

<details>
<summary><strong>Tại sao phải gọi unlock() trong finally block?</strong></summary>

**A:** Nếu code giữa `lock()` và `unlock()` throw exception, `unlock()` không được gọi → lock bị giữ mãi mãi → deadlock hoặc starvation. Pattern chuẩn: `lock.lock(); try { ... } finally { lock.unlock(); }`. Khác với synchronized — JVM tự release monitor khi exception thoát khỏi synchronized block. Với ReentrantLock, responsibility thuộc về developer. Lỗi này phổ biến và rất khó debug trong production.

</details>
