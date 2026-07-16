---
key: csharp-advanced
title: "C# Advanced — Generics, Delegates, Events & Pattern Matching"
crumb: "16. .NET > C# Nâng Cao"
---

C# có nhiều tính năng language-level không có trong Java: Delegate type-safe, Events pub/sub, Expression trees cho LINQ-to-SQL, Pattern matching mạnh hơn Java, và Extension methods. Generics C# tương tự Java nhưng không có type erasure — runtime giữ type info đầy đủ.

## Điểm Chính

- **Generics**: Không có type erasure như Java — `List<int>` là `List<int>` tại runtime, không phải `List<Object>`; `typeof(List<int>)` hợp lệ
- **Delegates**: Type-safe function pointer — `Func<T>`, `Action<T>`, `Predicate<T>` là built-in; custom delegate định nghĩa signature
- **Events**: Pub/sub pattern built-in — `event EventHandler<T>` tự động thread-safe subscription management
- **Expression Trees**: Lambda compile thành AST (data) thay vì code — LINQ provider dùng để translate sang SQL
- **Pattern Matching**: `switch expression`, `is` type pattern, `when` guard, property pattern, list pattern — mạnh hơn Java 21
- **Extension Methods**: Thêm method vào class không kế thừa — LINQ được implement hoàn toàn qua extension methods
- **Covariance/Contravariance**: `IEnumerable<out T>` (covariant), `Action<in T>` (contravariant) — tương tự Java wildcards `? extends / ? super`
- **Indexers**: Custom `[]` operator — tương tự Java không có built-in nhưng có thể implement
- **Operator Overloading**: Overload `+`, `-`, `==`, `<`, v.v. — Java không có

## Ví Dụ Code

```csharp
// ============ GENERICS — NO TYPE ERASURE ============

// Java: List<String> bị erase thành List tại runtime
// C#: List<string> giữ nguyên type tại runtime

Console.WriteLine(typeof(List<int>));     // System.Collections.Generic.List`1[System.Int32]
Console.WriteLine(typeof(List<string>)); // System.Collections.Generic.List`1[System.String]

// Generic constraint — tương tự Java bounded wildcard
public T Max<T>(T a, T b) where T : IComparable<T>
    => a.CompareTo(b) >= 0 ? a : b;

// Multiple constraints
public T Process<T>(T input)
    where T : class,           // reference type
              IDisposable,     // phải implement interface
              new()            // phải có parameterless constructor
{
    using var resource = input;
    return new T();
}

// Generic class với constraint
public class Repository<T> where T : class, IEntity {
    private readonly List<T> _store = [];
    
    public T? FindById(int id) => _store.FirstOrDefault(e => e.Id == id);
    public void Add(T entity) => _store.Add(entity);
}

// Covariance (out) — IEnumerable<Dog> assignable to IEnumerable<Animal>
IEnumerable<string> strings = new List<string> { "a", "b" };
IEnumerable<object> objects = strings;  // ok — covariant (out T)

// Contravariance (in) — Action<Animal> assignable to Action<Dog>
Action<object> printObj = o => Console.WriteLine(o);
Action<string> printStr = printObj;  // ok — contravariant (in T)

// ============ DELEGATES ============

// Built-in delegates
Func<int, int, int>  add      = (a, b) => a + b;    // returns int
Action<string>       log      = msg => Console.WriteLine(msg);  // returns void
Predicate<int>       isEven   = n => n % 2 == 0;    // returns bool
Func<string, int>    parse    = int.Parse;           // method group

int result = add(3, 4);   // => 7
log("Hello");
bool even = isEven(4);    // => true

// Custom delegate — khi signature không có trong built-in
public delegate TResult Transform<TInput, TResult>(TInput input, int index);

// Multicast delegate — invoke nhiều method
Action<string> handler = msg => Console.WriteLine($"Handler 1: {msg}");
handler += msg => Console.WriteLine($"Handler 2: {msg}");
handler += msg => Console.WriteLine($"Handler 3: {msg}");
handler("Hello");  // gọi tất cả 3

// ============ EVENTS ============

// EventArgs — data cho event
public class OrderCompletedEventArgs : EventArgs {
    public int OrderId { get; init; }
    public decimal Amount { get; init; }
    public DateTime CompletedAt { get; init; }
}

// Publisher
public class OrderService {
    // event — chỉ publisher mới invoke được; subscriber chỉ += và -=
    public event EventHandler<OrderCompletedEventArgs>? OrderCompleted;

    protected virtual void OnOrderCompleted(OrderCompletedEventArgs e) {
        OrderCompleted?.Invoke(this, e);  // null-safe invoke
    }

    public async Task CompleteOrderAsync(int orderId) {
        // ... process order ...
        OnOrderCompleted(new OrderCompletedEventArgs {
            OrderId = orderId,
            Amount = 99.99m,
            CompletedAt = DateTime.UtcNow
        });
    }
}

// Subscriber
var orderService = new OrderService();

// Subscribe
orderService.OrderCompleted += (sender, e) => {
    Console.WriteLine($"Order {e.OrderId} completed: ${e.Amount}");
};

orderService.OrderCompleted += async (sender, e) => {
    await SendConfirmationEmailAsync(e.OrderId);
};

// ============ PATTERN MATCHING ============

// Switch expression (C# 8+) — tương tự Kotlin when
string Classify(object obj) => obj switch {
    int n when n > 0  => "positive int",
    int n             => "non-positive int",
    string s when s.Length > 10 => "long string",
    string s          => $"string: {s}",
    null              => "null",
    _                 => $"unknown: {obj.GetType().Name}"
};

// Property pattern — match vào property
string DescribeUser(User user) => user switch {
    { Age: >= 18, Status: UserStatus.Active } => "active adult",
    { Age: < 18 }                             => "minor",
    { Status: UserStatus.Banned }             => "banned",
    _                                         => "inactive user"
};

// Positional pattern — deconstruct
Point Translate(Point p) => p switch {
    (0, 0) => new Point(0, 0),  // origin
    (var x, 0) => new Point(x, 0),   // on x-axis
    (0, var y) => new Point(0, y),   // on y-axis
    (var x, var y) => new Point(x + 1, y + 1)
};

// List pattern (C# 11)
string DescribeList(int[] arr) => arr switch {
    []        => "empty",
    [var x]   => $"single: {x}",
    [var x, var y] => $"pair: {x}, {y}",
    [var first, .., var last] => $"first={first}, last={last}, count={arr.Length}"
};

// Type pattern với `is`
if (obj is string { Length: > 5 } longStr)
    Console.WriteLine($"Long string: {longStr}");

// ============ EXPRESSION TREES ============

// Lambda: Expression<Func<T>> — compile-time AST, không executable trực tiếp
Expression<Func<User, bool>> filter = u => u.Age > 18 && u.Status == UserStatus.Active;

// LINQ provider (EF Core) translate sang SQL:
// WHERE age > 18 AND status = 'Active'
var users = _ctx.Users.Where(filter).ToList();

// Build expression dynamically (dynamic filter)
var param = Expression.Parameter(typeof(User), "u");
var ageCheck = Expression.GreaterThan(
    Expression.Property(param, "Age"),
    Expression.Constant(18)
);
var lambda = Expression.Lambda<Func<User, bool>>(ageCheck, param);
var result = _ctx.Users.Where(lambda).ToList();

// ============ EXTENSION METHODS ============

// LINQ được implement hoàn toàn qua extension methods
public static class QueryableExtensions {
    // Pagination extension
    public static IQueryable<T> Paginate<T>(
        this IQueryable<T> query, int page, int pageSize)
        => query.Skip((page - 1) * pageSize).Take(pageSize);

    // Conditional where (tránh if/else trong query chain)
    public static IQueryable<T> WhereIf<T>(
        this IQueryable<T> query,
        bool condition,
        Expression<Func<T, bool>> predicate)
        => condition ? query.Where(predicate) : query;
}

// Dùng
var users = _ctx.Users
    .WhereIf(status is not null, u => u.Status == status)
    .WhereIf(minAge > 0, u => u.Age >= minAge)
    .OrderBy(u => u.Name)
    .Paginate(page, pageSize)
    .ToList();

// ============ INDEXERS & OPERATOR OVERLOADING ============

public class Matrix {
    private readonly double[,] _data;
    public int Rows { get; }
    public int Cols { get; }

    public Matrix(int rows, int cols) {
        Rows = rows; Cols = cols;
        _data = new double[rows, cols];
    }

    // Indexer — custom [] operator
    public double this[int row, int col] {
        get => _data[row, col];
        set => _data[row, col] = value;
    }

    // Operator overloading
    public static Matrix operator +(Matrix a, Matrix b) {
        var result = new Matrix(a.Rows, a.Cols);
        for (int i = 0; i < a.Rows; i++)
            for (int j = 0; j < a.Cols; j++)
                result[i, j] = a[i, j] + b[i, j];
        return result;
    }
    
    public static bool operator ==(Matrix a, Matrix b)
        => a.Rows == b.Rows && a.Cols == b.Cols; // simplified
}

Matrix m = new(3, 3);
m[0, 0] = 1.0;
var sum = m + m;
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>C# Generics khác Java Generics thế nào? Tại sao không có type erasure?</strong></summary>

**A:** Java Generics dùng **type erasure** — `List<String>` compile thành `List` tại bytecode, runtime không biết type parameter. C# Generics được **reified** — `List<int>` tại runtime thực sự là `List<int>`, khác hoàn toàn `List<string>`. Lý do C# không có erasure: .NET CLR được redesign để hỗ trợ generics tại VM level (2005), JVM giữ backward compatibility với Java 1.4. Hậu quả: (1) C# không cần `@SuppressWarnings("unchecked")`; (2) `typeof(List<int>)` hợp lệ; (3) `new T()` hợp lệ (với `where T : new()`); (4) `int[]` và `List<int>` không có boxing overhead — Java `List<Integer>` boxing mỗi int. Nhược điểm: .NET phải JIT separate code cho mỗi value type — `List<int>` và `List<double>` compile thành separate native code.

</details>

<details>
<summary><strong>Delegate vs Interface — khi nào dùng Delegate?</strong></summary>

**A:** **Interface**: khi object có nhiều method cần implement, khi cần state, khi muốn named contract. **Delegate/Func**: khi chỉ cần single method signature, callback pattern, event handler, composable pipeline. Rule: nếu chỉ cần 1 method, dùng Delegate — tránh định nghĩa interface cho mỗi callback. Ví dụ: `Func<string, bool>` thay vì `interface IStringValidator { bool Validate(string s); }`. Multicast delegate (nhiều handler gắn vào một delegate) — phù hợp event system. Interface không multicast được mà không có thêm collection management. Strategy pattern: có thể dùng cả hai — delegate đơn giản hơn, interface explicit hơn về contract.

</details>

<details>
<summary><strong>Expression Trees dùng để làm gì? Khác lambda thường thế nào?</strong></summary>

**A:** Lambda thường (`Func<T>`) là compiled code — chỉ chạy được, không inspect được structure. Expression Tree (`Expression<Func<T>>`) là **data structure** biểu diễn code — có thể traverse, analyze, và transform tại runtime. EF Core dùng expression trees để translate LINQ query sang SQL: nó đọc AST của lambda, thấy `u.Age > 18` → emit `WHERE age > 18`. Nếu dùng `Func<User, bool>` thay `Expression<Func<User, bool>>`, EF Core load tất cả records về memory rồi filter in-memory (kinh khủng). Use cases: ORM (LINQ-to-SQL), AutoMapper (property mapping), dynamic predicate building, mock framework (verify expression calls). Không thể dùng expression tree với `async` lambda hoặc `yield return`.

</details>
