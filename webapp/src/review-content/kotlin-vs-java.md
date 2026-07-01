---
key: kotlin-vs-java
title: "Kotlin vs Java — Những Khác Biệt Chính"
crumb: "13. Kotlin > Kotlin Cơ Bản"
---

Kotlin được thiết kế để chạy trên JVM và 100% tương thích với Java, nhưng loại bỏ nhiều boilerplate và bổ sung các tính năng hiện đại như null safety, coroutines, và extension functions.

## Điểm Chính

- **Null safety**: Kotlin phân biệt `String` và `String?` tại compile time; Java không có — NPE là runtime error.
- **Data class**: Kotlin tự động sinh `equals/hashCode/toString/copy`; Java cần Lombok hoặc tự viết (Java 16+ có Records nhưng thiếu `copy()`).
- **Extension functions**: Thêm method vào class có sẵn mà không cần kế thừa; Java không có native support.
- **Coroutines**: Kotlin cung cấp async/concurrency nhẹ hơn thread; Java có CompletableFuture/Virtual Threads.
- **Smart cast**: Sau `if (x is String)`, Kotlin tự cast `x` sang `String`; Java vẫn cần cast tường minh.
- **Immutability by default**: `val` vs `var` rõ ràng hơn Java — Java không có `final` local variable tường minh.
- **Interoperability**: Kotlin gọi Java library 100%, Java gọi Kotlin cần chú ý `@JvmStatic`, `@JvmField`.
- **Conciseness**: Kotlin thường ít 40-60% lines of code so với Java tương đương.

## Ví Dụ Code

*So sánh cùng use case viết bằng Java và Kotlin*

```kotlin
// ============ DATA CLASS ============
// Java (với Lombok):
// @Data @Builder public class UserDto { private String name; private String email; private int age; }

// Kotlin — một dòng:
data class UserDto(val name: String, val email: String, val age: Int)

// ============ NULL SAFETY ============
// Java — NPE âm thầm:
// String name = user.getAddress().getCity(); // NPE nếu address null

// Kotlin — compile-time protection:
val city: String = user?.address?.city ?: "Unknown"

// ============ SMART CAST ============
// Java:
// if (obj instanceof String) { String s = (String) obj; System.out.println(s.length()); }

// Kotlin:
if (obj is String) {
    println(obj.length)  // Tự động cast sang String
}

// ============ EXTENSION FUNCTIONS ============
// Không cần thay đổi String class, không cần StringUtils
fun String.isValidEmail(): Boolean = contains("@") && contains(".")

fun String?.orDefault(default: String): String = this ?: default

val email = "user@example.com"
println(email.isValidEmail())    // true
println(null.orDefault("N/A"))  // N/A

// ============ HIGHER ORDER FUNCTIONS ============
// Java — verbose với anonymous class (trước Java 8):
// list.sort(new Comparator<User>() { public int compare(User a, User b) { ... } });

// Kotlin:
val users = listOf(UserDto("Bob", "bob@a.com", 30), UserDto("Alice", "alice@b.com", 25))
val sorted = users.sortedBy { it.age }.filter { it.age > 18 }

// ============ WHEN vs SWITCH ============
// Java switch không exhaustive, không return value
// Kotlin when — expression với kiểm tra đầy đủ:
fun describeNumber(n: Int): String = when {
    n < 0 -> "Negative"
    n == 0 -> "Zero"
    n < 10 -> "Small"
    else -> "Large"
}

// ============ INTEROP: KOTLIN GỌI JAVA ============
// Kotlin gọi Java hoàn toàn tự nhiên
val list = java.util.ArrayList<String>()
list.add("item")
val stream = list.stream().filter { it.startsWith("i") }

// ============ INTEROP: JAVA GỌI KOTLIN ============
// File: MathUtils.kt
object MathUtils {
    @JvmStatic
    fun square(n: Int): Int = n * n

    @JvmField
    val PI = 3.14159
}
// Java: MathUtils.square(5)  ← @JvmStatic cho phép gọi trực tiếp
// Java: MathUtils.PI          ← @JvmField expose như field, không phải getter

// ============ COROUTINES vs COMPLETABLEFUTURE ============
// Java CompletableFuture — callback hell tiềm ẩn:
// CompletableFuture.supplyAsync(() -> fetchUser(id))
//     .thenCompose(user -> fetchOrders(user.getId()))
//     .thenAccept(orders -> process(orders));

// Kotlin coroutines — đọc như synchronous code:
suspend fun processUserOrders(id: Long) {
    val user = fetchUser(id)        // non-blocking suspend
    val orders = fetchOrders(user.id) // non-blocking suspend
    process(orders)
}

suspend fun fetchUser(id: Long): UserDto = UserDto("Nhan", "nhan@example.com", 30)
suspend fun fetchOrders(userId: Long): List<String> = listOf("order1", "order2")
fun process(orders: List<String>) = println("Processing ${orders.size} orders")
```

## Ứng Dụng Thực Tế

Kotlin được Google chọn làm ngôn ngữ chính thức cho Android (2017) và ngày càng phổ biến trong Spring Boot (Spring Framework 5+ hỗ trợ first-class). Các công ty như JetBrains, Gradle, và nhiều startup chọn Kotlin cho backend vì code ngắn gọn hơn, ít bug hơn (null safety), và coroutines tích hợp tốt với reactive/async patterns.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao nên chọn Kotlin thay vì Java cho dự án mới?</strong></summary>

**A:** Ba lý do chính: (1) **Null safety** — giảm đáng kể NPE trong production, compiler bắt buộc xử lý null tường minh; (2) **Conciseness** — ít boilerplate hơn 40-60%, data class, extension functions, smart casts giúp code dễ đọc; (3) **Coroutines** — xử lý async/concurrent đơn giản hơn CompletableFuture, quan trọng trong microservices và reactive systems. Kotlin hoàn toàn tương thích JVM nên migrate dần dần mà không cần rewrite toàn bộ.

</details>

<details>
<summary><strong>Có khó khăn gì khi tích hợp Kotlin với Java không?</strong></summary>

**A:** Một số điểm cần chú ý: (1) **Platform types** — Java methods không annotate `@Nullable` trở thành platform type trong Kotlin, cần cẩn thận để tránh NPE; (2) **Java gọi Kotlin** — companion object cần `@JvmStatic`, property cần `@JvmField`, default parameters không tự động hoạt động từ Java (cần `@JvmOverloads`); (3) **Collections** — Kotlin collections immutable/mutable có thể gây nhầm lẫn khi pass sang Java; (4) **Coroutines từ Java** — khó dùng trực tiếp, thường wrap bằng CompletableFuture.

</details>

<details>
<summary><strong>Java code gọi Kotlin như thế nào?</strong></summary>

**A:** Java gọi Kotlin cần một số annotations để hoạt động tự nhiên: `@JvmStatic` cho companion object methods để gọi như `MyClass.method()` thay vì `MyClass.Companion.method()`; `@JvmField` để expose Kotlin property như Java field thay vì getter/setter; `@JvmOverloads` để sinh overloaded method từ default parameters của Kotlin; `@Throws(Exception::class)` để khai báo checked exception cho Java callers. Không có các annotations này, Java vẫn gọi được nhưng syntax không tự nhiên.

</details>
