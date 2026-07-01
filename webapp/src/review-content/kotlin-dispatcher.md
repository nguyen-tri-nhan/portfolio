---
key: kotlin-dispatcher
title: "Coroutine Dispatchers trong Kotlin"
crumb: "13. Kotlin > Coroutines"
---

Dispatcher quyết định coroutine chạy trên thread nào — Kotlin cung cấp các Dispatcher tối ưu cho từng loại tác vụ: IO-bound, CPU-bound, và UI thread.

## Điểm Chính

- **`Dispatchers.Default`**: thread pool cho CPU-intensive tasks — sorting, parsing JSON, tính toán nặng. Số thread = số CPU cores.
- **`Dispatchers.IO`**: thread pool lớn hơn (64 threads mặc định) cho blocking I/O — database, file, HTTP calls blocking.
- **`Dispatchers.Main`**: UI thread (Android/Swing) — update UI, không dùng trong backend.
- **`Dispatchers.Unconfined`**: bắt đầu trên thread hiện tại, resume trên bất kỳ thread nào — không nên dùng trong production.
- **`withContext(dispatcher)`**: switch dispatcher trong coroutine — không tạo coroutine mới, block cho đến khi xong.
- IO và Default chia sẻ thread pool nên `withContext` giữa chúng không tốn kém context switch.
- Dùng **`Dispatchers.IO`** cho JDBC/JPA blocking calls; dùng reactive driver thì không cần (tự non-blocking).
- Custom dispatcher: `Executors.newFixedThreadPool(n).asCoroutineDispatcher()` cho isolation.

## Ví Dụ Code

*Dispatcher selection và withContext để switch context*

```kotlin
import kotlinx.coroutines.*
import java.util.concurrent.Executors

// 1. Default — CPU intensive
suspend fun processLargeData(data: List<Int>): List<Int> =
    withContext(Dispatchers.Default) {
        // Chạy trên thread pool tối ưu cho CPU
        data.filter { it % 2 == 0 }
            .map { it * it }
            .sorted()
    }

// 2. IO — blocking operations (JDBC, file read, HTTP blocking client)
suspend fun findUserById(id: Long): String =
    withContext(Dispatchers.IO) {
        // Simulate JDBC blocking call
        Thread.sleep(100)  // Blocking — phải dùng Dispatchers.IO
        "User_$id"
    }

// 3. withContext để switch giữa các dispatcher
suspend fun handleUserRequest(id: Long): Map<String, Any> {
    // Fetch từ DB — IO bound
    val user = withContext(Dispatchers.IO) {
        findUserById(id)
    }

    // Process — CPU bound
    val processedData = withContext(Dispatchers.Default) {
        processLargeData(listOf(1, 2, 3, 4, 5, 6, 7, 8))
    }

    return mapOf("user" to user, "data" to processedData)
}

// 4. Parallel IO operations với async
suspend fun fetchMultipleResources(ids: List<Long>): List<String> =
    withContext(Dispatchers.IO) {
        ids.map { id ->
            async { findUserById(id) }  // Parallel requests trong IO pool
        }.awaitAll()
    }

// 5. Custom dispatcher cho isolation
val dedicatedPool = Executors.newFixedThreadPool(4)
    .asCoroutineDispatcher()

suspend fun criticalPaymentOperation(amount: Long): Boolean =
    withContext(dedicatedPool) {
        // Payment ops chạy trên dedicated pool
        println("Processing payment $amount on ${Thread.currentThread().name}")
        true
    }

// 6. Launch với explicit dispatcher
fun launchWithDispatcher() = runBlocking {
    // IO task trong background
    val ioJob = launch(Dispatchers.IO) {
        println("IO task: ${Thread.currentThread().name}")
        delay(100)
    }

    // CPU task trong background
    val cpuJob = launch(Dispatchers.Default) {
        println("CPU task: ${Thread.currentThread().name}")
        delay(100)
    }

    joinAll(ioJob, cpuJob)
}

// 7. So sánh: launch với dispatcher vs withContext
suspend fun compareApproaches() {
    // Cách 1: withContext — đợi kết quả, cùng coroutine
    val result = withContext(Dispatchers.IO) {
        "result from IO"  // Trả về kết quả
    }
    println("Got: $result")

    // Cách 2: launch với dispatcher — fire-and-forget, KHÔNG lấy kết quả trực tiếp
    val job = CoroutineScope(Dispatchers.IO).launch {
        "result"  // Không thể return từ đây
    }
    job.join()
    // Không có cách lấy "result" từ launch trực tiếp
}

// 8. Spring Boot context — thường không cần chỉ định dispatcher
// Spring WebFlux tự chạy coroutines trên reactor thread pool
// Chỉ cần withContext(Dispatchers.IO) cho blocking JDBC calls:
// @Service
// class UserService(private val jdbcTemplate: JdbcTemplate) {
//     suspend fun findUser(id: Long): User = withContext(Dispatchers.IO) {
//         jdbcTemplate.queryForObject("SELECT * FROM users WHERE id = ?", ...)
//     }
// }
```

## Ứng Dụng Thực Tế

Trong Spring Boot với Kotlin coroutines, rule of thumb: dùng `Dispatchers.IO` cho bất kỳ JDBC/JPA call nào vì chúng blocking. Nếu dùng R2DBC (reactive database driver), không cần `withContext` vì R2DBC đã non-blocking. Với Spring WebFlux, coroutines chạy trên Netty event loop — không được block thread này, luôn wrap blocking calls trong `withContext(Dispatchers.IO)`.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Dispatchers.IO và Dispatchers.Default khác gì nhau? Khi nào dùng cái nào?</strong></summary>

**A:** **`Dispatchers.Default`** dùng thread pool bằng số CPU cores — tối ưu cho **CPU-intensive tasks** như tính toán, parsing, sorting vì thêm thread không giúp ích gì khi CPU đã full. **`Dispatchers.IO`** dùng thread pool lớn hơn (64 threads hoặc theo config) — tối ưu cho **blocking I/O** vì phần lớn thời gian thread đang chờ network/disk, nhiều thread = nhiều concurrent requests. Rule: database query → IO; JSON parsing → Default; gọi suspend function non-blocking → không cần withContext.

</details>

<details>
<summary><strong>withContext(Dispatchers.IO) khác gì launch(Dispatchers.IO) { }?</strong></summary>

**A:** **`withContext`** là sequential — suspend coroutine hiện tại, switch sang dispatcher mới, chạy block, trả về kết quả, rồi resume trên dispatcher cũ. Không tạo coroutine mới. Dùng khi cần kết quả trả về. **`launch`** tạo coroutine mới chạy song song với coroutine hiện tại — fire-and-forget, không block caller, không trả về kết quả trực tiếp. Trong hầu hết trường hợp switching context để lấy data từ DB/file, `withContext` là lựa chọn đúng; `launch` dùng khi muốn background task thực sự song song.

</details>

<details>
<summary><strong>Dispatchers.Main dùng trong backend Spring Boot không?</strong></summary>

**A:** Không — `Dispatchers.Main` dành cho UI frameworks như Android (main thread) hoặc JavaFX/Swing. Trong Spring Boot backend, không có UI thread. Nếu import `kotlinx-coroutines-android` nhầm trong backend project, `Dispatchers.Main` sẽ throw `IllegalStateException`. Spring WebFlux có reactor event loop tương đương nhưng được quản lý bởi reactor-core, không liên quan `Dispatchers.Main`. Backend Kotlin coroutines chỉ cần Default và IO, hoặc inject `CoroutineDispatcher` qua Spring DI để dễ test.

</details>
