---
key: kotlin-object-companion
title: "Object Declaration & Companion Object"
crumb: "13. Kotlin > Kotlin Cơ Bản"
---

Kotlin dùng từ khóa `object` cho ba mục đích khác nhau: singleton declaration, anonymous object expression, và companion object thay thế cho `static` members của Java.

## Điểm Chính

- **Object declaration** (`object MySingleton { }`) tạo singleton thread-safe — khởi tạo lazy, đảm bảo chỉ một instance.
- **Object expression** (anonymous object): tương đương anonymous class của Java, dùng để implement interface hoặc abstract class inline.
- **Companion object**: được khai báo bên trong class, truy cập qua tên class như `MyClass.method()` — thay thế `static` của Java.
- Companion object có thể implement interface và được đặt tên, ví dụ `companion object Factory { }`.
- Companion object **không phải** thực sự static — là instance đặc biệt, có thể dùng làm receiver của extension function.
- Factory pattern với companion object là idiom phổ biến: `User.create()` thay vì constructor public.
- Object declaration được khởi tạo lần đầu khi truy cập — **lazy và thread-safe** theo JVM class loading.
- Từ Java, gọi companion object qua `MyClass.Companion.method()` hoặc dùng `@JvmStatic`.

## Ví Dụ Code

*Ba dạng object và factory pattern với companion*

```kotlin
// 1. Object declaration — Singleton
object AppConfig {
    val baseUrl: String = System.getenv("BASE_URL") ?: "http://localhost:8080"
    val maxRetries: Int = 3

    fun isProduction(): Boolean = baseUrl.contains("prod")
}

// Dùng: AppConfig.baseUrl — không cần new, luôn cùng một instance

// 2. Object expression — Anonymous object (thay thế anonymous class Java)
interface ClickListener {
    fun onClick(id: Long)
}

fun registerListener(listener: ClickListener) {
    listener.onClick(42L)
}

fun anonymousObjectExample() {
    // Tạo implementation inline không cần define class riêng
    registerListener(object : ClickListener {
        override fun onClick(id: Long) {
            println("Clicked item: $id")
        }
    })

    // Object expression có thể capture biến từ scope bên ngoài
    val prefix = "Item"
    val listener = object : ClickListener {
        override fun onClick(id: Long) {
            println("$prefix clicked: $id")  // capture 'prefix'
        }
    }
}

// 3. Companion object — thay thế static
class User private constructor(
    val id: Long,
    val name: String,
    val email: String
) {
    // Companion object implement interface
    companion object Factory {
        private const val MAX_NAME_LENGTH = 50

        // Factory method — kiểm soát quá trình tạo object
        fun create(name: String, email: String): User {
            require(name.isNotBlank()) { "Name cannot be blank" }
            require(name.length <= MAX_NAME_LENGTH) { "Name too long" }
            require(email.contains("@")) { "Invalid email" }
            return User(
                id = generateId(),
                name = name.trim(),
                email = email.lowercase()
            )
        }

        fun anonymous(): User = User(id = -1L, name = "Anonymous", email = "")

        private fun generateId(): Long = System.currentTimeMillis()
    }
}

// Cách dùng Factory
val user = User.create("Nhan", "nhan@example.com")
val anon = User.anonymous()

// Extension trên companion object
fun User.Companion.fromJson(json: Map<String, String>): User {
    return create(
        name = json["name"] ?: error("Missing name"),
        email = json["email"] ?: error("Missing email")
    )
}

val userFromJson = User.fromJson(mapOf("name" to "Nhan", "email" to "nhan@example.com"))

// @JvmStatic để Java gọi không cần .Companion
class Counter {
    companion object {
        @JvmStatic
        fun create(initial: Int = 0) = Counter()
    }
}
// Java: Counter.create(0)  ← @JvmStatic
// Java: Counter.Companion.create(0)  ← không có @JvmStatic
```

## Ứng Dụng Thực Tế

Trong Spring Boot với Kotlin, companion object thường dùng để định nghĩa logger (`companion object { val log = LoggerFactory.getLogger(MyClass::class.java) }`), constants, và factory methods. Object declaration phù hợp cho utility stateless singletons. Tuy nhiên, Spring beans nên dùng `@Component`/`@Service` thay vì object singleton để tận dụng dependency injection và testability.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Companion object khác `static` của Java như thế nào?</strong></summary>

**A:** `static` trong Java là thành phần của class, không phải object. **Companion object** trong Kotlin là một instance thực sự của một class ẩn danh — điều đó có nghĩa là: companion object có thể implement interface, có thể là receiver của extension function, và có thể được truyền như object. Khi Java gọi companion object, phải dùng `MyClass.Companion.method()` trừ khi annotate `@JvmStatic`. Điểm mạnh: factory pattern trở nên linh hoạt hơn khi companion object implement interface factory.

</details>

<details>
<summary><strong>Object expression khác anonymous class Java như thế nào?</strong></summary>

**A:** Cả hai đều tạo implementation inline không cần đặt tên class. Điểm khác: (1) Kotlin object expression có thể implement **nhiều interface** cùng lúc (`object : InterfaceA, InterfaceB { }`); (2) Kotlin object expression có thể có state (properties) và được gán vào biến với kiểu cụ thể; (3) Kotlin object expression có thể **extend class** đồng thời implement interface; (4) Anonymous class Java tạo `OuterClass$1.class` file, Kotlin tương tự nhưng syntactically gọn hơn.

</details>

<details>
<summary><strong>Object declaration (singleton) có thread-safe không?</strong></summary>

**A:** Có. Object declaration tận dụng **JVM class loading mechanism** — class chỉ được khởi tạo một lần bởi class loader và JVM đảm bảo thread safety trong quá trình này. Đây là **lazy initialization** vì object chỉ được tạo khi lần đầu tiên được truy cập. So với Singleton pattern trong Java (double-checked locking), Kotlin object declaration đơn giản hơn nhiều và đảm bảo thread safety mà không cần viết boilerplate synchronization code.

</details>
