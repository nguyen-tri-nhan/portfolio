---
key: "happens-before"
title: "happens-before"
crumb: "2. Concurrency › Java Memory Model"
---

happens-before là đảm bảo JMM rằng nếu action A happens-before B, thì ghi của A hiển thị với B và B thấy tất cả hiệu ứng của A.

## Điểm Chính

- Quy tắc: thứ tự chương trình (trong thread), monitor release→acquire, volatile write→read, thread start→action đầu tiên trong thread mới, join→caller thấy action của thread.
- Bắc cầu: nếu A hb B và B hb C, thì A hb C.
- KHÔNG có nghĩa A thực thi trước B theo thời gian thực — chỉ về memory visibility.
- Không có hb, JVM có thể cache đọc, sắp xếp lại ghi, làm thay đổi vô hình với thread khác.

## Ví Dụ Code

*happens-before rules: synchronized, volatile, Thread.start, join, CountDownLatch*

```java
import java.util.concurrent.*;

// ---- happens-before (hb) rules in JMM ----
// If A hb B: all writes done by A are visible to B, in program order.
// hb is TRANSITIVE: A hb B and B hb C → A hb C

// ---- Rule 1: Program Order — within a single thread ----
// All statements in a thread are hb the next statement in that thread.
// (applies only within ONE thread; no cross-thread guarantee without sync)

// ---- Rule 2: Monitor unlock hb lock (synchronized) ----
public class OrderStatusTracker {
    private OrderStatus status = OrderStatus.PENDING;
    private String lastUpdatedBy;

    // synchronized unlock of setStatus hb lock of getStatus
    // → getStatus always sees the latest write from setStatus
    public synchronized void setStatus(OrderStatus s, String updatedBy) {
        this.status        = s;
        this.lastUpdatedBy = updatedBy;
    }

    public synchronized OrderStatus getStatus() {
        return status;   // guaranteed to see latest value written by setStatus
    }
}

// ---- Rule 3: volatile write hb volatile read ----
public class OrderReadinessGate {
    private volatile boolean initialized = false;
    private Order            bootstrapOrder;         // NOT volatile — piggybacks on volatile

    // Setup thread:
    public void initialize(Order order) {
        this.bootstrapOrder = order;   // write to non-volatile field
        this.initialized    = true;    // volatile WRITE: all previous writes hb this
    }

    // Worker threads:
    public Order waitAndGet() throws InterruptedException {
        while (!initialized) Thread.sleep(1);  // volatile READ
        // hb chain: initialize()'s bootstrapOrder write hb volatile write hb this volatile read
        // → bootstrapOrder is guaranteed visible here
        return bootstrapOrder;
    }
}

// ---- Rule 4: Thread.start() hb all actions in the new thread ----
public class OrderStartupDemo {
    private Order preloadedOrder;

    public void run() throws InterruptedException {
        preloadedOrder = loadOrder();  // write before start()

        Thread worker = new Thread(() -> {
            // Thread.start() hb first action here
            // → worker sees preloadedOrder fully initialized (no volatile needed)
            processOrder(preloadedOrder);
        });
        worker.start();  // start() establishes hb
    }
}

// ---- Rule 5: Thread.join() hb actions after join() in caller ----
public class OrderBatchRunner {
    private List<Order> processedOrders = new ArrayList<>();

    public void runBatch() throws InterruptedException {
        Thread processor = new Thread(() -> {
            processedOrders.add(processOrder());  // writes to list
        });
        processor.start();
        processor.join();   // join() establishes hb: all writes inside thread hb code after join()
        // Safe to read processedOrders here — no volatile or sync needed
        System.out.println("Processed: " + processedOrders.size());
    }
}

// ---- Rule 6: CountDownLatch.await hb after countDown (transitivity) ----
public class OrderPipelineSync {
    private final CountDownLatch ready = new CountDownLatch(1);
    private volatile OrderPipeline pipeline;

    public void setup() {
        pipeline = new OrderPipeline();
        ready.countDown();  // countDown hb all await() returns
    }

    public void use() throws InterruptedException {
        ready.await();      // blocks until setup() calls countDown()
        pipeline.process(); // safe — hb guarantees pipeline is fully visible
    }
}
```

## Ứng Dụng Thực Tế

Khái niệm này là nền tảng lý thuyết của toàn bộ Java concurrency. Khi giải thích tại sao cần <code>synchronized</code> hoặc <code>volatile</code>, hãy tham chiếu happens-before. Nó giải thích tại sao lock hoạt động, tại sao double-checked locking cần volatile và tại sao đọc ConcurrentHashMap an toàn.

## Câu Hỏi Phỏng Vấn

1. Liệt kê các quy tắc happens-before trong JMM.
1. synchronized có cung cấp happens-before không? Giải thích.
1. Có happens-before giữa hai thread không đồng bộ hóa không?
