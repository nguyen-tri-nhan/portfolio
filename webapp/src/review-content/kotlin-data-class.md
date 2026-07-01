---
key: kotlin-data-class
title: "Data Class trong Kotlin"
crumb: "13. Kotlin > Kotlin Cơ Bản"
---

Data class tự động sinh `equals()`, `hashCode()`, `toString()`, `copy()`, và các hàm `componentN()` dựa trên các thuộc tính khai báo trong primary constructor.

## Điểm Chính

- Khai báo bằng từ khóa `data class`; ít nhất một tham số trong primary constructor.
- **`equals()` và `hashCode()`** so sánh theo giá trị của tất cả properties trong constructor, không theo tham chiếu.
- **`toString()`** trả về chuỗi dạng `ClassName(prop1=val1, prop2=val2)` tiện dụng cho logging.
- **`copy()`** tạo bản sao nông (shallow copy) với khả năng override một số field — bất biến một cách tiện lợi.
- **`componentN()`** cho phép destructuring: `val (name, age) = user`.
- Properties khai báo trong body class (không phải constructor) **không** được đưa vào `equals/hashCode/copy`.
- Data class không thể `abstract`, `open`, `sealed`, hoặc `inner`.
- So với **Java Records** (Java 16+): tương đương nhưng Kotlin data class có `copy()` và destructuring tốt hơn.

## Ví Dụ Code

*Data class với copy(), destructuring, và so sánh giá trị*

```kotlin
data class User(
    val id: Long,
    val name: String,
    val email: String,
    val role: Role = Role.USER
)

enum class Role { USER, ADMIN }

fun main() {
    val user1 = User(id = 1, name = "Nhan", email = "nhan@example.com")
    val user2 = User(id = 1, name = "Nhan", email = "nhan@example.com")

    // equals() so sánh giá trị, không phải tham chiếu
    println(user1 == user2)        // true
    println(user1 === user2)       // false (khác object)

    // toString() tự động
    println(user1)
    // Output: User(id=1, name=Nhan, email=nhan@example.com, role=USER)

    // copy() - shallow copy, chỉ thay đổi field cần thiết (immutable update pattern)
    val admin = user1.copy(role = Role.ADMIN, email = "admin@example.com")
    println(admin)
    // Output: User(id=1, name=Nhan, email=admin@example.com, role=ADMIN)

    // Destructuring (componentN)
    val (id, name, email) = user1
    println("ID: $id, Name: $name, Email: $email")

    // Trong vòng lặp
    val users = listOf(user1, admin)
    for ((userId, userName) in users) {
        println("$userId -> $userName")
    }

    // Dùng trong Map
    val userMap = mapOf(user1.id to user1, admin.id to admin)
    userMap.forEach { (key, value) -> println("$key: ${value.name}") }
}

// Property trong body KHÔNG được đưa vào equals/hashCode
data class Product(val id: Long, val name: String) {
    var description: String = "" // không ảnh hưởng equals/hashCode
}

fun bodyPropertyDemo() {
    val p1 = Product(1, "Widget").apply { description = "Blue widget" }
    val p2 = Product(1, "Widget").apply { description = "Red widget" }
    println(p1 == p2) // true — description không được xét
}
```

## Ứng Dụng Thực Tế

Trong Spring Boot, data class thường dùng làm DTO (Data Transfer Object) hoặc response body vì `toString()` tiện cho logging và `equals()`/`hashCode()` hoạt động đúng khi dùng trong collection. Tính năng `copy()` rất hữu ích khi update một phần entity mà không làm thay đổi object gốc (immutable state pattern).

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Data class khác gì với regular class trong Kotlin?</strong></summary>

**A:** Data class tự động sinh `equals()`, `hashCode()`, `toString()`, `copy()` và các hàm `componentN()` dựa trên properties trong primary constructor. Regular class không có các hàm này — `equals()` và `hashCode()` mặc định so sánh theo tham chiếu như Java. Data class phù hợp cho các object thuần dữ liệu (DTO, domain model), trong khi regular class phù hợp khi cần kế thừa hoặc logic phức tạp hơn.

</details>

<details>
<summary><strong>copy() là deep copy hay shallow copy? Có vấn đề gì không?</strong></summary>

**A:** `copy()` là **shallow copy** — các properties là object reference vẫn trỏ đến cùng một object. Ví dụ: `data class Order(val items: MutableList<Item>)`, khi `copy()` thì `items` trong bản sao và bản gốc vẫn cùng trỏ vào một list. Nếu mutate list đó, cả hai bị ảnh hưởng. Giải pháp: dùng immutable collection (`List` thay vì `MutableList`) hoặc tự implement deep copy khi cần thiết.

</details>

<details>
<summary><strong>Destructuring declaration hoạt động như thế nào?</strong></summary>

**A:** Kotlin sinh ra các hàm `component1()`, `component2()`,... tương ứng với thứ tự các thuộc tính trong constructor. `val (name, age) = user` thực chất là `val name = user.component1(); val age = user.component2()`. Thứ tự quan trọng: nếu đổi thứ tự properties trong constructor, destructuring code sẽ bị sai ngầm mà không báo lỗi compile. Nên cẩn thận khi refactor data class đang được destructuring.

</details>
