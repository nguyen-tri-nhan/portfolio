---
key: "wait / notify"
title: "wait / notify"
crumb: "2. Concurrency › Synchronization"
---

<code>Object.wait()</code> giải phóng lock và treo thread; <code>notify()</code>/<code>notifyAll()</code> đánh thức thread đang chờ — cùng nhau chúng implement phối hợp producer-consumer.

## Điểm Chính

- Phải được gọi bên trong block <code>synchronized</code> trên cùng object, nếu không ném <code>IllegalMonitorStateException</code>.
- <code>wait()</code> nguyên tử giải phóng lock và treo — quan trọng để tránh bỏ lỡ notification.
- <code>notify()</code> đánh thức một thread chờ tùy ý; <code>notifyAll()</code> đánh thức tất cả.
- Luôn dùng <code>wait()</code> trong vòng lặp <code>while</code> (không dùng <code>if</code>) để bảo vệ khỏi spurious wakeup.
- Ưu tiên <code>BlockingQueue</code>, <code>Condition</code> hoặc <code>CountDownLatch</code> thay vì wait/notify thô trong code hiện đại.

## Ví Dụ Code

*wait/notifyAll: OrderProcessingBuffer với while loop, spurious wakeup, interrupt handling*

```java
import java.util.*;

// ---- wait/notify: low-level producer-consumer for Order processing queue ----
// Modern code should use BlockingQueue, but interviews WILL ask about this.

public class OrderProcessingBuffer {
    private final Queue<Order> queue = new LinkedList<>();
    private final int capacity;
    private volatile boolean shutdown = false;

    public OrderProcessingBuffer(int capacity) {
        this.capacity = capacity;
    }

    // PRODUCER: called by HTTP handler threads accepting new orders
    public synchronized void submit(Order order) throws InterruptedException {
        // MUST use while loop (not if) — guards against SPURIOUS WAKEUP
        // Spurious wakeup: thread woken without notify() — while re-checks condition
        while (queue.size() >= capacity && !shutdown) {
            wait();     // atomically releases monitor AND suspends thread
        }
        if (shutdown) throw new IllegalStateException("Buffer is shut down");
        queue.add(order);
        notifyAll();    // wake ALL waiting threads — they re-check their condition
        // (notifyAll preferred over notify: notify may wake wrong thread)
    }

    // CONSUMER: called by worker threads pulling orders to process
    public synchronized Order take() throws InterruptedException {
        while (queue.isEmpty() && !shutdown) {
            wait();     // releases monitor; re-acquires it when notified
        }
        if (queue.isEmpty()) return null;  // shutdown with empty queue
        Order order = queue.poll();
        notifyAll();    // wake producers that may be waiting on capacity
        return order;
    }

    // Shutdown signal — wakes all waiting threads
    public synchronized void shutdown() {
        this.shutdown = true;
        notifyAll();    // all blocked threads will see shutdown=true and exit
    }

    // ---- Correct interrupt handling pattern ----
    public void workerLoop() {
        while (!Thread.currentThread().isInterrupted()) {
            try {
                Order order = take();
                if (order == null) break;    // shutdown
                processOrder(order);
            } catch (InterruptedException e) {
                // DO NOT swallow! Restore the flag so the caller can check it.
                Thread.currentThread().interrupt();
                break;
            }
        }
    }
}

// ---- In production, use BlockingQueue instead ----
// LinkedBlockingQueue<Order> queue = new LinkedBlockingQueue<>(100);
// Producer: queue.put(order);    // blocks when full — same semantics, safer
// Consumer: Order o = queue.take(); // blocks when empty
```

## Ứng Dụng Thực Tế

Trong thực tế, thay pattern này bằng <code>LinkedBlockingQueue</code> xử lý toàn bộ synchronization nội bộ. Hiểu wait/notify quan trọng cho phỏng vấn nhưng tránh dùng trong production code.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>wait() và sleep() khác nhau thế nào?</strong></summary>

**A:** **`Thread.sleep(ms)`**: thread ngủ một khoảng thời gian, **giữ lock** — thread khác không access synchronized block được. Dùng cho delay/timing. **`Object.wait()`**: thread ngủ và **release lock** — thread khác có thể enter synchronized block. Phải call trong synchronized block (sinon `IllegalMonitorStateException`). Wait thường kết hợp với condition check + notify. `wait()` có thể return sớm hơn (spurious wakeup) → luôn check condition trong `while` loop:
```java
synchronized(lock) {
    while (!condition) lock.wait();
    // proceed
}
```

</details>

<details>
<summary><strong>notify() và notifyAll() khác nhau thế nào?</strong></summary>

**A:** **`notify()`**: wake up **một** thread đang wait trên object này — JVM chọn arbitrary. **`notifyAll()`**: wake up **tất cả** threads đang wait — tất cả wake up, compete lại cho lock, chỉ một win. Khi nào dùng notifyAll: (1) Nhiều loại condition khác nhau — producer/consumer có thể có producer wait và consumer wait khác nhau. `notify()` có thể wake up wrong thread. (2) Không chắc chắn ai cần được wake — safe default. notifyAll chậm hơn (wake nhiều thread, thrashing) nhưng correct hơn. Với `Condition` (ReentrantLock): `condition.signal()` và `condition.signalAll()` — có thể có **multiple conditions per lock**.

</details>

<details>
<summary><strong>Spurious wakeup là gì và tại sao phải dùng while loop?</strong></summary>

**A:** **Spurious wakeup**: `wait()` return mà không bị `notify()`/`notifyAll()` gọi — do OS/hardware interrupt. POSIX spec explicitly allow this. Nếu dùng `if (!condition) wait()`: sau spurious wakeup → condition vẫn false → code tiếp tục với wrong state. **Giải pháp**: luôn dùng `while`:
```java
while (!condition) {
    object.wait();
}
```
Sau mỗi wakeup (spurious hay real): re-check condition → nếu false → wait lại. Pattern đúng 100% theo Java docs và concurrency best practices. `Condition.await()` cũng có spurious wakeup — same rule.

</details>
