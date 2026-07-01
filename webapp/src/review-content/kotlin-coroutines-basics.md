---
key: kotlin-coroutines-basics
title: "Coroutines Cơ Bản trong Kotlin"
crumb: "13. Kotlin > Coroutines"
---

Coroutine là đơn vị thực thi nhẹ (lightweight) có thể suspend và resume mà không block thread, cho phép viết code async theo phong cách tuần tự dễ đọc.

## Điểm Chính

- **`suspend` function**: hàm có thể bị tạm dừng (suspend) và tiếp tục (resume) mà không block thread — chỉ gọi được từ coroutine hoặc suspend function khác.
- **`launch`**: coroutine builder trả về `Job`, fire-and-forget, exception ném vào handler.
- **`async`**: coroutine builder trả về `Deferred<T>`, dùng `await()` để lấy kết quả — như Promise/Future.
- **`runBlocking`**: block thread hiện tại cho đến khi coroutine hoàn thành — dùng cho `main()` hoặc test, không dùng trong production async code.
- **`CoroutineScope`**: container quản lý lifecycle của các coroutines — khi scope bị hủy, tất cả coroutines bên trong bị cancel.
- **`Job`**: handle để cancel, join, hoặc kiểm tra trạng thái coroutine.
- **Structured concurrency**: coroutine con phải hoàn thành trước cha — không bao giờ leak coroutine.
- Một coroutine không chiếm một thread — hàng nghìn coroutines có thể chạy trên vài thread.

## Ví Dụ Code

*Coroutine builders, suspend function, và structured concurrency*

```kotlin
import kotlinx.coroutines.*

// suspend function — có thể suspend mà không block thread
suspend fun fetchUser(id: Long): String {
    delay(100)  // suspend 100ms (không block thread, khác Thread.sleep())
    return "User_$id"
}

suspend fun fetchUserScore(userId: String): Int {
    delay(150)
    return 42
}

// launch — fire and forget, không lấy kết quả
fun launchExample() = runBlocking {
    val job: Job = launch {
        println("Coroutine started on: ${Thread.currentThread().name}")
        delay(500)
        println("Coroutine done")
    }
    println("Main continues while coroutine runs")
    job.join()  // chờ coroutine hoàn thành
    println("After join")
}

// async — lấy kết quả bất đồng bộ
fun asyncExample() = runBlocking {
    // Sequential — tổng thời gian: 100 + 150 = 250ms
    val user1 = fetchUser(1L)
    val score1 = fetchUserScore(user1)
    println("Sequential: $user1, score: $score1")

    // Parallel với async — tổng thời gian: max(100, 150) = 150ms
    val userDeferred: Deferred<String> = async { fetchUser(2L) }
    val scoreDeferred: Deferred<Int> = async { fetchUserScore("User_2") }

    val user2 = userDeferred.await()
    val score2 = scoreDeferred.await()
    println("Parallel: $user2, score: $score2")
}

// CoroutineScope — quản lý lifecycle
class UserService(private val scope: CoroutineScope) {
    fun startBackgroundSync() {
        scope.launch {
            while (isActive) {  // kiểm tra scope vẫn active
                println("Syncing...")
                delay(5000)
            }
        }
    }
}

// Structured concurrency — coroutine con fail → cha cancel tất cả
fun structuredConcurrencyExample() = runBlocking {
    try {
        coroutineScope {  // tạo scope con — chờ tất cả child hoàn thành
            launch {
                delay(100)
                println("Child 1 done")
            }
            launch {
                delay(50)
                throw RuntimeException("Child 2 failed!")  // cancel toàn bộ scope
            }
        }
    } catch (e: RuntimeException) {
        println("Caught: ${e.message}")  // "Caught: Child 2 failed!"
    }
    println("After coroutineScope") // vẫn chạy vì exception đã được catch
}

// Real-world: Spring Boot + coroutines
// @RestController
// class UserController(private val userService: UserService) {
//     @GetMapping("/users/{id}")
//     suspend fun getUser(@PathVariable id: Long): UserResponse {
//         // suspend function — Spring WebFlux handle coroutine automatically
//         val user = userService.findUser(id)
//         val profile = userService.fetchProfile(user)
//         return UserResponse(user, profile)
//     }
// }
```

## Ứng Dụng Thực Tế

Spring Boot với `spring-boot-starter-webflux` và `kotlinx-coroutines-reactor` cho phép viết endpoint là `suspend` function, Kotlin tự chuyển đổi sang reactive Mono/Flux. Đây là cách viết reactive code mà không phải học RxJava hay Project Reactor API phức tạp — code trông giống blocking nhưng thực tế non-blocking.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Coroutine khác gì Thread?</strong></summary>

**A:** **Thread** là đơn vị OS-level, tốn khoảng 1MB stack memory, context switch tốn kém. **Coroutine** là lightweight — hàng nghìn coroutines có thể chạy trên vài thread, stack chỉ vài KB, context switch được JVM/Kotlin runtime quản lý hiệu quả. Quan trọng hơn: khi coroutine `suspend`, nó giải phóng thread để thread xử lý việc khác, không block. Thread khi blocked (ví dụ `Thread.sleep()`) vẫn chiếm tài nguyên. `delay()` của coroutines suspend mà không block thread — đây là khác biệt cốt lõi.

</details>

<details>
<summary><strong>`launch` vs `async` — khi nào dùng cái nào?</strong></summary>

**A:** Dùng **`launch`** khi không cần kết quả trả về — fire-and-forget, ví dụ: ghi log, gửi notification, background sync. Dùng **`async`** khi cần kết quả — trả về `Deferred<T>`, gọi `await()` để lấy giá trị. Pattern phổ biến: dùng nhiều `async { }` để chạy song song các tác vụ độc lập, sau đó `awaitAll()` hoặc gọi `await()` lần lượt. Cẩn thận: `async` exception không throw ngay — throw khi gọi `await()`, phải dùng try-catch tại đó.

</details>

<details>
<summary><strong>Structured concurrency là gì và tại sao quan trọng?</strong></summary>

**A:** Structured concurrency đảm bảo coroutine con không sống lâu hơn coroutine cha — khi scope cha bị hủy hoặc throw exception, tất cả coroutines con cũng bị cancel. Điều này ngăn **coroutine leak** (coroutine tiếp tục chạy trong background mà không ai kiểm soát). Trong thực tế: Android lifecycle scope tự cancel khi Activity bị destroy; Spring request scope tự cancel khi request hoàn thành. So với Java threads, thread không có cơ chế tương tự — rất dễ leak thread không được quản lý.

</details>
