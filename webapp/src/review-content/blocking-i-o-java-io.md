---
key: "Blocking I/O (java.io)"
title: "Blocking I/O — java.io"
crumb: "1. Core Java › Java I/O"
---

java.io là blocking và dựa trên stream: mỗi lệnh read/write block thread hiện tại cho đến khi có data. Áp dụng Decorator pattern — bọc stream để thêm buffering, encoding, nén.

## Điểm Chính

- <strong>Byte streams</strong>: <code>InputStream / OutputStream</code> cho raw bytes. Cho file: <code>FileInputStream / FileOutputStream</code>.
- <strong>Char streams</strong>: <code>Reader / Writer</code> cho Unicode text. Cho file: <code>FileReader / FileWriter</code>.
- <strong>Buffered wrappers</strong>: <code>BufferedReader / BufferedWriter</code> gom nhiều system call thành batch — tăng hiệu năng đáng kể.
- Luôn dùng <code>try-with-resources</code> — đảm bảo <code>close()</code> được gọi dù có exception.
- Decorator chain: <code>new BufferedReader(new InputStreamReader(new FileInputStream("f.txt"), StandardCharsets.UTF_8))</code>.

## Ví Dụ Code

*Đọc/ghi text có buffer và copy binary*

```java
// Đọc file text từng dòng (có buffer)
try (BufferedReader br = new BufferedReader(
         new InputStreamReader(new FileInputStream("data.txt"), StandardCharsets.UTF_8))) {
    String line;
    while ((line = br.readLine()) != null) {
        System.out.println(line);
    }
}

// Ghi file text
try (BufferedWriter bw = new BufferedWriter(new FileWriter("out.txt"))) {
    bw.write("Hello, World!");
    bw.newLine();
}

// Copy file binary (buffer 8 KB)
try (InputStream in  = new FileInputStream("src.bin");
     OutputStream out = new FileOutputStream("dst.bin")) {
    byte[] buf = new byte[8192];
    int n;
    while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
}
```

## Ứng Dụng Thực Tế

Ưu tiên <code>Files.readAllLines()</code> cho file nhỏ và <code>Files.lines()</code> (lazy Stream) cho file lớn — cả hai là NIO.2 wrappers tiện lợi tự xử lý encoding và đóng stream. Luôn bọc <code>FileReader</code> bằng <code>BufferedReader</code> — không có buffer, mỗi <code>readLine()</code> gọi nhiều system call.

## Câu Hỏi Phỏng Vấn

1. Byte stream và char stream khác nhau thế nào?
1. BufferedReader bổ sung gì cho FileReader?
1. Điều gì xảy ra nếu quên đóng stream?
