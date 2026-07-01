---
key: kotlin-flow
title: "Kotlin Flow — Reactive Streams với Coroutines"
crumb: "13. Kotlin > Coroutines"
---

Flow là cold async stream trong Kotlin — phát nhiều giá trị theo thời gian, tích hợp tự nhiên với coroutines và thay thế RxJava trong nhiều use case.

## Điểm Chính

- **Cold Flow**: chỉ bắt đầu phát khi có collector — mỗi collector nhận stream riêng từ đầu.
- **`flow { emit(value) }`**: tạo cold flow — code trong block chạy mỗi khi collect.
- **`collect { }`**: terminal operator, trigger flow bắt đầu — là suspend function.
- **`collectLatest { }`**: cancel collector đang chạy khi có giá trị mới — tốt cho search debounce.
- **Operators**: `map`, `filter`, `flatMapMerge`, `combine`, `zip`, `onEach`, `catch`, `flowOn`.
- **`SharedFlow`**: hot flow — phát values bất kể có collector hay không, nhiều collectors nhận cùng giá trị.
- **`StateFlow`**: hot flow giữ trạng thái hiện tại, collector nhận value ngay lập tức — thay thế LiveData.
- **`flowOn(dispatcher)`**: chạy upstream flow trên dispatcher khác — thay vì `withContext` bên trong flow.

## Ví Dụ Code

*Cold Flow, hot flow, operators, và StateFlow*

```kotlin
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

// 1. Cold Flow cơ bản
fun numbersFlow(): Flow<Int> = flow {
    println("Flow started")
    for (i in 1..5) {
        delay(100)
        emit(i)  // phát giá trị
    }
}

fun coldFlowDemo() = runBlocking {
    // Mỗi collect chạy flow từ đầu
    numbersFlow().collect { value -> println("Collector 1: $value") }
    numbersFlow().collect { value -> println("Collector 2: $value") }
}

// 2. Operators
fun operatorsDemo() = runBlocking {
    flow { (1..10).forEach { emit(it) } }
        .filter { it % 2 == 0 }           // 2, 4, 6, 8, 10
        .map { it * it }                   // 4, 16, 36, 64, 100
        .onEach { println("Processing: $it") }
        .catch { e -> println("Error: ${e.message}") }  // handle errors
        .collect { println("Result: $it") }
}

// 3. flatMapMerge — merge concurrent flows
fun flatMapDemo() = runBlocking {
    flow { emit(1); delay(100); emit(2) }
        .flatMapMerge { id ->
            flow {
                delay(50)
                emit("Result for $id")
            }
        }
        .collect { println(it) }
}

// 4. combine — kết hợp 2 flows
fun combineDemo() = runBlocking {
    val userFlow = flow { emit("Alice"); delay(100); emit("Bob") }
    val scoreFlow = flow { emit(100); delay(150); emit(200) }

    userFlow.combine(scoreFlow) { user, score ->
        "$user: $score"
    }.collect { println(it) }  // Emits khi bất kỳ flow nào có giá trị mới
}

// 5. zip — pair values 1-1
fun zipDemo() = runBlocking {
    val names = flowOf("Alice", "Bob", "Charlie")
    val ages = flowOf(25, 30, 35)

    names.zip(ages) { name, age -> "$name is $age" }
        .collect { println(it) }
    // Alice is 25, Bob is 30, Charlie is 35
}

// 6. flowOn — upstream chạy trên IO dispatcher
fun flowOnDemo(): Flow<String> = flow {
    // Chạy trên Dispatchers.IO (DB query, file read)
    emit(fetchFromDatabase())
    emit(fetchFromDatabase())
}.flowOn(Dispatchers.IO)  // Không dùng withContext bên trong flow

suspend fun fetchFromDatabase(): String {
    delay(100) // simulate DB query
    return "DB Result"
}

// 7. StateFlow — hot flow giữ state
class SearchViewModel {
    private val _searchQuery = MutableStateFlow("")  // Initial value required
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _results = MutableStateFlow<List<String>>(emptyList())
    val results: StateFlow<List<String>> = _results.asStateFlow()

    fun updateQuery(query: String) {
        _searchQuery.value = query
    }

    fun startSearch(scope: CoroutineScope) {
        scope.launch {
            searchQuery
                .debounce(300)  // Chờ 300ms sau lần type cuối
                .filter { it.length >= 2 }
                .distinctUntilChanged()
                .collectLatest { query ->  // Cancel tìm kiếm cũ khi query mới
                    val results = performSearch(query)
                    _results.value = results
                }
        }
    }

    private suspend fun performSearch(query: String): List<String> {
        delay(500)  // Simulate API call
        return listOf("Result for $query")
    }
}

// 8. SharedFlow — broadcast to multiple collectors
class EventBus {
    private val _events = MutableSharedFlow<String>(
        replay = 0,        // Không replay cho collectors mới
        extraBufferCapacity = 64
    )
    val events: SharedFlow<String> = _events.asSharedFlow()

    suspend fun publish(event: String) = _events.emit(event)
}
```

## Ứng Dụng Thực Tế

Trong Spring Boot, Flow tích hợp tốt với WebFlux — controller có thể trả về `Flow<T>` và Spring tự chuyển sang streaming response. `StateFlow` là standard trong Android ViewModel để expose UI state. So với RxJava, Flow tích hợp tự nhiên hơn với coroutines, không cần learn Rx operators phức tạp, và cancellation được xử lý tự động qua structured concurrency.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Flow khác gì RxJava Observable?</strong></summary>

**A:** Cả hai đều là reactive streams nhưng: (1) **Flow tích hợp coroutines** — suspend operators, structured concurrency, cancellation tự động; RxJava có threading model riêng (subscribeOn/observeOn). (2) **API đơn giản hơn** — Flow có ít operators nhưng đủ dùng, không có Flowable/Observable/Single như RxJava. (3) **Backpressure**: Flow handle backpressure qua suspension tự nhiên; RxJava cần Flowable cho backpressure. (4) Nếu đã dùng Kotlin coroutines, Flow là lựa chọn tự nhiên; nếu project Java dùng RxJava sẵn, không cần migrate.

</details>

<details>
<summary><strong>StateFlow khác SharedFlow như thế nào?</strong></summary>

**A:** **`StateFlow`** luôn có một giá trị hiện tại, collector nhận ngay value đó khi subscribe, chỉ emit khi value thực sự thay đổi (distinctUntilChanged built-in). Phù hợp cho **UI state** — màn hình luôn cần state hiện tại khi vào. **`SharedFlow`** không có initial state, cấu hình được replay buffer, có thể emit cùng value nhiều lần. Phù hợp cho **events** — navigation, toast messages mà không cần replay. Rule: "muốn biết state hiện tại" → StateFlow; "muốn nhận events lẻ" → SharedFlow.

</details>

<details>
<summary><strong>Cold flow và hot flow khác nhau như thế nào?</strong></summary>

**A:** **Cold flow**: chỉ phát khi có collector, mỗi collector nhận stream riêng từ đầu — giống như video on-demand. Code trong `flow { }` block chạy lại cho mỗi collector. Phù hợp cho database queries, API calls per request. **Hot flow** (SharedFlow, StateFlow): phát bất kể có collector hay không, nhiều collectors nhận cùng stream — giống live TV. Phù hợp cho UI state, event bus, sensor data. Flow thông thường (cold) là default; chuyển sang hot với `.shareIn()` hoặc `.stateIn()` operators.

</details>
