---
key: java-9-11
title: Java 9–11 (Modules & HTTP Client)
crumb: Java Versions > Java 9–11
---

Java 9 mang đến Module System (JPMS) — thay đổi lớn nhất kể từ Java 5. Java 11 là LTS đầu tiên sau 7 năm.

## Điểm Chính

**Java 9 (2017)**
- **Module System (JPMS)** — đóng gói rõ ràng, strong encapsulation
- `List.of()`, `Set.of()`, `Map.of()` — immutable collection factories
- JShell — REPL tương tác
- Stream: `takeWhile()`, `dropWhile()`, `iterate()` với predicate
- `Optional.ifPresentOrElse()`, `Optional.or()`, `Optional.stream()`
- Private methods trong interface

**Java 10 (2018)**
- **`var` — Local Variable Type Inference** — compiler infer type
- Application Class-Data Sharing (AppCDS)
- `List.copyOf()`, `Collectors.toUnmodifiableList()`

**Java 11 (2018 — LTS)**
- **HTTP Client API** (standardized từ incubating Java 9)
- String: `isBlank()`, `strip()`, `lines()`, `repeat()`
- Files: `readString()`, `writeString()`
- `var` trong lambda parameters
- Epsilon GC (no-op GC — testing), ZGC (experimental)
- **Bỏ**: Java EE modules (javax.xml, JAXB, JAX-WS), CORBA, Nashorn (deprecated)
- Launch single-file source programs: `java Hello.java`

## Ví Dụ Code

```java
// ── Java 9 ──────────────────────────────────────────────────

// Module System — module-info.java
module com.example.app {
    requires java.net.http;          // depend on module
    requires com.example.api;
    exports com.example.service;     // expose to other modules
    opens com.example.model to com.fasterxml.jackson.databind; // reflection access
}

// Collection factories (immutable)
List<String>        roles   = List.of("ADMIN", "USER");
Set<Integer>        primes  = Set.of(2, 3, 5, 7, 11);
Map<String, String> config  = Map.of("host", "localhost", "port", "8080");
Map<String, String> config2 = Map.ofEntries(
    Map.entry("host", "localhost"),
    Map.entry("port", "8080")
);
// roles.add("X") → UnsupportedOperationException

// Stream improvements
List<Integer> nums = List.of(1, 2, 3, 4, 5, 6);
nums.stream().takeWhile(n -> n < 4).forEach(System.out::println); // 1 2 3
nums.stream().dropWhile(n -> n < 4).forEach(System.out::println); // 4 5 6

// iterate với predicate (infinite → bounded)
Stream.iterate(1, n -> n < 100, n -> n * 2)
      .forEach(System.out::println); // 1 2 4 8 16 32 64

// Optional improvements
Optional<String> opt = Optional.empty();
opt.ifPresentOrElse(
    s -> System.out.println("Found: " + s),
    () -> System.out.println("Not found")
);
Optional<String> result = opt.or(() -> Optional.of("default")); // Java 9

// Private method trong interface
interface MyService {
    default void process(String s) {
        log("Processing: " + s);  // gọi private
    }
    private void log(String msg) { // private method — Java 9+
        System.out.println("[LOG] " + msg);
    }
}

// ── Java 10 ──────────────────────────────────────────────────

// var — type inferred bởi compiler
var list   = new ArrayList<String>();   // ArrayList<String>
var map    = new HashMap<String, Integer>(); // HashMap<String, Integer>
var stream = list.stream();              // Stream<String>

// KHÔNG thể dùng var cho:
// var x;              // không có initializer
// var x = null;       // không infer được
// var x = (String) s; // ok nhưng pointless
// class field         // chỉ local variable

// ── Java 11 ──────────────────────────────────────────────────

// HTTP Client — sync
HttpClient client = HttpClient.newBuilder()
    .version(HttpClient.Version.HTTP_2)
    .connectTimeout(Duration.ofSeconds(10))
    .build();

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.example.com/users"))
    .header("Authorization", "Bearer " + token)
    .GET()
    .build();

HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
int status = response.statusCode();  // 200
String body = response.body();

// HTTP Client — async
CompletableFuture<HttpResponse<String>> futureResponse =
    client.sendAsync(request, BodyHandlers.ofString());

// String methods
"  hello world  ".strip();          // "hello world" (Unicode-aware vs trim())
"  ".isBlank();                      // true
"hello\nworld\n".lines()            // Stream<String>: ["hello", "world"]
    .collect(Collectors.toList());
"ha".repeat(3);                      // "hahaha"

// Files
String content = Files.readString(Path.of("config.json"));
Files.writeString(Path.of("output.txt"), "Hello", StandardOpenOption.CREATE);

// var trong lambda (Java 11)
List<String> names = List.of("Alice", "Bob");
names.stream()
     .map((@Nonnull var s) -> s.toUpperCase())  // annotation trên lambda param
     .forEach(System.out::println);

// Launch single file
// $ java Hello.java → không cần compile thủ công
```

## Ứng Dụng Thực Tế

**JPMS**: Production adoption thấp do migration cost cao — phá vỡ nhiều framework dùng internal API (sun.misc.Unsafe). Quan trọng để hiểu tại sao Java 9 upgrade từ Java 8 khó khăn. Spring Boot, Maven đều cần update để work với JPMS.

**`var`**: Được dùng rộng rãi cho local variable rõ ràng từ context. Best practice: dùng khi type dài và rõ từ right-hand side (`var list = new ArrayList<>()`). Tránh dùng khi làm mờ type (`var x = process(data)` — process trả về gì?).

**HTTP Client (Java 11)**: Thay thế Apache HttpClient / OkHttp trong project không muốn thêm dependency. Hỗ trợ HTTP/2, WebSocket, async. Được dùng nhiều trong microservice-to-microservice calls.

**Java 11** là điểm upgrade tối thiểu hợp lý từ Java 8 — sau khi Java 8 EOL public support. Spring Boot 3.x yêu cầu Java **17** minimum.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>JPMS (Module System) giải quyết vấn đề gì mà package chưa giải quyết được?</strong></summary>

**A:** Package chỉ là namespace — không có access control ở cấp độ module. Trước JPMS: internal API của JDK (`sun.misc.Unsafe`, `com.sun.*`) dễ dàng access từ ứng dụng, dẫn đến phụ thuộc vào implementation detail. JPMS bổ sung: (1) **Strong encapsulation** — internal packages không exported bị ẩn hoàn toàn. (2) **Explicit dependencies** — `requires` khai báo rõ ràng thay vì implicit classpath. (3) **Reliable configuration** — phát hiện missing module hoặc version conflict tại startup thay vì runtime. (4) **Smaller runtime** — `jlink` tạo custom JRE chỉ chứa modules cần thiết.

</details>

<details>
<summary><strong>`var` trong Java khác `var` trong JavaScript như thế nào?</strong></summary>

**A:** Java `var`: compile-time type inference — compiler xác định type tại compile time từ initializer, sau đó type đó bị fix (statically typed). Runtime: không có overhead, bytecode giống hệt khai báo explicit type. JavaScript `var`: dynamic typing — variable có thể chứa bất kỳ type nào tại runtime, scoped to function (không phải block). Java `var` không phải dynamic typing — chỉ là syntactic sugar cho compiler. Không thể reassign khác type: `var x = "hello"; x = 42;` là compile error.

</details>

<details>
<summary><strong>strip() và trim() khác nhau thế nào?</strong></summary>

**A:** `trim()` (Java 1.0): xóa characters có ASCII value ≤ 32 — chỉ xử lý ASCII whitespace (space, tab, newline). `strip()` (Java 11): Unicode-aware, sử dụng `Character.isWhitespace()` — xử lý tất cả Unicode whitespace như non-breaking space (U+00A0), em space, ideographic space. Ví dụ: `" hello ".trim()` không strip, `" hello ".strip()` strip đúng. Khi làm việc với text đa ngôn ngữ (Vietnamese, Chinese...) dùng `strip()`. `stripLeading()` và `stripTrailing()` cho từng phía.

</details>
