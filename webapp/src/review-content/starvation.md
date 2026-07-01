---
key: "Starvation"
title: "Starvation"
crumb: "2. Concurrency"
---

Starvation xảy ra khi thread bị từ chối truy cập tài nguyên chia sẻ vĩnh viễn vì các thread khác (thường ưu tiên cao hơn) liên tục lấy trước.

## Điểm Chính

- Gây ra bởi unfair lock (non-fair <code>ReentrantLock</code>), lạm dụng thread priority hoặc độc chiếm CPU.
- Thread ưu tiên cao liên tục chiếm chỗ thread ưu tiên thấp trong scheduler của Java.
- Sửa: dùng fair lock: <code>new ReentrantLock(true)</code> — thứ tự FIFO.
- Fair lock có throughput thấp hơn — overhead context switch cho ordering.
- Liên quan đến livelock: thread đang hoạt động nhưng không tiến triển (ví dụ: mỗi thread nhường khi cái kia sẵn sàng).
- <code>Thread.yield()</code> gợi ý scheduler nhưng không đảm bảo fairness.

## Ví Dụ Code

*Starvation: fair vs unfair lock; Livelock: order processors yielding + exponential backoff fix*

```java
import java.util.concurrent.*;
import java.util.concurrent.locks.*;
import java.util.*;

// ---- Starvation: high-priority orders starve low-priority ones ----

public class OrderDispatcher {

    // Unfair lock (default): when lock is released, ANY waiting thread can acquire it
    // High-traffic "VIP" threads may win repeatedly → background threads starve
    private final ReentrantLock unfairLock = new ReentrantLock();          // default: fair=false
    private final ReentrantLock fairLock   = new ReentrantLock(true);      // FIFO ordering

    // Starvation demo: background report threads starve under VIP order burst
    public void processWithUnfairLock(boolean isVip) {
        unfairLock.lock();
        try {
            // VIP orders flood the lock → background threads wait indefinitely
            processOrder();
        } finally {
            unfairLock.unlock();
        }
    }

    // Fix: fair lock — threads acquire in the order they requested it
    public void processWithFairLock(boolean isVip) {
        fairLock.lock();   // FIFO: background threads no longer starved
        try {
            processOrder();
        } finally {
            fairLock.unlock();
        }
    }

    // ---- Livelock: two order processors yield to each other forever ----
    // Neither makes progress, but both are "active" (not blocked/waiting)
    public boolean tryFulfillOrderLivelock(OrderProcessor p1, OrderProcessor p2, Order order) {
        for (int attempt = 0; attempt < 100; attempt++) {
            if (p1.tryReserve(order)) {
                if (p2.tryReserve(order)) {
                    p1.fulfill(order);
                    p2.fulfill(order);
                    return true;
                }
                p1.release(order);   // release to let p2 try → p2 also releases → infinite courtesy
            }
            // Each processor keeps yielding when it sees the other is also trying
        }
        return false;  // livelock: 100 attempts, no progress
    }

    // Fix for livelock: exponential backoff with JITTER — breaks symmetry
    private final Random rng = new Random();

    public boolean tryFulfillOrderFixed(OrderProcessor p1, OrderProcessor p2, Order order)
            throws InterruptedException {
        int backoffMs = 10;
        for (int attempt = 0; attempt < 8; attempt++) {
            if (p1.tryReserve(order)) {
                if (p2.tryReserve(order)) {
                    p1.fulfill(order);
                    p2.fulfill(order);
                    return true;
                }
                p1.release(order);
            }
            // Jitter: randomize backoff so threads don't retry at exactly the same time
            int jitter = rng.nextInt(backoffMs);
            Thread.sleep(backoffMs + jitter);
            backoffMs = Math.min(backoffMs * 2, 1000);   // cap at 1s
        }
        return false;  // give up — caller retries at a higher level
    }
}
```

## Ứng Dụng Thực Tế

Trong thực tế, starvation hiếm trong hệ thống thiết kế tốt. Nó trở thành vấn đề trong priority queue khi item ưu tiên cao liên tục đến, hoặc trong code lock-heavy. Dùng thread pool với bounded queue và xem xét work-stealing pool (<code>ForkJoinPool</code>) cho cân bằng tải.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Thread starvation là gì và khác deadlock thế nào?</strong></summary>

**A:** **Starvation**: thread không thể tiến triển vì **liên tục không được cấp resource** (CPU, lock) — các thread khác với priority cao hơn liên tục chiếm. Thread vẫn alive, không bị block mãi, nhưng không được chạy đủ. **Deadlock**: hai hoặc nhiều thread **block nhau** — cả hai chờ resource của nhau → không ai tiến được. Cả hai đều gây progress failure, nhưng nguyên nhân khác: deadlock = circular wait; starvation = unfair scheduling. Phát hiện starvation: thread dump thấy thread ở WAITING/BLOCKED trong thời gian rất dài.

</details>

<details>
<summary><strong>Fair lock giải quyết starvation thế nào?</strong></summary>

**A:** `ReentrantLock(true)` — **fair lock**: acquire theo thứ tự FIFO — thread chờ lâu nhất được ưu tiên. Không có starvation. Unfair lock (default): không đảm bảo thứ tự — mỗi thread đến có thể "barge in" (chiếm lock ngay cả khi thread khác đang chờ) → starvation có thể xảy ra. Trade-off: fair lock slower throughput (không exploit thread locality, không barge-in) nhưng đảm bảo fairness. `synchronized` không fair. `Semaphore(permits, fair=true)` tương tự. Dùng fair lock khi: starvation là concern thực sự; unfair khi throughput quan trọng hơn fairness.

</details>

<details>
<summary><strong>Priority inversion là gì?</strong></summary>

**A:** **Priority inversion**: thread **priority thấp** giữ lock, thread **priority cao** phải chờ lock → effective priority của high-priority thread bị giảm xuống bằng low-priority. Tệ hơn: nếu medium-priority thread không cần lock cứ chiếm CPU → low-priority thread không chạy được → lock không release → high-priority thread chờ mãi. Classic case: Mars Pathfinder 1997 — reset liên tục vì priority inversion. Fix: **Priority inheritance** (OS feature) — low-priority thread giữ lock được tạm nâng priority bằng highest waiter. Java không built-in priority inheritance — dùng `Lock.tryLock(timeout)` để avoid indefinite wait.

</details>
