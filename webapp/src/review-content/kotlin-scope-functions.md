---
key: kotlin-scope-functions
title: "Scope Functions: let, run, with, apply, also"
crumb: "13. Kotlin > Kotlin Features"
---

Scope functions thực thi một block code trong context của một object — khác biệt chính là cách tham chiếu context object (`this` vs `it`) và giá trị trả về (object itself vs kết quả lambda).

## Điểm Chính

- **`let`**: context object là `it`, trả về **kết quả lambda** — dùng với nullable (`?.let`), transform value.
- **`run`**: context object là `this`, trả về **kết quả lambda** — dùng để khởi tạo object + tính toán kết quả.
- **`with`**: nhận object làm argument, context object là `this`, trả về **kết quả lambda** — không extension, không dùng với nullable.
- **`apply`**: context object là `this`, trả về **chính object đó** — builder pattern, cấu hình object.
- **`also`**: context object là `it`, trả về **chính object đó** — side effects, logging, validation.
- Hai chiều phân biệt: **context object** (`this` — implicit / `it` — explicit) và **return value** (lambda result / object itself).
- Tránh chain scope functions quá nhiều lớp — khó đọc và debug.
- Ưu tiên readability: nếu không rõ dùng scope function nào, dùng code thường sẽ rõ hơn.

## Ví Dụ Code

*Từng scope function với use case thực tế*

```kotlin
data class User(
    var name: String = "",
    var email: String = "",
    var age: Int = 0
)

data class Order(val id: Long, val items: List<String>, var status: String = "PENDING")

// 1. let — it, lambda result — nullable check + transform
fun letExample(email: String?) {
    // Dùng phổ biến nhất với nullable
    email?.let { validEmail ->
        println("Sending to: $validEmail")
        sendEmail(validEmail)
    }

    // Transform: map một giá trị sang kiểu khác
    val length: Int? = email?.let { it.length }

    // Non-null scope
    val nameLength = "Kotlin".let {
        println("Processing: $it")
        it.length  // Return value
    }
    println(nameLength)  // 6
}

// 2. run — this, lambda result — init + compute
fun runExample(): String {
    // Khởi tạo và tính toán ngay
    val result = User().run {
        name = "Nhan"           // this.name (implicit)
        email = "nhan@x.com"
        "User created: $name"  // Return giá trị này
    }
    return result  // "User created: Nhan"
}

// run không extension — như with nhưng là extension function
fun runAsLambda(user: User?): String? = user?.run {
    "$name ($email)"  // null-safe với ?.run
}

// 3. with — this, lambda result — grouping operations on object
fun withExample(user: User): String {
    return with(user) {
        println("Name: $name")
        println("Email: $email")
        "Summary: $name, $email"  // Return value
    }
}

// 4. apply — this, object itself — builder pattern, configuration
fun applyExample(): User {
    return User().apply {
        name = "Alice"           // this.name
        email = "alice@test.com"
        age = 30
    }  // Returns User object
}

// Builder pattern với apply
fun buildOrder(id: Long): Order {
    return Order(id, listOf("item1", "item2")).apply {
        status = "PROCESSING"
        println("Order $id created with ${items.size} items")
    }
}

// 5. also — it, object itself — side effects (logging, validation)
fun alsoExample(): User {
    return User().apply {
        name = "Bob"
        email = "bob@test.com"
    }.also { user ->
        println("Created user: ${user.name}")  // Logging
        require(user.email.contains("@")) { "Invalid email" }  // Validation
    }
    // Returns User object
}

// Chaining: apply để config, also để log
fun chainedExample(id: Long): Order {
    return Order(id, listOf("product-1"))
        .apply { status = "CONFIRMED" }
        .also { println("Order confirmed: $it") }
        .also { sendConfirmationEmail(it) }
    // Returns Order
}

// 6. Bảng so sánh trong code
fun comparisonSummary() {
    val user = User(name = "Test", email = "test@x.com", age = 25)

    // let: it, lambda result
    val nameUpper: String = user.let { it.name.uppercase() }

    // run: this, lambda result
    val summary: String = user.run { "$name - $email" }

    // with: this, lambda result (không phải extension)
    val info: String = with(user) { "$name is $age years old" }

    // apply: this, object
    val configured: User = User().apply { name = "New"; age = 18 }

    // also: it, object
    val logged: User = user.also { println("User: ${it.name}") }
}

fun sendEmail(email: String) = println("Email sent to $email")
fun sendConfirmationEmail(order: Order) = println("Confirmation sent for order ${order.id}")
```

## Ứng Dụng Thực Tế

Trong Spring Boot, `apply` thường dùng để config RestTemplate, HttpHeaders, hoặc Entity objects; `let` dùng với nullable results từ repository (`findById().orElse(null)?.let { }`); `also` dùng để log trước khi return entity; `run` dùng trong test để setup + assert trong cùng một block ngắn gọn.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>let và run khác gì nhau?</strong></summary>

**A:** Cả hai đều trả về **kết quả lambda**, nhưng khác nhau ở context object: `let` dùng `it` (explicit parameter, có thể đặt tên), `run` dùng `this` (implicit, như bên trong class). Dùng `let` khi cần tham chiếu tường minh đến object (đặc biệt khi chain nhiều bước hoặc với nullable `?.let`). Dùng `run` khi muốn làm việc với nhiều properties của object mà không cần prefix `it.` liên tục — tương tự như `with` nhưng là extension function nên dùng được với nullable.

</details>

<details>
<summary><strong>apply và also khác gì nhau?</strong></summary>

**A:** Cả hai đều trả về **chính object đó**, nhưng khác context object: `apply` dùng `this` (implicit receiver), `also` dùng `it` (explicit parameter). `apply` phù hợp để **cấu hình** object — gán properties mà không cần prefix (`name = "x"` thay vì `it.name = "x"`). `also` phù hợp cho **side effects** — logging, validation, không nên modify object trong `also` vì dùng `it` cho thấy bạn chỉ "observe" object. Pattern: `build().apply { configure() }.also { log(it) }`.

</details>

<details>
<summary><strong>Chaining scope functions có nên không?</strong></summary>

**A:** Có thể chain nhưng cần cân nhắc readability. Chain hợp lý: `user.apply { activate() }.also { logActivation(it) }` — rõ ràng ý định. Chain không nên: `user?.let { it.orders.run { filter { it.active }.let { it.size } } }` — quá nhiều `it` lồng nhau, khó hiểu. Nguyên tắc: nếu chain làm code khó đọc hơn so với imperative style, hãy tách ra. Kotlin code review thường comment về chain scope functions quá phức tạp — readability quan trọng hơn conciseness.

</details>
