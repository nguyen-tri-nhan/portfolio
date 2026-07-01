---
key: kotlin-extension-functions
title: "Extension Functions trong Kotlin"
crumb: "13. Kotlin > Kotlin Features"
---

Extension function cho phép thêm method vào class hiện có mà không cần kế thừa hay sửa source code — giải quyết nhu cầu utility function mà Java phải dùng static helper class.

## Điểm Chính

- Cú pháp: `fun ClassName.methodName(params): ReturnType { /* this = instance */ }`.
- Extension function **không thực sự modify class** — được compile thành static method nhận receiver làm tham số.
- **Member function luôn thắng** khi cùng tên và cùng signature — extension không thể override member.
- **Extension property**: `val String.firstChar: Char get() = this[0]` — không thể có backing field.
- Extension trên **nullable receiver**: `fun String?.orEmpty()` — có thể gọi trên null object.
- Extension function không thể truy cập `private` hoặc `protected` members của class.
- Được resolve tại **compile time** dựa trên kiểu khai báo, không phải runtime type (no polymorphism).
- Import tường minh hoặc dùng `import package.extension` — không tự động có trong tất cả files.

## Ví Dụ Code

*Extension functions, properties, và nullable receiver*

```kotlin
// 1. Basic extension function
fun String.isValidEmail(): Boolean =
    isNotBlank() && contains("@") && contains(".")

fun String.capitalize(): String =
    if (isEmpty()) this else this[0].uppercaseChar() + substring(1)

// Dùng như member function
val email = "user@example.com"
println(email.isValidEmail())   // true
println("kotlin".capitalize())  // Kotlin

// 2. Extension property — không có backing field
val String.firstChar: Char
    get() = if (isEmpty()) throw NoSuchElementException("Empty string") else this[0]

val String.lastChar: Char
    get() = if (isEmpty()) throw NoSuchElementException("Empty string") else this[length - 1]

val String.wordCount: Int
    get() = trim().split("\\s+".toRegex()).count { it.isNotEmpty() }

// 3. Extension trên nullable receiver
fun String?.orDefault(default: String = ""): String = this ?: default

fun String?.isNullOrEmpty(): Boolean = this == null || this.isEmpty()

val nullStr: String? = null
println(nullStr.orDefault("fallback"))  // "fallback"
println(nullStr.isNullOrEmpty())        // true

// 4. Extension trên collection
fun <T> List<T>.secondOrNull(): T? = if (size >= 2) this[1] else null

fun <T> MutableList<T>.swap(i: Int, j: Int) {
    val tmp = this[i]; this[i] = this[j]; this[j] = tmp
}

// 5. Extension trên custom class — không cần sửa class
data class Money(val amount: Long, val currency: String)

fun Money.toDisplayString(): String = "${currency} ${String.format("%.2f", amount / 100.0)}"
fun Money.isZero(): Boolean = amount == 0L
operator fun Money.plus(other: Money): Money {
    require(currency == other.currency) { "Cannot add different currencies" }
    return Money(amount + other.amount, currency)
}

val price = Money(10000, "USD")
println(price.toDisplayString())  // USD 100.00
println(price + Money(5000, "USD"))  // Money(amount=15000, currency=USD)

// 6. Member wins over extension — extension không thể override member
class MyClass {
    fun greet() = "Member greet"
}

fun MyClass.greet() = "Extension greet"  // Extension với cùng signature

fun shadowingDemo() {
    val obj = MyClass()
    println(obj.greet())  // "Member greet" — member luôn thắng
}

// 7. Extension resolve tại compile time (không polymorphic)
open class Base
class Derived : Base()

fun Base.name() = "Base extension"
fun Derived.name() = "Derived extension"

fun printName(b: Base) {
    println(b.name())  // "Base extension" — dù b là Derived
}

fun compileTimeResolutionDemo() {
    printName(Derived())  // Vẫn in "Base extension"
}

// 8. Java gọi Kotlin extension — như static method
// Kotlin: fun String.double() = this + this
// Java: StringExtensionsKt.double("hello")  // "hellohello"

// 9. Real-world: Spring Boot response builder extension
// data class ApiResponse<T>(val data: T?, val error: String?, val success: Boolean)
//
// fun <T> T.toSuccessResponse() = ApiResponse(data = this, error = null, success = true)
// fun String.toErrorResponse() = ApiResponse<Nothing>(data = null, error = this, success = false)
//
// // Trong controller:
// return user.toSuccessResponse()
// return "User not found".toErrorResponse()
```

## Ứng Dụng Thực Tế

Extension functions thay thế hoàn toàn utility/helper classes của Java (`StringUtils`, `DateUtils`). Trong Spring Boot, thường tạo extension cho Entity-to-DTO conversion (`fun User.toDto(): UserDto`), response wrapping, hoặc validation logic. Lưu ý: extension không thể truy cập private members nên không phù hợp cho mọi trường hợp — đôi khi vẫn cần utility class với dependency injection.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Extension function khác gì utility class (static methods) của Java?</strong></summary>

**A:** Về runtime, extension function **giống** utility class — được compile thành static method với receiver là tham số đầu tiên. Nhưng về API, extension function **trông như** member method, gọi bằng dot notation (`"hello".double()` thay vì `StringUtils.double("hello")`), IDE auto-complete gợi ý, và code dễ đọc hơn. Ngoài ra, extension function có thể dùng Kotlin features (nullable receiver, generics với reified), và không cần import utility class — chỉ import extension function cụ thể cần dùng.

</details>

<details>
<summary><strong>Extension function có thể truy cập private members của class không?</strong></summary>

**A:** Không. Extension function được compile như static method bên ngoài class — không có quyền truy cập `private` hay `protected` members. Chỉ có thể truy cập `public` và `internal` (cùng module) members. Đây là khác biệt cơ bản với member function. Nếu cần truy cập private state, phải: (1) expose thêm public method/property trong class; (2) dùng member function thay; (3) dùng companion object extension với factory access.

</details>

<details>
<summary><strong>Java gọi Kotlin extension function như thế nào?</strong></summary>

**A:** Kotlin extension function được compile thành `static` method trong class có tên `[FileName]Kt`. Ví dụ: extension trong file `StringUtils.kt` → class `StringUtilsKt`. Java gọi: `StringUtilsKt.isValidEmail("test@example.com")`. Có thể đổi tên class bằng `@file:JvmName("StringUtils")` annotation ở đầu file để Java gọi `StringUtils.isValidEmail(...)`. Extension function không trông như method gọi tự nhiên từ Java — đây là lý do nên wrap Kotlin API cho Java consumers.

</details>
