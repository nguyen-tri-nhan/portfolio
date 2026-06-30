---
key: "JVM Internals"
title: "Nội Bộ JVM"
crumb: "1. Core Java"
---

JVM quản lý bộ nhớ (Heap, Stack, Metaspace), tải class động, thực thi bytecode qua JIT và xử lý garbage collection — hiểu điều này là chìa khóa để chẩn đoán vấn đề hiệu năng.

## Điểm Chính

- Vùng nhớ JVM: Heap (object), Stack (frame), Metaspace (class metadata), Code Cache (JIT compiled code), PC Register.
- Class loading: Bootstrap → Extension → Application ClassLoader (mô hình parent delegation).
- JIT compiler tối ưu hotspot: diễn giải bytecode rồi biên dịch đường dẫn nóng thành native code.
- GC quản lý heap; kích hoạt các pause stop-the-world với độ dài khác nhau tùy thuật toán.
- <code>-Xms</code>/<code>-Xmx</code> đặt heap ban đầu/tối đa; <code>-XX:MetaspaceSize</code> đặt ngưỡng metaspace.

## Ví Dụ Code

*JVM memory areas + production startup flags + diagnostic commands*

```java
// ============================================================
// JVM memory areas at a glance — useful mental model for interviews
// ============================================================
// HEAP: shared across all threads; holds all object instances
//   └─ Young Gen (Eden + S0 + S1)  → Minor GC
//   └─ Old Gen (Tenured)           → Major/Full GC
//
// STACK (per thread): frames for each method call
//   └─ local variables, operand stack, return address
//
// METASPACE (native memory): class metadata, bytecode, interned strings (Java 8+)
//
// CODE CACHE: JIT-compiled native code for hot methods
// ============================================================

// --- JVM startup flags for a Spring Boot microservice ---
// -Xms512m                          initial heap (avoid resize cost at startup)
// -Xmx1g                            max heap
// -XX:+UseG1GC                      G1 for balanced throughput/latency
// -XX:MaxGCPauseMillis=200          target GC pause
// -XX:+HeapDumpOnOutOfMemoryError   auto heap dump on OOM
// -XX:HeapDumpPath=/tmp/heap.hprof
// -Xlog:gc*:file=/var/log/gc.log:time,uptime:filecount=5,filesize=20m

// --- Container-aware sizing (Java 11+) ---
// -XX:+UseContainerSupport          reads cgroup memory limits (on by default J11+)
// -XX:MaxRAMPercentage=75.0         allocate 75% of container RAM to heap

// --- Runtime diagnostics (no restart needed) ---
// jcmd <pid> VM.native_memory       breakdown by: heap, metaspace, code cache
// jcmd <pid> GC.heap_info           current heap usage
// jmap -dump:format=b,file=heap.hprof <pid>
// jstack <pid>                      thread dump — spot BLOCKED/WAITING threads

// --- Programmatic inspection ---
MemoryMXBean mem   = ManagementFactory.getMemoryMXBean();
MemoryUsage heapUsage = mem.getHeapMemoryUsage();
System.out.printf("Heap: used=%dMB, max=%dMB%n",
    heapUsage.getUsed()  / 1_048_576,
    heapUsage.getMax()   / 1_048_576);

Runtime rt = Runtime.getRuntime();
System.out.printf("Processors: %d%n", rt.availableProcessors());
```

## Ứng Dụng Thực Tế

Chỉnh <code>-Xmx</code> dựa trên giới hạn bộ nhớ container (để lại 25% cho OS/JVM overhead). Bật GC logging trong production. Dùng <code>jcmd</code>, <code>jmap</code>, hoặc async-profiler để phân tích trực tiếp.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Các vùng nhớ chính của JVM là gì?</strong></summary>

**A:** Heap (Young + Old Gen — shared giữa threads, GC managed), Method Area / Metaspace (class metadata, static fields, constants — ngoài Heap từ Java 8), Stack (mỗi thread có riêng — stack frame per method call, local variables, operand stack), PC Register (địa chỉ instruction hiện tại per thread), Native Method Stack (cho JNI calls). OutOfMemoryError có thể xảy ra ở Heap, Metaspace, hoặc Stack (StackOverflowError).

</details>

<details>
<summary><strong>JIT Compiler là gì và nó tối ưu code thế nào?</strong></summary>

**A:** JIT (Just-In-Time) Compiler biên dịch bytecode thành native machine code tại runtime — khác với interpreted execution từng instruction. JVM theo dõi "hot methods" (gọi nhiều lần) và compile chúng với C1 (client compiler, nhanh) rồi C2 (server compiler, optimize sâu hơn). Các tối ưu tiêu biểu: method inlining (inline body của method nhỏ vào caller), loop unrolling, escape analysis (object không escape method → cấp phát trên stack thay vì heap). `-XX:+PrintCompilation` để xem những gì đang được JIT-compile.

</details>

<details>
<summary><strong>Class Loading trong JVM hoạt động thế nào?</strong></summary>

**A:** Ba bước: Loading (đọc .class file → tạo Class object), Linking (Verification → Preparation → Resolution), Initialization (chạy static initializer). Parent delegation model: ClassLoader con luôn delegate cho parent trước — Bootstrap → Extension → Application → Custom. Mục đích: bảo mật (không thể override java.lang.String), isolation (module system). Dùng custom ClassLoader cho hot-reload và plugin isolation.

</details>
