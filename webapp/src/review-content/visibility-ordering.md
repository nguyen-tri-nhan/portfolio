---
key: "visibility / ordering"
title: "Visibility & Ordering"
crumb: "6. Concurrency › Java Memory Model"
---

Visibility có nghĩa thread thấy giá trị mới nhất của biến chia sẻ; ordering có nghĩa thứ tự thao tác không bị sắp xếp lại bởi compiler/CPU theo cách phá vỡ logic concurrent.

## Điểm Chính

- <strong>Vấn đề visibility</strong>: thread B đọc biến thread A đã ghi, nhưng thấy giá trị cũ từ cache.
- <strong>Vấn đề ordering</strong>: CPU/compiler sắp xếp lại lệnh để tối ưu; thread khác thấy chúng theo thứ tự sai.
- <code>volatile</code> sửa visibility và hạn chế reordering xung quanh nó (chi tiết ở câu hỏi cuối bài).
- Lưu ý: "ghi thì flush ra main memory, đọc thì đọc từ main memory" là mô hình <em>đơn giản hóa</em> (JSR-133 FAQ cũng giải thích theo cách này). Spec (JLS chương 17) định nghĩa bằng happens-before. Trên phần cứng thật, cache CPU vốn được giữ đồng bộ (cache coherence); giá trị cũ thường đến từ JIT giữ biến trong register / đưa lệnh đọc ra ngoài vòng lặp, và từ store buffer + reordering của CPU.
- <code>synchronized</code> sửa cả hai: lock acquire/release tạo memory fence.
- Memory barrier: lệnh phần cứng ngăn reordering qua barrier.

## Ví Dụ Code

*Visibility: volatile prevents JIT loop hoisting; Ordering: memory fence via volatile*

```java
import java.util.concurrent.*;

// ============================================================
// VISIBILITY: a thread may cache a variable and never see updates
// ============================================================

// Bug: JIT compiler may hoist 'active' check OUTSIDE the loop → infinite loop!
// Đây là tối ưu của JIT, không phụ thuộc CPU — xảy ra được cả trên x86.
public class OrderWorkerBroken {
    private boolean active = true;   // NOT volatile

    public void run() {
        // JIT optimization: "active never changes inside the loop" → hoists to:
        //   boolean localActive = active;
        //   while (localActive) { ... }   ← infinite loop, never sees active=false
        while (active) {
            processNextOrder();
        }
    }
    public void stop() { active = false; }  // write may never reach the other thread's cache
}

// Fix: volatile forces fresh read from main memory on every loop iteration
public class OrderWorker {
    private volatile boolean active = true;

    public void run() {
        while (active) {              // volatile read: checks main memory each iteration
            processNextOrder();
        }
        System.out.println("Worker stopped cleanly");
    }
    public void stop() { active = false; }  // volatile write: immediately visible to all threads
}

// ============================================================
// ORDERING: CPU/compiler may reorder instructions across threads
// ============================================================

// Classic example: "store-store / load-load" reorder (possible on weak memory model CPUs)
public class OrderEventPublisher {
    private int    orderTotal = 0;
    private volatile boolean published = false;   // ONLY 'published' is volatile

    // Publisher thread:
    public void publish(int total) {
        orderTotal = total;    // (1) write to non-volatile field
        published  = true;     // (2) volatile WRITE creates a memory fence
        // JMM guarantee: (1) cannot be reordered after (2)
        // All writes before volatile write are visible after volatile read
    }

    // Subscriber thread:
    public void consume() {
        if (published) {       // (3) volatile READ: memory fence here too
            // (4) read non-volatile — safe because of hb: (1) hb (2) hb (3) hb (4)
            System.out.println("Order total: " + orderTotal);
        }
    }
}

// ---- Ordering hazard without volatile (BROKEN) ----
// Thread 1:  x = 1; r1 = y;   (may execute as: r1=y; x=1)
// Thread 2:  y = 1; r2 = x;   (may execute as: r2=x; y=1)
// Result: r1=0 and r2=0 both possible — kể cả trên x86: đây là reorder StoreLoad (load vượt lên
// trước store tới địa chỉ khác nhờ store buffer), loại reorder duy nhất x86 cho phép và cần
// barrier mfence / lệnh có tiền tố lock để chặn (JSR-133 Cookbook).
// Fix: volatile on x and y, or synchronized blocks on both reads and writes
```

## Ứng Dụng Thực Tế

Những vấn đề này tinh tế và phụ thuộc platform — x86 có memory model mạnh hơn ARM/POWER nên một số lỗi chỉ lộ ra trên ARM (ví dụ server Graviton, Apple Silicon), nhưng reorder StoreLoad và tối ưu của JIT xảy ra cả trên x86. Luôn dùng synchronization đúng thay vì dựa vào hành vi phần cứng.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Happens-before relationship là gì?</strong></summary>

**A:** Happens-before (HB) là **ordering guarantee** trong Java Memory Model: nếu action A HB action B → B sees effect của A — không bị reordering. HB rules: (1) Program order rule: statement trước HB statement sau trong cùng thread. (2) Monitor lock rule: unlock HB subsequent lock on same monitor. (3) Volatile rule: write to volatile HB subsequent read of same volatile. (4) Thread start rule: `Thread.start()` HB mọi action trong thread đó. (5) Thread join rule: mọi action trong thread HB return của `Thread.join()`. HB: nếu không có HB ordering → CPU/compiler có thể reorder → **visibility problem**.

</details>

<details>
<summary><strong>Tại sao double-checked locking cần volatile?</strong></summary>

**A:** DCL pattern cho singleton:
```java
private static volatile Singleton instance;
static Singleton getInstance() {
    if (instance == null) {
        synchronized (Singleton.class) {
            if (instance == null)
                instance = new Singleton();
        }
    }
    return instance;
}
```
**Tại sao volatile?** `instance = new Singleton()` là 3 bước: (1) alloc memory, (2) init object, (3) assign reference. Không volatile: JIT có thể reorder → assign reference trước khi init xong → thread khác thấy non-null instance nhưng object chưa init. `volatile` đảm bảo write complete trước khi visible. Java 5+: DCL với volatile là thread-safe.

</details>

<details>
<summary><strong>Instruction reordering gây vấn đề gì trong concurrent code?</strong></summary>

**A:** CPU và JIT compiler reorder instructions để optimize — safe trong single-thread (không thay đổi observable behavior), nhưng gây issue trong multi-thread. Ví dụ: Thread A: `data = 42; ready = true;` → compiler reorder → `ready = true; data = 42;`. Thread B: `if (ready) print(data);` → thấy `ready=true` nhưng `data` chưa được write → print uninitialized value. Fix: `volatile boolean ready` → establish happens-before, prohibit reorder. Hoặc `synchronized`. Chính xác hơn (JSR-133 Cookbook): lệnh ghi thường đứng **trước** một volatile write không được dời xuống sau nó; lệnh đọc/ghi thường đứng **sau** một volatile read không được dời lên trước nó. Chiều ngược lại vẫn được phép — một lệnh ghi thường đứng sau volatile write có thể bị dời lên trước. Vì vậy chỉ những gì ghi **trước** volatile write mới được đảm bảo hiển thị với thread đọc được giá trị volatile đó.

</details>
