---
key: "Java I/O"
title: "Tổng Quan Java I/O"
crumb: "1. Core Java"
---

Java cung cấp hai package I/O: <code>java.io</code> (blocking, dựa trên stream) và <code>java.nio</code> (non-blocking, dựa trên buffer/channel). NIO.2 (<code>java.nio.file</code>) hiện đại hóa các thao tác file. Hiểu cả ba là nền tảng để xử lý file, network và xây dựng ứng dụng hiệu năng cao.

## Điểm Chính

- <strong>java.io</strong>: Dựa trên stream, blocking. InputStream/OutputStream cho bytes; Reader/Writer cho ký tự.
- <strong>java.nio</strong>: Mô hình Buffer + Channel. Hỗ trợ non-blocking và Selector để multiplexing.
- <strong>NIO.2</strong> (Java 7+): package <code>java.nio.file</code> — Path, Files, WatchService cho thao tác file hiện đại.
- Blocking I/O: một thread một kết nối — đơn giản nhưng không scale quá ~10K kết nối đồng thời.
- NIO Selector: một thread giám sát nhiều channel — nền tảng của Netty và các server high-concurrency.
- Java 21 Virtual Threads: viết code blocking nhưng scale như NIO — tốt nhất cả hai thế giới.

## Ứng Dụng Thực Tế

Trong Spring Boot ít khi viết raw I/O. Nhưng cần hiểu: <code>MultipartFile.getInputStream()</code> dùng java.io; Spring WebFlux (Netty) dùng NIO selector. Với file lớn, dùng <code>Files.lines(path)</code> — stream lazy, bộ nhớ không tăng theo kích thước file.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa java.io và java.nio là gì?</strong></summary>

**A:** **java.io (blocking I/O)**: stream-oriented, blocking — thread block khi đọc/ghi. Đơn giản, dễ dùng, phù hợp throughput thấp. **java.nio**: buffer-oriented, non-blocking — channel + buffer model, Selector cho multiplexed I/O. Một thread có thể xử lý nhiều channel đồng thời qua Selector. NIO phức tạp hơn nhưng hiệu quả hơn khi cần xử lý nhiều concurrent connection với ít thread. Java 21 Virtual Threads làm blocking I/O scale như NIO mà code đơn giản hơn.

</details>

<details>
<summary><strong>Khi nào nên dùng NIO thay vì Blocking I/O?</strong></summary>

**A:** Dùng **NIO** khi: (1) Cần xử lý **hàng nghìn concurrent connection** với ít thread (chat server, game server, proxy). (2) Cần non-blocking operation với timeout. (3) Memory-mapped file cho file I/O performance cao. NIO phức tạp: ByteBuffer flip/clear, Selector event loop. **Blocking I/O** phù hợp khi: concurrent connection ít, code đơn giản hơn quan trọng, hoặc dùng Virtual Threads (Java 21+) — blocking code scale như NIO.

</details>

<details>
<summary><strong>Selector trong Java NIO có vai trò gì?</strong></summary>

**A:** **Selector** là multiplexer: một thread monitor **nhiều Channel** cùng lúc. Register channel với selector (kèm interest ops: OP_READ, OP_WRITE, OP_CONNECT, OP_ACCEPT). `selector.select()` block cho đến khi có channel ready — return set of `SelectionKey`. Duyệt keys, xử lý từng ready channel. Pattern: event loop trong một thread thay vì thread-per-connection. Nền tảng của Netty, Tomcat NIO connector, WebSocket server.

</details>
