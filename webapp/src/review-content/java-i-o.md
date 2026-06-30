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

1. Sự khác biệt giữa java.io và java.nio là gì?
1. Khi nào nên dùng NIO thay vì Blocking I/O?
1. Selector trong Java NIO có vai trò gì?
