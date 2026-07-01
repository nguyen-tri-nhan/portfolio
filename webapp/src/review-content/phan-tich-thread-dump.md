---
key: "Phân tích Thread Dump"
title: "Phân Tích Thread Dump"
crumb: "1. Core Java › Performance Tuning"
---

Thread dump hiển thị tất cả thread trong JVM với trạng thái hiện tại và stack trace. Công cụ chính để chẩn đoán CPU spike, deadlock, và latency chậm do lock contention.

## Điểm Chính

- <strong>RUNNABLE</strong>: thread đang chạy Java code hoặc chờ OS (có thể đang I/O hoặc bị OS scheduling).
- <strong>BLOCKED</strong>: đang chờ acquire Java monitor lock đang bị thread khác giữ — lock contention.
- <strong>WAITING</strong>: chờ vô thời hạn trên <code>Object.wait()</code>, <code>LockSupport.park()</code>, <code>Thread.join()</code>.
- <strong>TIMED_WAITING</strong>: tương tự nhưng có timeout — <code>Thread.sleep()</code>, <code>wait(timeout)</code>.
- Chẩn đoán CPU cao: tương quan thread ID của JVM với OS thread ID qua <code>top -H</code> → convert TID sang hex.
- Deadlock: <code>jstack</code> tự báo cáo "Found one Java-level deadlock" kèm thông tin chi tiết.

## Ví Dụ Code

*Chẩn đoán CPU cao và phát hiện deadlock*

```bash
# Bước 1: tìm OS thread nào đang ngốn CPU
top -H -p 12345
# Ghi lại PID của thread nóng, ví dụ 12350

# Bước 2: chuyển PID sang hex (JVM dùng hex cho nid)
printf '%x
' 12350   # → 303e

# Bước 3: tìm trong thread dump
jstack 12345 | grep -A 30 "nid=0x303e"
# Output:
# "http-nio-8080-exec-5" #42 daemon prio=5 tid=... nid=0x303e runnable
#    java.lang.Thread.State: RUNNABLE
#    at com.example.OrderService.calculateDiscount(OrderService.java:87)

# Deadlock trong jstack output:
# Found one Java-level deadlock:
# "Thread-1": waiting to lock <0x000...> held by "Thread-2"
# "Thread-2": waiting to lock <0x000...> held by "Thread-1"

# Nhiều thread BLOCKED — tìm thread giữ lock gây tắc
jstack 12345 | grep -A 5 "BLOCKED"
# "- waiting to lock <0xabc> (owned by "Thread-pool-1-exec-1")"
# → Thread-pool-1-exec-1 là bottleneck — xem nó đang làm gì
```

## Ứng Dụng Thực Tế

Khi thấy CPU cao: 1) <code>top -H</code> tìm thread nóng, 2) convert TID sang hex, 3) grep thread dump. Khi response chậm mà CPU bình thường: tìm thread BLOCKED. Hầu hết "CPU spike" trong Java thực ra là GC pressure (kiểm tra <code>jstat -gcutil</code>) hoặc vòng lặp dày trong business logic. I/O mạng/DB thấy là RUNNABLE với native I/O trong stack trace.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tương quan thread OS CPU cao với Java stack trace thế nào?</strong></summary>

**A:** (1) `top -H -p <java_pid>` → thấy TID (Linux thread ID, decimal) ngốn CPU cao. (2) Convert decimal → hex: TID 12345 → 0x3039. (3) `jstack <java_pid> | grep -B 1 "nid=0x3039" -A 30` → tìm Java thread với `nid=0x3039` (native id). (4) Xem stack trace của thread đó — top frame là code đang chạy. Thường thấy: vòng lặp trong business logic, CAS spin loop, GC thread. Shortcut: `kill -3 <pid>` print thread dump vào stdout.

</details>

<details>
<summary><strong>BLOCKED trong thread dump có nghĩa gì?</strong></summary>

**A:** Thread ở trạng thái **BLOCKED**: đang chờ **monitor lock** (synchronized block/method) đang bị giữ bởi thread khác. Thread dump hiện: `- waiting to lock <0x12345> (a com.example.Foo)` → lock object. Tìm thread đang giữ lock đó: `- locked <0x12345>`. Nhiều thread BLOCKED trên cùng lock → contention. Khác với WAITING (chờ condition/timeout không liên quan đến lock). BLOCKED + nhiều thread = potential deadlock hoặc lock contention bottleneck.

</details>

<details>
<summary><strong>Xác nhận deadlock từ thread dump thế nào?</strong></summary>

**A:** Thread dump tự động detect deadlock và print ở cuối: `Found one Java-level deadlock:`. Xem manual: (1) Tìm tất cả thread BLOCKED. (2) Với mỗi thread, xem `waiting to lock <addr>`. (3) Tìm thread đang giữ `<addr>` đó (grep "locked <addr>"). (4) Check thread đó có đang chờ lock khác không. Nếu có cycle → deadlock. Ví dụ: Thread A giữ lock 1 chờ lock 2; Thread B giữ lock 2 chờ lock 1 → deadlock. Fix: lock theo thứ tự cố định.

</details>
