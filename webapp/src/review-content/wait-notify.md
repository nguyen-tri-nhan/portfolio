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

1. Tại sao wait() phải được gọi bên trong synchronized block?
1. Spurious wakeup là gì và bạn xử lý nó như thế nào?
1. Sự khác biệt giữa notify() và notifyAll() là gì?
