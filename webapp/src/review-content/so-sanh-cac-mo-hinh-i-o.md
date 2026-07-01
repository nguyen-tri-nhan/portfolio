---
key: "So sánh các mô hình I/O"
title: "So Sánh Các Mô Hình I/O"
crumb: "1. Core Java › Java I/O"
---

Java hỗ trợ bốn mô hình I/O: Blocking (java.io), Non-Blocking NIO (selector), Asynchronous NIO2 (AsynchronousChannel), và Virtual Threads (Java 21). Hiểu trade-off giúp chọn đúng approach.

## Điểm Chính

- <strong>Blocking I/O</strong>: thread block đến khi có data. Code đơn giản, scale kém (thread-per-connection).
- <strong>Non-Blocking NIO</strong>: selector poll nhiều channel. Một thread xử lý nghìn kết nối. Code phức tạp hơn.
- <strong>Async NIO2</strong>: <code>AsynchronousFileChannel</code> — completion handler gọi khi I/O xong. Dựa trên callback, phức tạp.
- <strong>Virtual Threads (Java 21)</strong>: code blocking style; JVM tháo carrier thread khi I/O wait. Code đơn giản + concurrency cao.
- Spring WebFlux: reactive streams qua Netty NIO — non-blocking tường minh nhưng mô hình reactive phức tạp.
- Spring MVC trên Virtual Threads (Java 21): đơn giản hơn WebFlux, vẫn xử lý concurrency cao — ưu tiên cho project mới.

## Ví Dụ Code

*Blocking vs WebFlux vs Virtual Threads*

```java
// Cách 1: Blocking truyền thống (đơn giản, scale giới hạn)
@GetMapping("/data")
String data() throws Exception {
    return Files.readString(Path.of("big.txt")); // block carrier thread
}

// Cách 2: Spring WebFlux (non-blocking, reactive — phức tạp)
@GetMapping("/data")
Mono<String> data() {
    return Mono.fromCallable(() -> Files.readString(Path.of("big.txt")))
               .subscribeOn(Schedulers.boundedElastic());
}

// Cách 3: Virtual Threads (Java 21) — tốt nhất cả hai
// application.properties: spring.threads.virtual.enabled=true
// Code blocking y hệt cách 1, nhưng JVM tự chuyển sang virtual thread.

// Hoặc cấu hình thủ công:
@Bean
TomcatProtocolHandlerCustomizer<?> useVirtualThreads() {
    return handler ->
        handler.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
}
```

## Ứng Dụng Thực Tế

Cho project Java 21+ mới: dùng Virtual Threads với Spring MVC truyền thống — concurrency cao mà không cần reactive programming phức tạp. Chỉ dùng WebFlux khi cần backpressure hoặc streaming (Server-Sent Events, response lớn). Biết tất cả mô hình để thảo luận kiến trúc trong phỏng vấn — interviewer kiểm tra hiểu tại sao chọn mỗi loại.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Blocking I/O và Non-blocking I/O khác nhau thế nào?</strong></summary>

**A:** **Blocking I/O**: thread gọi `read()` → block cho đến khi data available — thread bị "frozen", không làm gì khác được. 1000 concurrent connections → 1000 threads (tốn memory). **Non-blocking I/O**: `read()` return ngay — nếu không có data, return EAGAIN. Thread có thể làm việc khác, dùng event loop hoặc selector để check khi data ready. Ít threads, nhiều connections. Java: `java.io` = blocking; `java.nio` với Selector = non-blocking. Nginx, Node.js dùng non-blocking I/O — handle hàng nghìn connections với một thread event loop.

</details>

<details>
<summary><strong>Sự khác biệt giữa đồng bộ (sync) và bất đồng bộ (async) I/O?</strong></summary>

**A:** **Sync I/O**: caller chịu trách nhiệm check data ready (blocking: chờ; non-blocking: poll) — caller actively involved trong waiting. **Async I/O**: OS notify khi data ready qua callback/signal/future — caller làm việc khác, OS gọi lại khi done. Java AIO (`AsynchronousFileChannel`, `AsynchronousSocketChannel`): submit operation → callback khi complete. **Tóm tắt**: Blocking sync (truyền thống), Non-blocking sync (poll loop), Async (callback/completion handler). Virtual threads (Java 21): blocking syntax nhưng non-blocking behavior — JVM unmount thread khi block.

</details>

<details>
<summary><strong>Multiplexing I/O (select/epoll) hoạt động thế nào?</strong></summary>

**A:** **select/poll**: một thread monitor nhiều file descriptors (sockets) — `select(fds, timeout)` block cho đến khi ít nhất một FD ready → iterate để tìm FD nào ready → process. O(n) scan, max 1024 FDs. **epoll** (Linux): efficient version — `epoll_ctl` register FD, `epoll_wait` block chờ events, return chỉ FDs ready (not all). O(1) lookup, unlimited FDs. Nginx, Redis, Node.js dùng epoll. Java NIO Selector: abstraction trên epoll/kqueue. Pattern: một thread, nhiều connections, event-driven. Scalable cho I/O-heavy workloads.

</details>
