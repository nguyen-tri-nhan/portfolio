---
key: kotlin-coroutines-advanced
title: "Coroutines Nâng Cao — Exception & Cancellation"
crumb: "13. Kotlin > Coroutines"
---

Xử lý ngoại lệ và hủy bỏ coroutine đúng cách là chìa khóa để viết concurrent code an toàn — Kotlin cung cấp `CoroutineExceptionHandler`, `SupervisorJob`, và cancellation protocol riêng.

## Điểm Chính

- Exception trong `launch` không được catch → uncaught exception handler (crash hoặc log).
- Exception trong `async` chỉ throw khi gọi `await()` — phải wrap bằng try-catch tại đó.
- **`CoroutineExceptionHandler`**: handler cho uncaught exception của `launch` coroutines.
- **`SupervisorJob`**: con fail không cancel anh chị em — ngược với `Job` thông thường.
- **`CancellationException`**: Kotlin dùng exception đặc biệt này để cancel, không nên catch nó rộng rãi.
- **`isActive`** và **`ensureActive()`**: kiểm tra xem coroutine còn active không để dừng kịp thời.
- **`withTimeout(ms)`**: cancel coroutine sau timeout, throw `TimeoutCancellationException`.
- **`withTimeoutOrNull(ms)`**: như `withTimeout` nhưng trả về `null` thay vì throw exception.

## Ví Dụ Code

*Exception handling, SupervisorJob, và timeout patterns*

```kotlin
import kotlinx.coroutines.*

// 1. Exception trong launch — cần CoroutineExceptionHandler
fun exceptionInLaunch() = runBlocking {
    val handler = CoroutineExceptionHandler { context, exception ->
        println("Caught by handler: ${exception.message}")
        // Log, alert, metrics...
    }

    val job = launch(handler) {
        delay(100)
        throw RuntimeException("Something went wrong!")
    }
    job.join()
    println("Program continues after handled exception")
}

// 2. Exception trong async — throw khi await()
fun exceptionInAsync() = runBlocking {
    val deferred = async {
        delay(100)
        throw RuntimeException("Async failed!")
        "result"
    }

    try {
        val result = deferred.await()  // Exception throw ở đây
        println(result)
    } catch (e: RuntimeException) {
        println("Caught from async: ${e.message}")
    }
}

// 3. Job thường: một con fail → cancel tất cả siblings
fun regularJobBehavior() = runBlocking {
    try {
        coroutineScope {
            val job1 = launch {
                delay(1000)
                println("Job1 done")  // Không bao giờ in vì Job2 fail trước
            }
            val job2 = launch {
                delay(100)
                throw RuntimeException("Job2 failed!")  // Hủy toàn bộ scope
            }
        }
    } catch (e: RuntimeException) {
        println("coroutineScope caught: ${e.message}")
    }
}

// 4. SupervisorJob: một con fail không ảnh hưởng các con khác
fun supervisorJobBehavior() = runBlocking {
    val supervisor = SupervisorJob()
    val handler = CoroutineExceptionHandler { _, e ->
        println("Handler: ${e.message}")
    }
    val scope = CoroutineScope(coroutineContext + supervisor + handler)

    scope.launch {
        delay(100)
        throw RuntimeException("Child 1 failed!")  // Chỉ child1 bị cancel
    }

    scope.launch {
        delay(500)
        println("Child 2 completed successfully")  // Vẫn chạy bình thường
    }

    delay(1000)
    supervisor.cancel()
}

// 5. Cancellation — ensureActive() và isActive
suspend fun longRunningTask() {
    repeat(1000) { i ->
        ensureActive()  // Throw CancellationException nếu đã bị cancel
        // Hoặc: if (!isActive) return
        println("Processing item $i")
        delay(10)
    }
}

// CancellationException không nên catch tổng quát
suspend fun correctCancellationHandling() {
    try {
        longRunningTask()
    } catch (e: CancellationException) {
        throw e  // Phải re-throw! Không được swallow CancellationException
    } catch (e: Exception) {
        println("Business exception: ${e.message}")
    }
}

// 6. withTimeout và withTimeoutOrNull
suspend fun timeoutExamples() {
    // withTimeout — throw TimeoutCancellationException sau 500ms
    try {
        val result = withTimeout(500L) {
            delay(1000)  // Sẽ bị cancel sau 500ms
            "completed"
        }
    } catch (e: TimeoutCancellationException) {
        println("Operation timed out")
    }

    // withTimeoutOrNull — trả về null thay vì throw
    val result = withTimeoutOrNull(500L) {
        delay(1000)
        "completed"
    }
    println(result ?: "Timed out gracefully")  // "Timed out gracefully"

    // Pattern thực tế: retry với timeout
    val apiResult = withTimeoutOrNull(3000L) {
        retryApiCall()
    } ?: throw RuntimeException("API call timed out after 3 seconds")
}

suspend fun retryApiCall(): String {
    delay(200)
    return "API Response"
}
```

## Ứng Dụng Thực Tế

Trong Spring Boot, `CoroutineExceptionHandler` tích hợp với logging framework để log uncaught exception trong background jobs. `SupervisorJob` rất phổ biến trong `@Service` beans xử lý nhiều independent background tasks — một task fail không làm hỏng các task khác. `withTimeoutOrNull` dùng cho external API calls với SLA cụ thể để tránh request bị block quá lâu.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Coroutine cancellation hoạt động như thế nào?</strong></summary>

**A:** Khi gọi `job.cancel()`, Kotlin đặt flag cancel trên coroutine. Coroutine sẽ bị cancel tại điểm **suspension** tiếp theo — `delay()`, `yield()`, các suspend functions khác sẽ throw `CancellationException`. Nếu coroutine chạy CPU-intensive code không có suspension point, nó không bị cancel ngay — phải kiểm tra `isActive` hoặc gọi `ensureActive()` định kỳ. Quan trọng: **không được swallow `CancellationException`** bằng `catch (e: Exception)` mà không re-throw, vì điều này phá vỡ cancellation protocol.

</details>

<details>
<summary><strong>SupervisorJob khác Job thường như thế nào? Khi nào dùng?</strong></summary>

**A:** Với **`Job`** thường (default): một child coroutine fail → cancel tất cả siblings và parent — phù hợp khi các tasks phụ thuộc nhau (một fail thì không tiếp tục được). Với **`SupervisorJob`**: child fail không ảnh hưởng các siblings — phù hợp cho các tasks độc lập nhau. Ví dụ thực tế: service xử lý nhiều user notifications độc lập — dùng SupervisorJob để một notification fail không cancel tất cả cái còn lại. `supervisorScope { }` cũng tương đương cho scoped version.

</details>

<details>
<summary><strong>withTimeout và withTimeoutOrNull — khi nào dùng cái nào?</strong></summary>

**A:** Dùng **`withTimeout`** khi timeout là lỗi thực sự cần xử lý như exception — caller biết và có kế hoạch handle `TimeoutCancellationException`. Dùng **`withTimeoutOrNull`** khi timeout là trường hợp bình thường cần xử lý gracefully — trả về null và xử lý theo flow bình thường thay vì exception. Pattern phổ biến: `withTimeoutOrNull(3000) { callApi() } ?: fallbackValue`. Cẩn thận: `TimeoutCancellationException` là subclass của `CancellationException` — nếu catch `CancellationException` tổng quát sẽ swallow timeout exception.

</details>
