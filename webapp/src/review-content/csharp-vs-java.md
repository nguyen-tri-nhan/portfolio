---
key: csharp-vs-java
title: "C# vs Java — Syntax & Concept Mapping"
crumb: "16. .NET > C# Cơ Bản"
---

C# và Java sinh ra cùng thời kỳ và chia sẻ nhiều concept nền tảng — OOP, GC, JIT, generics. Java dev có thể adopt C# trong vài tuần vì mental model gần như giống nhau, chỉ khác syntax và một số tính năng C# có mà Java không có.

## Điểm Chính

- **Properties**: C# có built-in `{ get; set; }` syntax — không cần Lombok hay tự viết getter/setter như Java
- **Records**: C# record tương tự Kotlin data class — immutable, auto `Equals/HashCode/ToString` — mạnh hơn Java record vì có `with` expression
- **LINQ**: Language-Integrated Query — tương tự Java Stream nhưng có query syntax (`from x in ...`) và mạnh hơn với expression trees
- **async/await**: First-class language feature — tự nhiên hơn Java CompletableFuture, không cần chain callback
- **Nullable reference types**: C# 8+ phân biệt `string` và `string?` tại compile time — giống Kotlin null safety
- **Extension methods**: Thêm method vào class có sẵn mà không kế thừa — Java không có native support
- **var**: Type inference đầy đủ — giống Kotlin `val/var` nhưng chỉ có `var` (mutable)
- **using**: Equivalent của Java try-with-resources nhưng ngắn gọn hơn
- **Pattern matching**: C# có switch expression + `is` pattern mạnh tương tự Java 21 sealed class + pattern matching

## Ví Dụ Code

```csharp
// ============ PROPERTIES vs LOMBOK ============
// Java (Lombok)
// @Data public class User { private String name; private int age; }

// C# — built-in property syntax
public class User {
    public string Name { get; set; }
    public int Age { get; init; }  // init-only (immutable sau construction)
}

// Auto-property với default value
public class Config {
    public int Timeout { get; set; } = 30;
    public string BaseUrl { get; set; } = "https://api.example.com";
}

// ============ RECORD vs KOTLIN DATA CLASS ============
// Kotlin: data class User(val name: String, val age: Int)

// C# record — tương đương
public record User(string Name, int Age);

// with expression (Kotlin có copy(), Java record không có):
var admin = new User("Alice", 30);
var updatedAdmin = admin with { Age = 31 };  // immutable copy với field mới

// ============ LINQ vs STREAM ============
var users = new List<User> {
    new("Alice", 30), new("Bob", 17), new("Charlie", 25)
};

// Java Stream:
// users.stream().filter(u -> u.getAge() >= 18).map(User::getName).collect(Collectors.toList())

// C# LINQ — method syntax (tương tự Stream)
var adults = users
    .Where(u => u.Age >= 18)
    .Select(u => u.Name)
    .OrderBy(n => n)
    .ToList();

// C# LINQ — query syntax (không có trong Java)
var adultsQuery =
    from u in users
    where u.Age >= 18
    orderby u.Name
    select u.Name;

// ============ ASYNC/AWAIT vs COMPLETABLEFUTURE ============
// Java:
// CompletableFuture<User> future = userRepo.findById(id)
//     .thenCompose(u -> orderRepo.findByUser(u.getId()))
//     .thenApply(orders -> process(orders));

// C# — đọc như synchronous code
public async Task<UserDto> GetUserWithOrdersAsync(int id) {
    var user = await _userRepo.FindByIdAsync(id);    // await Task<User>
    var orders = await _orderRepo.FindByUserAsync(user.Id);
    return new UserDto(user, orders);
}

// Task.WhenAll — tương tự CompletableFuture.allOf()
var (users2, orders) = await (
    _userRepo.GetAllAsync(),
    _orderRepo.GetAllAsync()
).WaitAsync(CancellationToken.None);

var results = await Task.WhenAll(
    _service.CallApi1Async(),
    _service.CallApi2Async(),
    _service.CallApi3Async()
);

// ============ NULLABLE REFERENCE TYPES ============
// Kotlin:
// val city: String = user?.address?.city ?: "Unknown"

// C# 8+ (tương tự Kotlin null safety)
string? nullableName = null;    // explicit nullable
string requiredName = "Alice";  // non-nullable, compiler warning nếu assign null

// Null-conditional operator (giống Kotlin ?.)
var city = user?.Address?.City ?? "Unknown";

// ============ EXTENSION METHODS ============
// Java không có — phải dùng utility class StringUtils.isValidEmail(str)

// C#: thêm method vào class có sẵn
public static class StringExtensions {
    public static bool IsValidEmail(this string str)
        => str.Contains('@') && str.Contains('.');

    public static string OrDefault(this string? str, string defaultValue)
        => str ?? defaultValue;
}

// Dùng như method của String:
"user@example.com".IsValidEmail();  // true
((string?)null).OrDefault("N/A");  // "N/A"

// ============ USING vs TRY-WITH-RESOURCES ============
// Java: try (Connection conn = ds.getConnection()) { ... }

// C# — using declaration (không cần block)
using var conn = new SqlConnection(connStr);
var result = await conn.QueryAsync<User>("SELECT * FROM users");
// conn tự dispose khi ra khỏi scope

// ============ PATTERN MATCHING ============
// Java 21 sealed class tương tự
object value = GetValue();

string description = value switch {
    int n when n > 0 => $"Positive: {n}",
    int n => $"Non-positive: {n}",
    string s => $"String: {s}",
    null => "Null",
    _ => "Unknown"
};

// ============ STRING INTERPOLATION ============
// Java: String.format("Hello %s, age %d", name, age)
// C#:
var message = $"Hello {user.Name}, age {user.Age}";
var formatted = $"Price: {price:C2}";  // currency format
```

## Ứng Dụng Thực Tế

C# được dùng rộng rãi trong enterprise — Microsoft stack (Azure, Windows Server), game dev (Unity), và cross-platform (.NET 6+). Java dev adopt nhanh nhất ở phần syntax; phần khác biệt thực sự cần học là `async/await` pattern (natural hơn CompletableFuture) và nullable reference types (mạnh hơn Java nhưng yếu hơn Kotlin).

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>C# properties khác gì Java getter/setter?</strong></summary>

**A:** C# property là first-class language feature — `{ get; set; }` được compiler compile thành private backing field + public getter/setter tự động, không cần Lombok hay tự viết. C# còn có `init` accessor (set-once, sau construction không đổi được), computed property (getter chỉ tính toán, không backing field), và `required` modifier (C# 11, compiler bắt buộc phải set). Java phải dùng Lombok `@Data/@Value` hoặc tự viết, hoặc dùng Record (Java 16+) nhưng record không có `copy()` như C# `with` expression.

</details>

<details>
<summary><strong>async/await trong C# khác CompletableFuture Java thế nào?</strong></summary>

**A:** `async/await` là language-level syntax sugar trong C# — compiler transform method thành state machine. Code đọc như synchronous nhưng thực thi non-blocking. Java `CompletableFuture` là API-level, đọc như callback chain (`thenApply`, `thenCompose`). C# `async/await` dễ debug hơn (stack trace tự nhiên), exception propagation tự nhiên hơn (không cần unwrap `ExecutionException`), và `CancellationToken` cho phép cancel operation mid-flight — Java không có equivalent native cancellation. Về performance, cả hai đều non-blocking và dùng thread pool, nhưng C# compiler có thể optimize thành stack-allocated state machine khi không cần heap allocation.

</details>

<details>
<summary><strong>LINQ so với Java Stream API?</strong></summary>

**A:** Cả hai đều lazy evaluation và deferred execution. Điểm khác: (1) **Query syntax** — LINQ có SQL-like syntax (`from x in list where x > 0 select x`) ngoài method syntax; Java chỉ có method syntax. (2) **Expression trees** — LINQ có thể compile lambda thành expression tree (data structure biểu diễn code), EF Core dùng để translate LINQ queries thành SQL; Java Stream lambda là opaque function reference, không translate được. (3) **IQueryable vs IEnumerable** — `IQueryable` delay evaluation đến DB (giống JPA Criteria API), `IEnumerable` execute in-memory; Java Stream không có khái niệm này. (4) **Parallel** — cả hai có parallel version (`AsParallel()` vs `parallelStream()`), behavior tương tự.

</details>
