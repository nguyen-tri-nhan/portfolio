---
key: kotlin-delegation
title: "Delegation trong Kotlin — Class & Property Delegates"
crumb: "13. Kotlin > Kotlin Features"
---

Kotlin hỗ trợ delegation pattern natively qua từ khóa `by` — class delegation thay thế inheritance bằng composition, property delegation tách logic truy cập property ra ngoài class.

## Điểm Chính

- **Class delegation** (`class A : Interface by B()`): A delegate tất cả method của Interface sang instance B — thay thế inheritance bằng composition.
- **`by lazy`**: property được tính toán lần đầu tiên truy cập, kết quả được cache — thread-safe by default.
- **`by Delegates.observable`**: callback được gọi mỗi khi property thay đổi — reactive property.
- **`by Delegates.vetoable`**: callback có thể từ chối thay đổi bằng cách trả về `false`.
- **`by map`**: property lấy giá trị từ Map — hữu ích cho dynamic properties hoặc JSON deserialization.
- **Custom delegate**: implement `getValue(thisRef, property)` và `setValue(...)` — tái sử dụng access logic.
- `by lazy` mặc định là `LazyThreadSafetyMode.SYNCHRONIZED` — an toàn nhưng có overhead.
- Khác **`lateinit var`**: `by lazy` là val (immutable sau init), `lateinit` là var có thể set nhiều lần.

## Ví Dụ Code

*Class delegation, lazy, observable, và custom delegate*

```kotlin
import kotlin.properties.Delegates
import kotlin.reflect.KProperty

// 1. Class delegation — composition thay inheritance
interface Logger {
    fun log(message: String)
    fun warn(message: String) = log("[WARN] $message")
}

class ConsoleLogger : Logger {
    override fun log(message: String) = println("[LOG] $message")
}

class FileLogger : Logger {
    override fun log(message: String) = println("[FILE] $message")
}

// UserService delegate Logger sang ConsoleLogger — không cần override từng method
class UserService(logger: Logger = ConsoleLogger()) : Logger by logger {
    fun createUser(name: String) {
        log("Creating user: $name")   // Gọi logger.log()
        warn("Validation skipped")   // Gọi logger.warn() (default impl)
    }
}

// 2. by lazy — tính toán lần đầu truy cập, cache kết quả
class HeavyService {
    // Chỉ khởi tạo khi lần đầu dùng — expensive operation
    val databaseConnection: String by lazy {
        println("Connecting to database...")
        "jdbc:postgresql://localhost/db"
    }

    // Thread safety mode
    val cachedData: List<String> by lazy(LazyThreadSafetyMode.NONE) {
        // NONE — không thread-safe nhưng nhanh hơn nếu single-thread
        listOf("data1", "data2", "data3")
    }
}

// 3. Delegates.observable — reactive property
class UIViewModel {
    var userName: String by Delegates.observable("") { property, oldValue, newValue ->
        println("${property.name} changed: '$oldValue' → '$newValue'")
        // Trigger UI update, notify observers, etc.
    }

    var count: Int by Delegates.observable(0) { _, old, new ->
        if (new > old) println("Count increased to $new")
    }
}

// 4. Delegates.vetoable — có thể reject thay đổi
class AgeValidator {
    var age: Int by Delegates.vetoable(0) { _, _, newValue ->
        val accepted = newValue in 0..150
        if (!accepted) println("Invalid age: $newValue — rejected")
        accepted  // return false để reject
    }
}

// 5. by map — property từ Map (dynamic configuration)
class Config(private val map: Map<String, Any?>) {
    val host: String by map
    val port: Int by map
    val debug: Boolean by map
}

fun mapDelegateDemo() {
    val config = Config(mapOf(
        "host" to "localhost",
        "port" to 8080,
        "debug" to true
    ))
    println("${config.host}:${config.port} (debug=${config.debug})")
}

// 6. Custom delegate
class ValidatedString(private val regex: Regex) {
    private var value: String = ""

    operator fun getValue(thisRef: Any?, property: KProperty<*>): String = value

    operator fun setValue(thisRef: Any?, property: KProperty<*>, newValue: String) {
        require(regex.matches(newValue)) {
            "${property.name} must match ${regex.pattern}, got: '$newValue'"
        }
        value = newValue
    }
}

class UserProfile {
    var email: String by ValidatedString(Regex("[\\w.]+@[\\w.]+\\.[a-z]{2,}"))
    var phone: String by ValidatedString(Regex("\\+?\\d{10,15}"))
}

// 7. by lazy vs lateinit
class DemoClass {
    // by lazy: val, thread-safe, computed on first access
    val expensiveComputation: String by lazy {
        computeExpensiveValue()
    }

    // lateinit: var, must be initialized before use, not thread-safe by default
    lateinit var injectedDependency: String

    fun initialize() {
        injectedDependency = "Injected!"  // Must be set before accessing
    }

    // Kiểm tra lateinit đã được init chưa
    fun checkInit(): Boolean = ::injectedDependency.isInitialized

    private fun computeExpensiveValue(): String = "Computed"
}

// 8. Real-world: Spring-like property delegate
class EnvProperty(private val envKey: String, private val default: String = "") {
    operator fun getValue(thisRef: Any?, property: KProperty<*>): String =
        System.getenv(envKey) ?: default
}

object AppSettings {
    val databaseUrl: String by EnvProperty("DATABASE_URL", "jdbc:h2:mem:test")
    val apiKey: String by EnvProperty("API_KEY")
    val serverPort: String by EnvProperty("PORT", "8080")
}
```

## Ứng Dụng Thực Tế

Trong Spring Boot, `by lazy` phổ biến cho expensive initializations như logger instances (`val log by lazy { LoggerFactory.getLogger(javaClass) }`) hoặc compiled regex patterns. Class delegation dùng để thêm behavior (logging, caching, retry) vào service mà không dùng AOP. Custom delegate như `EnvProperty` trên rất hữu ích cho configuration management, đọc environment variables theo cách Kotlin-idiomatic.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>`by lazy` khác `lateinit` như thế nào? Khi nào dùng cái nào?</strong></summary>

**A:** **`by lazy`**: `val` (immutable sau init), khởi tạo lần đầu truy cập, thread-safe mặc định, có thể dùng cho bất kỳ kiểu nào kể cả nullable. **`lateinit var`**: `var` (có thể reassign), phải gán trước khi dùng (throw `UninitializedPropertyAccessException` nếu quên), chỉ dùng cho non-null reference types (không dùng được với `Int`, `Boolean`). Dùng `by lazy` khi giá trị expensive và chỉ biết lúc runtime; dùng `lateinit` khi dependency được inject sau constructor (ví dụ Spring `@Autowired`, Android lifecycle callbacks).

</details>

<details>
<summary><strong>Class delegation (by keyword) dùng cho use case nào?</strong></summary>

**A:** Class delegation thực hiện **Composition over Inheritance** một cách tường minh. Use cases: (1) **Decorator pattern** — thêm behavior (logging, caching, retry) vào một interface implementation mà không sửa class gốc; (2) **Mixin behavior** — một class "borrow" implementation từ nhiều helper objects; (3) **Adapter** — wrap một implementation để conform với interface mới. Ví dụ: `class CachingRepository(repo: UserRepository) : UserRepository by repo` — override chỉ method cần cache, tất cả method khác delegate về `repo` mà không cần boilerplate forwarding code.

</details>

<details>
<summary><strong>observable delegate có thể dùng thay cho custom getter/setter không?</strong></summary>

**A:** Có, với trường hợp đơn giản. `Delegates.observable` phù hợp khi cần **phản ứng sau thay đổi** — log, notify, trigger side effect. Khác với custom getter/setter ở chỗ: observable không thể chặn giá trị (dùng `vetoable` nếu cần); observable nhận cả oldValue và newValue tiện cho audit log. Custom getter/setter linh hoạt hơn (transform giá trị, validate phức tạp, return khác giá trị set). Trong Android, `observable` thường dùng để notify UI khi ViewModel state thay đổi mà không cần `LiveData` hay `StateFlow`.

</details>
