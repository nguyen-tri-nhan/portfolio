---
key: "Performance Tuning"
title: "Tuning Hiệu Năng JVM"
crumb: "1. Core Java"
---

Tuning hiệu năng là xác định đúng bottleneck (CPU, bộ nhớ, I/O, lock) bằng công cụ profiling, rồi áp dụng fix chính xác. Không bao giờ optimize mà không đo trước.

## Điểm Chính

- <strong>Đo trước, optimize sau</strong>: hầu hết vấn đề hiệu năng nằm ở query DB, không phải code Java.
- <strong>CPU bottleneck</strong>: method nóng (flame graph), vòng lặp dày, tạo nhiều object gây GC pressure.
- <strong>Memory bottleneck</strong>: heap leak (tăng dần đến OOM), live set lớn gây GC pause dài.
- <strong>I/O bottleneck</strong>: query DB chậm (slow query log + EXPLAIN), network latency, thiếu connection pool.
- <strong>Lock contention</strong>: thread dump thấy nhiều thread BLOCKED chờ cùng một monitor.
- Công cụ: <code>jstack</code>, <code>jmap</code>, <code>jcmd</code>, <code>jstat</code>, <strong>async-profiler</strong> (an toàn production), <strong>Arthas</strong> (Alibaba).

## Ứng Dụng Thực Tế

Trong phỏng vấn, mô tả quy trình hệ thống: 1) Quan sát triệu chứng (CPU cao? bộ nhớ tăng? latency?), 2) Thu thập dữ liệu (thread dump / heap dump / GC log), 3) Xác định root cause, 4) Apply fix có mục tiêu, 5) Đo lại để xác nhận. Đừng chỉ nói "tôi tune JVM" mà không nói đã thay đổi gì và cải thiện bao nhiêu.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Mô tả cách chẩn đoán CPU cao trong ứng dụng Java.</strong></summary>

**A:** (1) `top -H -p <pid>` — tìm thread dùng CPU nhiều nhất (TID). (2) Convert TID decimal → hex. (3) `jstack <pid> | grep -A 30 "nid=0x<hex>"` — xem stack trace của thread đó. Thường thấy: infinite loop, busy wait, CAS spin. (4) Async-profiler (`./profiler.sh -e cpu -d 30 -f cpu.html <pid>`) — flame graph trực quan. (5) Check GC: nếu GC thread ngốn CPU → heap full, memory leak. (6) JIT compilation: warm-up phase có thể có CPU spike.

</details>

<details>
<summary><strong>Heap dump và thread dump khác nhau thế nào?</strong></summary>

**A:** **Heap dump**: snapshot toàn bộ **object trong memory** tại một thời điểm — phân tích memory leak, xem object nào chiếm nhiều heap. Tạo: `jcmd <pid> GC.heap_dump filename.hprof` hoặc `-XX:+HeapDumpOnOutOfMemoryError`. Phân tích: Eclipse MAT, VisualVM. **Thread dump**: snapshot tất cả **thread states và stack trace** — phân tích deadlock, thread block, CPU spike. Tạo: `jstack <pid>` hoặc `kill -3`. Phân tích: TDA, fastthread.io. Heap dump: memory issue; Thread dump: concurrency issue.

</details>

<details>
<summary><strong>Làm sao xác định method nào đang ngốn CPU nhất?</strong></summary>

**A:** **Async-profiler** là tool tốt nhất: `./profiler.sh -e cpu -d 30 -f cpu.html <pid>` → generate **flame graph** — chiều rộng của block tương ứng % CPU time. Nhìn vào block rộng nhất ở top → method hotspot. Không cần restart app. Alternative: **JFR (Java Flight Recorder)** + JMC: `jcmd <pid> JFR.start duration=60s filename=recording.jfr` → open trong JMC → Method Profiling tab. Dùng sampling-based profiler (không instrumentation) để minimize overhead.

</details>
