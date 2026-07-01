---
key: "NIO (Non-Blocking)"
title: "NIO — Non-Blocking I/O"
crumb: "1. Core Java › Java I/O"
---

java.nio dùng mô hình Buffer + Channel. Channel có thể set sang non-blocking, và Selector multiplexes nhiều channel trên một thread — cho phép server event-driven xử lý hàng nghìn kết nối mà không cần thread-per-connection.

## Điểm Chính

- <strong>Buffer</strong>: container có typed (ByteBuffer, CharBuffer…) với position/limit/capacity. Data chạy qua buffer.
- <strong>Channel</strong>: bidirectional, hỗ trợ cả đọc và ghi. Loại chính: <code>FileChannel, SocketChannel, ServerSocketChannel</code>.
- <strong>Selector</strong>: theo dõi nhiều channel cho sự kiện I/O: OP_ACCEPT, OP_READ, OP_WRITE.
- <code>channel.configureBlocking(false)</code>: non-blocking — read/write trả về 0 thay vì block.
- <strong>Zero-copy</strong>: <code>FileChannel.transferTo()</code> chuyển data trực tiếp kernel → socket, không qua user space.
- <code>ByteBuffer.flip()</code>: chuyển buffer từ write mode sang read mode (limit = position, position = 0).

## Ví Dụ Code

*Server non-blocking dùng Selector*

```java
// Skeleton server non-blocking với Selector
ServerSocketChannel server = ServerSocketChannel.open();
server.bind(new InetSocketAddress(8080));
server.configureBlocking(false);

Selector selector = Selector.open();
server.register(selector, SelectionKey.OP_ACCEPT);

while (true) {
    selector.select(); // block cho đến khi có ít nhất 1 channel sẵn sàng
    Iterator<SelectionKey> it = selector.selectedKeys().iterator();
    while (it.hasNext()) {
        SelectionKey key = it.next(); it.remove();
        if (key.isAcceptable()) {
            SocketChannel client = server.accept();
            client.configureBlocking(false);
            client.register(selector, SelectionKey.OP_READ);
        } else if (key.isReadable()) {
            SocketChannel ch = (SocketChannel) key.channel();
            ByteBuffer buf = ByteBuffer.allocate(1024);
            ch.read(buf);
            buf.flip(); // chuyển sang read mode
            // xử lý buf.array()[0..buf.limit()]
        }
    }
}
```

## Ứng Dụng Thực Tế

Ít khi viết raw NIO trong Spring Boot — Netty (WebFlux) đã lo. Nhưng interviewer hỏi để kiểm tra hiểu biết về event-loop model. Insight chính: NIO Selector là nền tảng Java của cùng ý tưởng với Node.js event loop. Zero-copy qua <code>FileChannel.transferTo()</code> phổ biến trong file-serving throughput cao.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>ByteBuffer.flip() có vai trò gì?</strong></summary>

**A:** ByteBuffer có hai mode: **write mode** (sau `clear()`: position=0, limit=capacity — dùng để write data vào) và **read mode** (sau `flip()`: limit=current_position, position=0 — dùng để read data đã write). `flip()` chuyển từ write sang read mode: đặt limit tại vị trí write dừng, reset position về 0. Không gọi `flip()` trước read → đọc từ position hiện tại đến capacity → có thể đọc garbage. Sau đọc xong: `compact()` (keep unread) hoặc `clear()` (reset) để quay về write mode.

</details>

<details>
<summary><strong>Selector cho phép một thread xử lý hàng nghìn kết nối thế nào?</strong></summary>

**A:** Thay vì thread-per-connection (blocking), Selector model: (1) Register nhiều `SocketChannel` với một `Selector` kèm interest ops (OP_READ, OP_WRITE). (2) Một thread gọi `selector.select()` — block cho đến khi ít nhất một channel ready. (3) Iterate qua `selectedKeys()`, xử lý từng ready channel (đọc/ghi non-blocking). (4) Quay lại `select()`. OS dùng `epoll` (Linux) để notify efficiently — không scan tất cả connection mỗi lần. Nền tảng của Netty event loop.

</details>

<details>
<summary><strong>Zero-copy là gì và FileChannel.transferTo() dùng nó thế nào?</strong></summary>

**A:** Normal file send: disk → kernel buffer → user space buffer → kernel socket buffer → network. **Zero-copy**: disk → kernel buffer → socket buffer — skip user space copy. `FileChannel.transferTo(position, count, socketChannel)` dùng OS `sendfile()` syscall: data không đi qua user space → giảm CPU copy, giảm context switch, tốc độ cao hơn nhiều cho file transfer. Dùng trong: static file server, file streaming. Kafka dùng zero-copy cho consumer fetch — đây là lý do Kafka có throughput cao.

</details>
