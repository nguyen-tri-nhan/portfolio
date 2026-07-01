---
key: java-17
title: Java 17 LTS
crumb: Java Versions > Java 17
---

Java 17 (Sep 2021) là LTS được adopt rộng rãi nhất hiện nay. Spring Boot 3.x yêu cầu Java 17 minimum. Sealed Classes và Pattern Matching for Switch là highlights.

## Điểm Chính

- **Sealed Classes (FINAL)** — kiểm soát type hierarchy, base cho exhaustive pattern matching
- **Pattern Matching for Switch (preview)** — switch theo type pattern
- **Strong Encapsulation** — không còn `--illegal-access`, internal JDK APIs bị block hoàn toàn
- Foreign Function & Memory API (incubating) — thay thế JNI
- **Removed**: Applet API (deprecated Java 9), RMI Activation System
- **Deprecated**: Security Manager (removed Java 17)

## Ví Dụ Code

```java
// ── Sealed Classes (FINAL) ───────────────────────────────────

// Sealed interface — chỉ các class trong permits mới implement được
public sealed interface Shape permits Circle, Rectangle, Triangle {
    double area();
}

public record Circle(double radius) implements Shape {
    public double area() { return Math.PI * radius * radius; }
}

public record Rectangle(double width, double height) implements Shape {
    public double area() { return width * height; }
}

public final class Triangle implements Shape {   // final: không extend tiếp
    private final double base, height;
    public Triangle(double base, double height) {
        this.base = base; this.height = height;
    }
    public double area() { return 0.5 * base * height; }
}

// ── Pattern Matching for Switch (preview Java 17) ─────────────

// OLD — verbose instanceof chain
String format(Object obj) {
    if (obj instanceof Integer i) return "int %d".formatted(i);
    if (obj instanceof Long l)    return "long %d".formatted(l);
    if (obj instanceof Double d)  return "double %.2f".formatted(d);
    if (obj instanceof String s)  return "String \"%s\"".formatted(s);
    return obj.toString();
}

// NEW — Pattern Matching for switch
String format(Object obj) {
    return switch (obj) {
        case Integer i -> "int %d".formatted(i);
        case Long l    -> "long %d".formatted(l);
        case Double d  -> "double %.2f".formatted(d);
        case String s  -> "String \"%s\"".formatted(s);
        default        -> obj.toString();
    };
}

// Sealed + Pattern Matching = exhaustiveness (no default needed)
double calculateArea(Shape shape) {
    return switch (shape) {
        case Circle c    -> Math.PI * c.radius() * c.radius();
        case Rectangle r -> r.width() * r.height();
        case Triangle t  -> 0.5 * t.base() * t.height();
        // Compiler: no default needed — all permits covered!
    };
}

// Guarded patterns (when clause)
String classify(Object obj) {
    return switch (obj) {
        case Integer i when i < 0   -> "negative int";
        case Integer i when i == 0  -> "zero";
        case Integer i              -> "positive int: " + i;
        case String s when s.isEmpty() -> "empty string";
        case String s               -> "string: " + s;
        default                     -> "other: " + obj;
    };
}

// ── Strong Encapsulation ─────────────────────────────────────

// Java 8: có thể access sun.misc.Unsafe, com.sun.*
// Java 9-16: --illegal-access=warn/deny (còn có option bypass)
// Java 17: không còn --illegal-access flag — HARD block

// Nếu framework dùng reflection vào internal API → cần:
// --add-opens java.base/java.lang=ALL-UNNAMED  (thêm vào JVM args)
// Hoặc framework phải update để dùng public API

// Spring Boot 3 đã không cần --add-opens
// Spring Boot 2 với Java 17 cần thêm một số flags

// ── Pseudo Random Number Generators (Java 17) ────────────────

// New unified API
RandomGeneratorFactory.all()
    .filter(f -> f.isStatistical())
    .forEach(f -> System.out.println(f.name()));

RandomGenerator rng = RandomGeneratorFactory
    .of("Xoshiro256PlusPlus")
    .create();
int roll = rng.nextInt(1, 7);  // dice roll
```

## Ứng Dụng Thực Tế

**Sealed Classes** thường gặp trong:
- Domain model: `sealed interface PaymentResult permits Success, Failure, Pending`
- Error handling: `sealed interface ApiResponse<T> permits ApiSuccess<T>, ApiError`
- State machine: `sealed interface OrderState permits Draft, Confirmed, Shipped, Delivered`

Kết hợp với Records và Pattern Matching tạo ra pattern functional-style error handling tương tự `Result` type trong Rust/Kotlin.

**Spring Boot 3 yêu cầu Java 17** — đây là lý do chính nhiều team upgrade. Spring Framework 6, Jakarta EE 9+ đều require Java 17.

**Strong Encapsulation** là pain point lớn nhất khi upgrade từ Java 11 → 17. Nhiều thư viện (Hibernate, byte-buddy, CGLIB) phải update để tránh dùng internal API.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao Sealed Classes quan trọng với Pattern Matching?</strong></summary>

**A:** Sealed class cho compiler biết **toàn bộ** possible subtype tại compile time. Khi kết hợp với Pattern Matching for switch: compiler verify exhaustiveness — nếu switch cover tất cả permitted types, không cần `default` case. Nếu thêm subtype mới vào sealed class, compiler báo lỗi tại tất cả switch chưa handle type mới. Đây là "compile-time safety net" — tương tự exhaustive when trong Kotlin hoặc match trong Rust. Không có sealed: switch với `default` case sẽ silently ignore type mới.

</details>

<details>
<summary><strong>Foreign Function & Memory API thay thế JNI thế nào?</strong></summary>

**A:** JNI (Java Native Interface): gọi native C/C++ code từ Java — cồng kềnh, error-prone (manual memory management), unsafe (crash JVM nếu bug). FFM API (Project Panama): (1) `MemorySegment` — safe off-heap memory management với automatic cleanup. (2) `MethodHandle` + `Linker` — gọi native function không cần JNI glue code. (3) `jextract` tool — auto-generate Java binding từ C header. Ví dụ: gọi OpenSSL, BLAS libraries trực tiếp. Thành standard trong Java 22.

</details>

<details>
<summary><strong>Upgrade từ Java 11 lên Java 17 cần chú ý gì?</strong></summary>

**A:** (1) **Strong Encapsulation**: check `--illegal-access` warnings trong Java 11 → fix trước khi lên 17. Dùng `jdeps --jdk-internals` để tìm vi phạm. (2) **Security Manager removed**: nếu đang dùng SecurityManager → cần alternative. (3) Libraries: update Spring Boot 2.7+, Hibernate 5.6+, CGLIB, byte-buddy phiên bản support Java 17. (4) Tool chain: Maven 3.8+, Gradle 7.3+, IDE update. (5) Docker image: đổi sang `eclipse-temurin:17-jre-alpine`. Thường upgrade này ít breaking hơn Java 8→11 vì không có JPMS shock.

</details>
