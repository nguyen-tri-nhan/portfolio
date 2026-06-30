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

1. ByteBuffer.flip() có vai trò gì?
1. Selector cho phép một thread xử lý hàng nghìn kết nối thế nào?
1. Zero-copy là gì và FileChannel.transferTo() dùng nó thế nào?
