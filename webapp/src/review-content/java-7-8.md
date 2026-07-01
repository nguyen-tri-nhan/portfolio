---
key: java-7-8
title: Java 7 & Java 8
crumb: Java Versions > Java 7 & 8
---

Java 7 (2011) và Java 8 (2014) là nền tảng của Java hiện đại. Java 8 LTS vẫn được dùng rộng rãi trong enterprise đến nay.

## Điểm Chính

**Java 7 — Diamond, try-with-resources, Fork/Join**
- Diamond operator loại bỏ verbose generic type ở bên phải
- try-with-resources đảm bảo resource tự đóng
- Fork/Join framework cho parallel computation
- NIO.2 — API file system mới

**Java 8 — Cách mạng functional programming trong Java**
- Lambda expression + Functional Interface — Java trở thành functional-friendly
- Stream API — xử lý collection theo pipeline
- Optional — thay thế null, tránh NullPointerException
- Default method trong interface — thêm method vào interface mà không breaking change
- Date/Time API mới (java.time) — thay thế Calendar/Date cũ bug-prone
- CompletableFuture — async programming

## Ví Dụ Code

```java
// ── Java 7 ──────────────────────────────────────────────────

// Diamond operator
Map<String, List<Integer>> map = new HashMap<>(); // không cần <String, List<Integer>>()

// try-with-resources — AutoCloseable resource tự đóng khi exit block
try (InputStream in = new FileInputStream("file.txt");
     BufferedReader reader = new BufferedReader(new InputStreamReader(in))) {
    String line = reader.readLine();
}

// Multi-catch
try {
    // ...
} catch (IOException | SQLException e) {
    log.error("Error", e);
}

// Switch với String
switch (command) {
    case "start" -> start();
    case "stop"  -> stop();
}

// Numeric literals — underscore cho readability
long creditCard = 1234_5678_9012_3456L;
int binary      = 0b1010_0101;

// Fork/Join
ForkJoinPool pool = new ForkJoinPool();
pool.invoke(new MyRecursiveTask(data));

// ── Java 8 ──────────────────────────────────────────────────

// Lambda
Runnable r    = () -> System.out.println("Hello");
Comparator<String> c = (a, b) -> a.compareTo(b);

// Method reference
List<String> names = List.of("Alice", "Bob");
names.forEach(System.out::println);    // instance method ref
names.stream().map(String::toUpperCase); // static / unbound ref

// Stream API
List<String> result = employees.stream()
    .filter(e -> e.getDept().equals("Engineering"))
    .sorted(Comparator.comparing(Employee::getSalary).reversed())
    .limit(10)
    .map(Employee::getName)
    .collect(Collectors.toList());

// Optional — tránh null
Optional<User> user = userRepo.findById(id);
String email = user
    .map(User::getEmail)
    .orElse("unknown@example.com");

// Default method trong interface
interface Greeter {
    String greet(String name);
    default String greetLoud(String name) {    // default — không phá contract
        return greet(name).toUpperCase();
    }
}

// Date/Time API
LocalDate today   = LocalDate.now();
LocalDate payday  = today.with(TemporalAdjusters.lastDayOfMonth());
Duration  elapsed = Duration.between(start, end);
ZonedDateTime utcNow = ZonedDateTime.now(ZoneId.of("UTC"));

// CompletableFuture
CompletableFuture<User> future = CompletableFuture
    .supplyAsync(() -> userRepo.findById(id), executor)
    .thenApply(user -> enrich(user))
    .exceptionally(ex -> User.ANONYMOUS);
```

## Ứng Dụng Thực Tế

**Java 7**: Foundation — mọi Java developer phải biết. try-with-resources là must-have khi dùng DB connection, file, network socket. Fork/Join là nền tảng của parallel Stream trong Java 8.

**Java 8**: Là chuẩn minimum của hầu hết codebase hiện nay. Stream API thay thế vòng lặp verbose. Lambda giúp code ngắn gọn, dễ compose. Date/Time API bắt buộc dùng thay Calendar (Calendar không thread-safe, Date bị deprecated). CompletableFuture là nền tảng async trước khi có Virtual Threads (Java 21).

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Stream và Collection khác nhau thế nào?</strong></summary>

**A:** Collection: data structure lưu trữ elements trong memory, eager evaluation, có thể traverse nhiều lần, thêm/xóa element được. Stream: pipeline xử lý data, lazy evaluation (intermediate ops không chạy cho đến khi terminal op gọi), chỉ traverse một lần (sau đó consumed), không modify source. Stream phù hợp cho transform và aggregate; Collection phù hợp cho store và manipulate. Stream có thể generate infinite sequence (`Stream.iterate`, `Stream.generate`) vì lazy — Collection không thể.

</details>

<details>
<summary><strong>Optional.get() có vấn đề gì? Dùng gì thay thế?</strong></summary>

**A:** `Optional.get()` throw `NoSuchElementException` nếu Optional rỗng — tương đương `NullPointerException`, không có lợi gì. Nên dùng: `orElse(default)` (có default value), `orElseGet(() -> compute())` (lazy compute default), `orElseThrow(() -> new BusinessException(...))` (throw meaningful exception), `map()` + `flatMap()` để chain transformations. `ifPresent(consumer)` cho side effects. `Optional.get()` chỉ an toàn sau `isPresent()` check — nhưng ngay cả vậy cũng nên dùng `orElseThrow` cho clearer code.

</details>

<details>
<summary><strong>Default method trong interface giải quyết vấn đề gì?</strong></summary>

**A:** Trước Java 8: thêm method vào interface → tất cả implementors phải implement → breaking change toàn bộ ecosystem. Java 8 dùng default method để thêm `forEach`, `stream`, `removeIf` vào Collection interface mà không break code dùng Java 7. Conflict resolution: nếu class implement 2 interface có cùng default method → compile error, phải override để resolve. Class method luôn override default method của interface. Không phải kế thừa đa nhiều (không có state trong interface) — chỉ là behavior mixin.

</details>

<details>
<summary><strong>@FunctionalInterface là gì và tại sao quan trọng?</strong></summary>

**A:** Interface có đúng một abstract method — có thể được represent bằng lambda. `@FunctionalInterface` annotation: compiler check enforce single abstract method (compile error nếu thêm method thứ 2). Không bắt buộc để dùng lambda (bất kỳ SAM interface nào đều được) nhưng là good practice — document intent, catch mistake sớm. Built-in: `Predicate<T>`, `Function<T,R>`, `Supplier<T>`, `Consumer<T>`, `BiFunction<T,U,R>`. Custom: `@FunctionalInterface interface Validator<T> { boolean validate(T t); }`.

</details>

<details>
<summary><strong>java.util.Date và java.time.LocalDate khác nhau thế nào?</strong></summary>

**A:** `java.util.Date`: mutable (thread-unsafe), đại diện cho cả date lẫn time (milliseconds since epoch), deprecated methods (getYear() returns year - 1900), dễ bug. `Calendar`: mutable, verbose API, month 0-indexed (tháng 1 = 0). `java.time` (Java 8): immutable → thread-safe, clear separation (`LocalDate` chỉ date, `LocalTime` chỉ time, `LocalDateTime` cả hai, `ZonedDateTime` với timezone, `Instant` cho timestamp). Fluent API, ISO 8601 compliant. Luôn dùng `java.time` trong code mới. Jackson, JPA đều hỗ trợ `java.time` native.

</details>
