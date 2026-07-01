---
key: kotlin-null-safety
title: "Null Safety trong Kotlin"
crumb: "13. Kotlin > Kotlin Cơ Bản"
---

Kotlin tích hợp null safety vào hệ thống kiểu, phân biệt rõ ràng nullable (`String?`) và non-null (`String`) để loại bỏ `NullPointerException` tại compile time thay vì runtime.

## Điểm Chính

- **`String`** không bao giờ null; **`String?`** có thể null — compiler kiểm tra bắt buộc xử lý null.
- **`?.`** (safe call): gọi method chỉ khi object không null, trả về `null` nếu null.
- **`?:`** (Elvis operator): trả về giá trị mặc định nếu biểu thức bên trái là null.
- **`!!`** (non-null assertion): ép buộc non-null, ném `KotlinNullPointerException` nếu null — dùng như phương án cuối cùng.
- **`let`**: thực thi block chỉ khi giá trị không null, phổ biến với `?.let { }`.
- **`as?`** (safe cast): trả về `null` thay vì ném `ClassCastException` nếu cast thất bại.
- **Platform types** từ Java (ví dụ `String!`): Kotlin không biết nullable hay không — cần kiểm tra thủ công.
- Ưu tiên `?.` và `?:` hơn `!!` để tránh crash bất ngờ trong production.

## Ví Dụ Code

*Null safety operators và xử lý Java interop*

```kotlin
// Nullable vs non-null types
fun greet(name: String): String = "Hello, $name"  // name không thể null
fun greetNullable(name: String?): String {         // name có thể null
    // Safe call + Elvis operator
    return "Hello, ${name?.uppercase() ?: "Stranger"}"
}

data class Address(val city: String?, val country: String)
data class User(val name: String, val address: Address?)

fun getUserCity(user: User?): String {
    // Chaining safe calls — trả về null nếu bất kỳ bước nào null
    return user?.address?.city ?: "Unknown City"
}

// let — thực thi block chỉ khi không null
fun sendEmail(email: String?) {
    email?.let { validEmail ->
        println("Sending email to $validEmail")
        // ... thực sự gửi email
    } ?: println("No email address provided")
}

// Safe cast (as?)
fun processInput(input: Any): Int {
    val number = input as? Int       // null nếu không phải Int, không throw exception
    return number?.times(2) ?: -1
}

// !! — chỉ dùng khi chắc chắn không null (ví dụ: đã validate trước đó)
fun processValidatedUser(userId: String?) {
    // Đã validate trước khi gọi hàm này
    val id = userId!!  // Throw NPE nếu null — nên tránh
    println("Processing user: $id")
}

// Java interop — platform types
// Java: public class UserService { public String getUserName(Long id) { ... } }
// Kotlin gọi Java code:
fun javaInteropExample(javaUserService: JavaUserService) {
    val name: String? = javaUserService.getUserName(1L) // Nên khai báo nullable
    // hoặc annotate Java code với @Nullable / @NotNull

    // Nếu khai báo non-null mà Java trả về null → NPE lúc runtime
    // val name: String = javaUserService.getUserName(1L) // Nguy hiểm!

    name?.let { println("User: $it") } ?: println("User not found")
}

// Các pattern thực tế trong Spring Boot
fun processRequest(request: Map<String, String>): String {
    val userId = request["userId"]          // String? vì Map có thể không có key
    val userName = request["userName"]?.trim()?.takeIf { it.isNotEmpty() }

    return buildString {
        append("User ID: ${userId ?: "anonymous"}")
        append(", Name: ${userName ?: "unknown"}")
    }
}
```

## Ứng Dụng Thực Tế

Trong Spring Boot với Kotlin, null safety giúp giảm đáng kể `NullPointerException` khi xử lý request parameters, database results, hoặc external API responses. Khi tích hợp với Java libraries, cần chú ý platform types — nên dùng `@Nullable`/`@NonNull` annotations trong Java code hoặc khai báo tường minh nullable trong Kotlin để compiler hỗ trợ kiểm tra.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào dùng `?` và khi nào dùng `!!`?</strong></summary>

**A:** Dùng `?` (nullable type cùng với `?.` và `?:`) là cách tiếp cận an toàn và nên ưu tiên — xử lý null một cách tường minh mà không crash. Dùng `!!` chỉ khi bạn **chắc chắn 100%** giá trị không null tại điểm đó nhưng compiler không thể tự suy ra (ví dụ sau một kiểm tra điều kiện phức tạp). Trong thực tế production, `!!` là dấu hiệu cần xem xét lại thiết kế — nếu thấy nhiều `!!` trong codebase, thường là có vấn đề với quản lý null.

</details>

<details>
<summary><strong>Elvis operator `?:` dùng cho những trường hợp nào?</strong></summary>

**A:** Elvis operator `?:` trả về biểu thức bên phải nếu bên trái là null. Dùng cho: (1) **giá trị mặc định** — `val name = user?.name ?: "Anonymous"`; (2) **throw exception sớm** — `val id = userId ?: throw IllegalArgumentException("ID required")`; (3) **early return** — `val user = findUser(id) ?: return null`. Trong Kotlin, `?:` kết hợp với `return` và `throw` là pattern phổ biến để viết code defensive mà vẫn ngắn gọn.

</details>

<details>
<summary><strong>Platform types từ Java interop gây ra vấn đề gì?</strong></summary>

**A:** Khi Kotlin gọi Java code không có `@Nullable`/`@NotNull` annotation, kiểu trả về là **platform type** (ví dụ `String!`). Compiler không biết nullable hay không nên **không kiểm tra** — NPE có thể xảy ra lúc runtime. Giải pháp: (1) annotate Java code với JSR-305 annotations (`@Nullable`, `@NotNull`) để Kotlin nhận diện; (2) khi nhận giá trị từ Java, khai báo tường minh là nullable (`String?`) để buộc xử lý null; (3) dùng Kotlin extension functions wrap Java API để thêm null safety.

</details>
