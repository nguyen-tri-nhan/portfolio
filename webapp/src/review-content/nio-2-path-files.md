---
key: "NIO.2 Path & Files"
title: "NIO.2 — API Path & Files"
crumb: "1. Core Java › Java I/O"
---

NIO.2 (Java 7, package java.nio.file) hiện đại hóa thao tác file với Path (bất biến, đa nền tảng), Files (các method tiện ích phong phú), và WatchService (theo dõi thay đổi thư mục).

## Điểm Chính

- <code>Path.of("dir/file.txt")</code>: path độc lập nền tảng. <code>Paths.get()</code> là cách cũ tương đương.
- <code>Files.readAllLines(path)</code>, <code>Files.readAllBytes(path)</code>: tiện lợi cho file nhỏ.
- <code>Files.lines(path)</code>: <code>Stream&lt;String&gt;</code> lazy — hiệu quả cho file lớn. Phải đóng stream sau khi dùng!
- <code>Files.walk(path)</code>: duyệt thư mục đệ quy dưới dạng <code>Stream&lt;Path&gt;</code>.
- <code>WatchService</code>: theo dõi sự kiện CREATE / MODIFY / DELETE trong thư mục mà không cần polling.

## Ví Dụ Code

*Files.lines, Files.walk, WatchService*

```java
// Đọc tất cả dòng (file nhỏ)
List<String> lines = Files.readAllLines(Path.of("config.txt"), StandardCharsets.UTF_8);

// Stream file lớn — bộ nhớ không tăng theo kích thước file
try (Stream<String> stream = Files.lines(Path.of("huge.log"))) {
    stream.filter(l -> l.contains("ERROR"))
          .forEach(System.out::println);
} // stream tự đóng

// Copy với ghi đè
Files.copy(Path.of("src.txt"), Path.of("dst.txt"), StandardCopyOption.REPLACE_EXISTING);

// Duyệt thư mục — tìm tất cả file .java
try (Stream<Path> walk = Files.walk(Path.of("src/main"))) {
    List<Path> javaFiles = walk
        .filter(p -> p.toString().endsWith(".java"))
        .collect(Collectors.toList());
}

// Theo dõi thư mục thay đổi
WatchService watcher = FileSystems.getDefault().newWatchService();
Path dir = Path.of("/data/uploads");
dir.register(watcher, ENTRY_CREATE, ENTRY_MODIFY, ENTRY_DELETE);
WatchKey key = watcher.take(); // block đến khi có sự kiện
for (WatchEvent<?> event : key.pollEvents()) {
    System.out.println(event.kind() + ": " + event.context());
}
```

## Ứng Dụng Thực Tế

Dùng <code>Files.lines()</code> để xử lý log file — stream lazy nên bộ nhớ không đổi dù file bao lớn. Luôn wrap trong try-with-resources để đóng stream. <code>WatchService</code> là nền tảng của hot-reload config trong Spring Cloud Config. Trong Spring Batch, <code>Files.walk()</code> tiện để xử lý thư mục chứa file input.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khác nhau giữa Files.readAllLines() và Files.lines()?</strong></summary>

**A:** **`Files.readAllLines()`**: đọc toàn bộ file vào `List<String>` trong memory — đơn giản nhưng tốn RAM cho file lớn. **`Files.lines()`**: trả về **lazy Stream<String>** — đọc từng dòng khi cần (streaming), phù hợp file lớn không fit RAM. Quan trọng: `Files.lines()` mở file resource — phải dùng trong try-with-resources hoặc `Stream.close()` để tránh resource leak:
```java
try (Stream<String> lines = Files.lines(path)) {
    lines.filter(l -> l.contains("ERROR")).forEach(System.out::println);
}
```

</details>

<details>
<summary><strong>Xử lý file log 10 GB không bị OutOfMemoryError thế nào?</strong></summary>

**A:** Dùng **streaming approach** — không load cả file vào memory:
```java
try (Stream<String> lines = Files.lines(Paths.get("app.log"))) {
    lines.filter(l -> l.contains("ERROR"))
         .limit(1000)
         .forEach(System.out::println);
}
```
Hoặc dùng `BufferedReader` với `readLine()` trong loop. NIO2 `Files.newBufferedReader()` auto-detects charset. Avoid: `Files.readAllBytes()`, `Files.readAllLines()` — load toàn bộ vào heap. Nếu cần aggregate: dùng Stream reduce/collect với accumulator.

</details>

<details>
<summary><strong>WatchService dùng để làm gì trong Java?</strong></summary>

**A:** `WatchService` monitor **filesystem events** (create, modify, delete) trên directory mà không cần polling. Dùng cho: config file hot reload, file upload trigger, build tool watch mode. Pattern:
```java
WatchService watcher = FileSystems.getDefault().newWatchService();
path.register(watcher, ENTRY_MODIFY, ENTRY_CREATE);
WatchKey key;
while ((key = watcher.take()) != null) {
    key.pollEvents().forEach(e -> handleEvent(e.context()));
    key.reset();
}
```
Native OS notification (inotify Linux, FSEvents Mac) — hiệu quả hơn polling.

</details>
