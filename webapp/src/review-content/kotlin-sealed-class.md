---
key: kotlin-sealed-class
title: "Sealed Class trong Kotlin"
crumb: "13. Kotlin > Kotlin Cơ Bản"
---

Sealed class là một class phân cấp đóng (closed hierarchy) — tập hợp các subclass được biết tại compile time, cho phép `when` expression kiểm tra toàn diện (exhaustive) mà không cần `else`.

## Điểm Chính

- Tất cả subclass của sealed class phải nằm **cùng package** (Kotlin 1.5+, trước đó cùng file).
- `when` expression trên sealed class là **exhaustive**: compiler báo lỗi nếu thiếu nhánh — không cần `else`.
- Khác **enum**: mỗi subclass có thể có state riêng và nhiều instances; enum chỉ là singleton constants.
- Khác **abstract class**: abstract class có thể được kế thừa từ bất kỳ đâu, sealed class thì không.
- Subclass có thể là `data class`, `class`, `object`, hoặc thậm chí là `sealed class` khác (nested hierarchy).
- Rất phù hợp cho mô hình **Result/Either** để biểu diễn thành công hoặc lỗi có kiểu.
- Kết hợp tốt với `when` để xử lý **State** trong UI (Loading, Success, Error).

## Ví Dụ Code

*Sealed class mô hình API response và xử lý exhaustive khi*

```kotlin
// Sealed class cho API response — thay thế exception-based error handling
sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val code: Int, val message: String) : ApiResult<Nothing>()
    object Loading : ApiResult<Nothing>()
    data class NetworkError(val throwable: Throwable) : ApiResult<Nothing>()
}

// Nested sealed hierarchy
sealed class PaymentError {
    sealed class CardError : PaymentError() {
        data class Declined(val reason: String) : CardError()
        object Expired : CardError()
        object InvalidCvv : CardError()
    }
    data class InsufficientFunds(val required: Long, val available: Long) : PaymentError()
    object ServiceUnavailable : PaymentError()
}

// Service trả về sealed class thay vì throw exception
fun fetchUser(id: Long): ApiResult<User> {
    return try {
        val user = userRepository.findById(id)
            ?: return ApiResult.Error(404, "User not found")
        ApiResult.Success(user)
    } catch (e: Exception) {
        ApiResult.NetworkError(e)
    }
}

// when expression — EXHAUSTIVE: compiler báo lỗi nếu thiếu nhánh
fun handleUserResult(result: ApiResult<User>): String {
    return when (result) {
        is ApiResult.Success -> "Welcome, ${result.data.name}"    // smart cast tự động
        is ApiResult.Error -> "Error ${result.code}: ${result.message}"
        is ApiResult.NetworkError -> "Network issue: ${result.throwable.message}"
        ApiResult.Loading -> "Please wait..."
        // Không cần else — compiler kiểm tra tất cả nhánh
    }
}

// Xử lý nested sealed class
fun describePaymentError(error: PaymentError): String = when (error) {
    is PaymentError.CardError.Declined -> "Card declined: ${error.reason}"
    PaymentError.CardError.Expired -> "Card has expired"
    PaymentError.CardError.InvalidCvv -> "Invalid CVV"
    is PaymentError.InsufficientFunds ->
        "Need ${error.required}, only ${error.available} available"
    PaymentError.ServiceUnavailable -> "Payment service is down"
}

// So sánh với enum — enum không có state riêng
enum class OrderStatus { PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED }

// Sealed class — mỗi state có data riêng
sealed class OrderState {
    object Pending : OrderState()
    data class Processing(val estimatedTime: Int) : OrderState()
    data class Shipped(val trackingNumber: String) : OrderState()
    data class Delivered(val deliveredAt: String) : OrderState()
    data class Cancelled(val reason: String) : OrderState()
}

data class User(val name: String)
val userRepository = object {
    fun findById(id: Long): User? = if (id == 1L) User("Nhan") else null
}
```

## Ứng Dụng Thực Tế

Trong Spring Boot, sealed class thường dùng để mô hình hóa kết quả service (thay vì throw exception cho các lỗi nghiệp vụ), giúp caller phải xử lý tất cả trường hợp tường minh. Trong Android và Kotlin frontend, sealed class là pattern tiêu chuẩn cho UI State (Loading/Success/Error). So với Java, không có tương đương trực tiếp — Java phải dùng abstract class + instanceof checks mà không có exhaustiveness.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sealed class khác gì với enum class?</strong></summary>

**A:** **Enum** là tập hợp các constant singleton — mỗi value chỉ tồn tại một instance, không có state riêng biệt cho mỗi instance. **Sealed class** cho phép mỗi subclass có data riêng, constructor riêng, và có nhiều instances. Ví dụ: `Error(code=404, message="Not found")` và `Error(code=500, message="Server error")` là hai instances khác nhau của cùng subclass. Dùng enum khi các variant không có state; dùng sealed class khi mỗi variant cần carry data.

</details>

<details>
<summary><strong>Tại sao `when` trên sealed class là exhaustive?</strong></summary>

**A:** Compiler biết tất cả subclass của sealed class tại compile time (vì chúng phải khai báo trong cùng package). Khi dùng `when` như một **expression** (gán giá trị hoặc return), compiler kiểm tra tất cả nhánh có được xử lý không. Nếu thiếu — compile error. Đây là lợi thế lớn so với Java `instanceof` chains hay switch statements: thêm subclass mới sẽ tự động tạo compile error ở tất cả nơi cần xử lý, không bao giờ bị thiếu sót.

</details>

<details>
<summary><strong>Use case điển hình của sealed class trong API response?</strong></summary>

**A:** Pattern `sealed class Result<T>` với `Success(data: T)` và `Failure(error: AppError)` rất phổ biến để tránh exception-driven flow cho lỗi nghiệp vụ. Service trả về `Result<User>` thay vì throw `UserNotFoundException`. Caller dùng `when (result)` buộc phải xử lý cả hai trường hợp tường minh. So với `Optional` của Java, sealed class mang theo thông tin lỗi; so với `throws`, sealed class là explicit trong type signature và không cần try-catch.

</details>
