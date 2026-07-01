---
key: kotlin-higher-order-functions
title: "Higher-Order Functions & Inline Functions"
crumb: "13. Kotlin > Kotlin Features"
---

Higher-order function nhận function làm tham số hoặc trả về function — nền tảng của functional programming trong Kotlin. `inline` function loại bỏ overhead của lambda allocation.

## Điểm Chính

- **Function type**: `(Int, String) -> Boolean` — hàm nhận Int và String, trả về Boolean.
- **Lambda syntax**: `{ param -> body }` hoặc `{ body }` nếu một tham số (dùng `it`).
- **Trailing lambda**: nếu lambda là tham số cuối, có thể đặt ngoài ngoặc — `list.forEach { println(it) }`.
- **`inline` function**: compiler copy body của function vào call site — không tạo lambda object, không tốn heap.
- **`reified`**: chỉ dùng với `inline` — cho phép truy cập kiểu generic (`T::class`) tại runtime.
- **`noinline`**: đánh dấu tham số lambda không được inline — dùng khi cần lưu lambda vào variable.
- **`crossinline`**: lambda được inline nhưng không được dùng `return` non-local.
- Không có `inline`, mỗi lambda tạo một anonymous class object tại heap — chi phí đáng kể trong hot loop.

## Ví Dụ Code

*Function types, lambda, inline, reified*

```kotlin
// 1. Function types và higher-order function
fun operate(x: Int, y: Int, operation: (Int, Int) -> Int): Int = operation(x, y)

val sum = operate(3, 4) { a, b -> a + b }      // 7
val product = operate(3, 4) { a, b -> a * b }  // 12

// Function reference — dùng :: thay vì viết lambda
fun add(a: Int, b: Int): Int = a + b
val result = operate(3, 4, ::add)

// 2. Returning function
fun multiplier(factor: Int): (Int) -> Int = { x -> x * factor }

val double = multiplier(2)
val triple = multiplier(3)
println(double(5))  // 10
println(triple(5))  // 15

// 3. Trailing lambda syntax
fun measureTime(block: () -> Unit): Long {
    val start = System.currentTimeMillis()
    block()
    return System.currentTimeMillis() - start
}

val time = measureTime {
    Thread.sleep(100)
    println("Operation done")
}

// 4. inline function — loại bỏ lambda object allocation
inline fun <T> measureTimeInline(block: () -> T): Pair<T, Long> {
    val start = System.nanoTime()
    val result = block()  // Được copy trực tiếp vào call site
    return result to (System.nanoTime() - start)
}

// Non-local return — chỉ có trong inline lambda
inline fun findFirst(list: List<Int>, predicate: (Int) -> Boolean): Int? {
    for (item in list) {
        if (predicate(item)) return item  // return từ enclosing function (non-local)
    }
    return null
}

// 5. reified — truy cập kiểu generic tại runtime
// Không có reified — KHÔNG COMPILE: T::class
// inline fun <T> createInstance(): T = T() // Error: Cannot use T as reified type

// Có reified — OK
inline fun <reified T> createFromJson(json: String): T {
    // Có thể dùng T::class.java tại runtime
    return objectMapper.readValue(json, T::class.java)
}

inline fun <reified T> List<*>.filterIsType(): List<T> =
    filterIsInstance<T>()  // filterIsInstance cũng dùng reified

// Ví dụ thực tế với reified
inline fun <reified T : Any> findBeans(context: Any): List<T> {
    // Có thể lấy T::class.java để query Spring ApplicationContext
    return listOf()
}

// 6. noinline — lambda không được inline
inline fun processWithCallback(
    data: List<Int>,
    noinline callback: (Int) -> Unit,  // Không inline vì cần store nó
    transform: (Int) -> Int
): List<Int> {
    val transformed = data.map(transform)  // transform được inline
    transformed.forEach(callback)          // callback không inline (cần pass sang func khác)
    return transformed
}

// 7. crossinline — inline nhưng no non-local return
inline fun runAsync(crossinline block: () -> Unit) {
    Thread {
        block()  // block() không được dùng 'return' để return ra ngoài runAsync
    }.start()
}

// 8. Real-world: custom scope functions
inline fun <T, R> T.mapIf(condition: Boolean, block: (T) -> R): R? =
    if (condition) block(this) else null

inline fun <T> T.applyIf(condition: Boolean, block: T.() -> Unit): T {
    if (condition) block()
    return this
}

// Dùng trong Builder pattern
data class QueryBuilder(
    var table: String = "",
    var limit: Int = 100,
    var offset: Int = 0,
    var condition: String? = null
)

fun buildQuery(isPaginated: Boolean, hasFilter: Boolean): QueryBuilder {
    return QueryBuilder(table = "users")
        .applyIf(isPaginated) { limit = 20; offset = 0 }
        .applyIf(hasFilter) { condition = "active = true" }
}

// Placeholder for demo
val objectMapper = object {
    fun <T> readValue(json: String, clazz: Class<T>): T = throw NotImplementedError()
}
```

## Ứng Dụng Thực Tế

Trong Spring Boot, inline higher-order functions phổ biến cho: `withTransaction { }` wrappers, retry logic (`retryWithBackoff(times = 3) { apiCall() }`), và timing/metrics collection. `reified` rất hữu ích khi làm việc với Jackson (deserialize JSON sang generic type) hoặc Spring ApplicationContext. Kotlin standard library (map, filter, forEach...) đều là inline functions — đây là lý do collection operations trong Kotlin không tốn thêm memory cho lambda objects.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao cần `inline` function? Không có thì có vấn đề gì?</strong></summary>

**A:** Không có `inline`, mỗi lambda tạo một **anonymous class object** tại heap — gọi lambda là virtual dispatch qua interface. Trong hot loop xử lý millions records, điều này tạo GC pressure đáng kể. `inline` giải quyết bằng cách **copy body** của function vào call site tại compile time — không có object allocation, không virtual dispatch. Trade-off: code size tăng (inlining). Rule: inline function ngắn với lambda params trong hot path → nên inline; function dài hoặc lambda được store/pass around → không nên inline.

</details>

<details>
<summary><strong>Reified type parameter là gì và khi nào cần?</strong></summary>

**A:** Bình thường, generic type bị **type erasure** tại runtime — `List<String>` và `List<Int>` đều là `List<?>` tại runtime, không thể làm `T::class`. `reified` kết hợp với `inline` cho phép compiler giữ lại thông tin type tại call site — code được copy vào nơi gọi với type thực tế thay thế T. Dùng khi: deserialize JSON (`objectMapper.readValue<User>(json)`), check type (`filterIsInstance<AdminUser>()`), reflection operations, hoặc khi cần `Class<T>` mà không muốn caller phải pass `T::class.java` manually.

</details>

<details>
<summary><strong>Function type trong Kotlin khác gì SAM interface trong Java?</strong></summary>

**A:** **SAM (Single Abstract Method) interface** trong Java (`Runnable`, `Comparator`, `Predicate<T>`) là interface với một method duy nhất — Java 8 cho phép dùng lambda cho SAM. **Function type** trong Kotlin (`() -> Unit`, `(T) -> Boolean`) là first-class citizen — built vào type system, không cần define interface. Kotlin tự generate `FunctionN` interfaces (Function0, Function1...) cho function types. Khi gọi Java SAM từ Kotlin, Kotlin tự convert lambda sang SAM (`button.setOnClickListener { handle(it) }`). Ưu điểm function type: concise, type-safe, không cần import interface riêng.

</details>
