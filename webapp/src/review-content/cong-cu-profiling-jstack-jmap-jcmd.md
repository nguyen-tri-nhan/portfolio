---
key: "Công cụ Profiling (jstack/jmap/jcmd)"
title: "Công Cụ Profiling: jstack / jmap / jcmd"
crumb: "1. Core Java › Performance Tuning"
---

JDK đi kèm các công cụ chẩn đoán tích hợp — jstack (thread dump), jmap (heap info/dump), jcmd (đa năng), jstat (GC stats). async-profiler và Arthas cung cấp profiling sâu hơn với overhead tối thiểu.

## Điểm Chính

- <code>jstack &lt;pid&gt;</code>: thread dump — trạng thái tất cả thread (RUNNABLE/BLOCKED/WAITING) và stack trace. Phát hiện deadlock.
- Heap summary: <code>jcmd &lt;pid&gt; GC.heap_info</code> hoặc <code>jhsdb jmap --heap --pid &lt;pid&gt;</code> (<code>jmap -heap</code> không còn từ JDK 9). Heap dump: <code>jcmd &lt;pid&gt; GC.heap_dump h.hprof</code> (Oracle khuyến nghị jcmd) hoặc <code>jmap -dump:live,format=b,file=h.hprof &lt;pid&gt;</code> — option <code>live</code> kích hoạt full GC trước khi dump.
- <code>jcmd &lt;pid&gt; help</code>: liệt kê lệnh có sẵn. <code>jcmd &lt;pid&gt; GC.heap_info</code>, <code>VM.flags</code>, <code>Thread.print</code>.
- <code>jstat -gcutil &lt;pid&gt; 1000</code>: GC stats mỗi 1 giây (% dùng S0/S1/Eden/Old, số lần GC và thời gian).
- <strong>async-profiler</strong>: CPU flame graph, allocation profiling, lock profiling. Dùng perf_events — an toàn production, không có safepoint bias.
- <strong>Arthas</strong> (Alibaba): trace method call, xem parameters, decompile class đang chạy. Rất hữu ích chẩn đoán production không cần redeploy.

## Ví Dụ Code

*Cheatsheet lệnh chẩn đoán*

```bash
# 1. Tìm PID của Java process
jps -l
# hoặc: ps aux | grep java

# 2. Thread dump (lấy 2-3 lần cách nhau 5-10s)
jstack 12345 > thread1.txt && sleep 5 && jstack 12345 > thread2.txt

# 3. GC monitoring (mỗi giây)
jstat -gcutil 12345 1000
# Output: S0  S1  E   O    M   CCS YGC  YGCT FGC FGCT  GCT
#          0  63  25  45  96   92  187  4.2   2  1.8  6.0

# 4. Heap dump (live = bỏ qua object không thể reach)
jmap -dump:live,format=b,file=/tmp/heap.hprof 12345
# Hoặc tự động khi OOM: -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/

# 5. async-profiler — CPU flame graph 30 giây
asprof -d 30 -f /tmp/flame.html 12345      # async-profiler 3.x (bản cũ: ./profiler.sh)

# 6. Arthas — trace method chậm (>100ms)
java -jar arthas-boot.jar 12345
[arthas]$ trace com.example.OrderService placeOrder '#cost > 100'
[arthas]$ watch com.example.OrderService placeOrder '{params, returnObj}' -x 2
```

## Ứng Dụng Thực Tế

Trong production: bật <code>-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/</code> khi startup để tự động capture heap dump khi OOM. Dùng <code>jstat -gcutil</code> mỗi giây để xem GC pressure thời gian thực. async-profiler an toàn production (không có overhead safepoint polling). Arthas lý tưởng khi không thể redeploy — instrument code đang chạy mà không cần restart.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tìm thread nào đang ngốn 100% CPU bằng jstack thế nào?</strong></summary>

**A:** (1) `top -H -p <pid>` → tìm TID (thread ID) dùng CPU nhiều nhất. (2) Convert TID decimal → hex: `printf "%x" <TID>`. (3) `jstack <pid> | grep -A 30 "<hex_tid>"` → tìm stack trace của thread đó. Thường thấy: infinite loop, lock contention, GC thread busy. Với async-profiler: `asprof -e cpu -d 30 -f cpu.html <pid>` → flame graph trực quan hơn.

</details>

<details>
<summary><strong>jstat -gcutil cho biết gì?</strong></summary>

**A:** `jstat -gcutil <pid> 1000` in mỗi giây: **S0/S1** (Survivor space %), **E** (Eden space %), **O** (Old Gen %), **M** (Metaspace %), **YGC** (Young GC count), **YGCT** (Young GC time), **FGC** (Full GC count), **FGCT** (Full GC time), **GCT** (Total GC time). Cảnh báo: O > 80% → sắp OOM; FGC tăng liên tục → memory leak; FGCT cao → GC pause lớn ảnh hưởng latency.

</details>

<details>
<summary><strong>Khi nào dùng async-profiler thay vì jmap?</strong></summary>

**A:** Hai công cụ trả lời hai câu hỏi khác nhau. **Histogram / heap dump** (`jcmd <pid> GC.class_histogram`, `jcmd <pid> GC.heap_dump`, hoặc `jmap -histo`/`-dump`): ảnh chụp các object **đang sống** tại một thời điểm — trả lời "cái gì đang chiếm bộ nhớ", dùng khi nghi memory leak. **async-profiler**: lấy mẫu liên tục theo thời gian (CPU, allocation, lock) và vẽ flame graph — trả lời "code nào đang tốn CPU / cấp phát nhiều"; không bị safepoint bias nên hợp chạy trong production. Leak → heap dump + MAT; CPU cao hoặc GC pressure do cấp phát nhiều → async-profiler.

</details>
