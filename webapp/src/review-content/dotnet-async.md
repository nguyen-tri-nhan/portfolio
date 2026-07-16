---
key: dotnet-async
title: "async/await & Task — .NET Concurrency"
crumb: "16. .NET > Async & Concurrency"
---

.NET async model dùng `Task`/`Task<T>` — tương đương Java `CompletableFuture` — nhưng với `async/await` là first-class syntax nên code đọc như synchronous. `CancellationToken` là tính năng không có equivalent tự nhiên trong Java, cho phép cancel in-flight async operation một cách cooperative.

## Điểm Chính

- **Task\<T\>**: Tương đương `CompletableFuture<T>` — đại diện async operation sẽ hoàn thành trong tương lai
- **async/await**: Compiler transform method thành state machine — không block thread khi await
- **Task.WhenAll()**: Tương đương `CompletableFuture.allOf()` — chạy nhiều task song song, chờ tất cả
- **Task.WhenAny()**: Return khi task đầu tiên complete — không có exact equivalent trong Java
- **CancellationToken**: Cooperative cancellation — propagate cancel signal xuống toàn bộ async chain; Java không có built-in equivalent
- **ConfigureAwait(false)**: Không capture SynchronizationContext — quan trọng trong library code để tránh deadlock
- **ValueTask\<T\>**: Lightweight version của Task — tránh heap allocation khi result thường available synchronously
- **IAsyncEnumerable\<T\>**: Async stream — tương tự Java không có exact equivalent (Project Loom có nhưng khác)

## Ví Dụ Code

```csharp
// ============ TASK vs COMPLETABLEFUTURE ============

// Java CompletableFuture — callback chain
// CompletableFuture<User> cf = userRepo.findById(id)
//     .thenCompose(u -> orderRepo.findByUser(u.getId()))
//     .thenApply(orders -> new UserDto(u, orders))
//     .exceptionally(ex -> UserDto.empty());

// C# async/await — đọc như synchronous
public async Task<UserDto> GetUserWithOrdersAsync(int userId) {
    var user = await _userRepo.FindByIdAsync(userId);    // non-blocking
    var orders = await _orderRepo.FindByUserAsync(userId); // non-blocking
    return new UserDto(user, orders);
}

// ============ PARALLEL TASKS — TASK.WHENALL ============
// Tương tự CompletableFuture.allOf()

// ❌ Sequential — chờ lần lượt (không song song)
var user   = await _userRepo.FindByIdAsync(userId);
var orders = await _orderRepo.FindByUserAsync(userId);
var stats  = await _statsRepo.GetUserStatsAsync(userId);

// ✅ Parallel — gọi cùng lúc, chờ tất cả
var userTask   = _userRepo.FindByIdAsync(userId);
var ordersTask = _orderRepo.FindByUserAsync(userId);
var statsTask  = _statsRepo.GetUserStatsAsync(userId);

await Task.WhenAll(userTask, ordersTask, statsTask);

var user2   = await userTask;
var orders2 = await ordersTask;
var stats2  = await statsTask;

// Hoặc ngắn gọn hơn:
var (user3, orders3, stats3) = (
    await userTask,
    await ordersTask,
    await statsTask
);

// ============ CANCELLATIONTOKEN ============
// Không có exact equivalent trong Java — đây là C# killer feature

// Service layer — nhận token, propagate xuống
public async Task<List<Order>> GetOrdersAsync(
    int userId,
    CancellationToken cancellationToken = default)  // default = không cancel
{
    // Pass token xuống tất cả async calls
    var orders = await _ctx.Orders
        .Where(o => o.UserId == userId)
        .ToListAsync(cancellationToken);  // nếu request bị cancel → throw OperationCanceledException

    await _cache.SetAsync($"orders:{userId}", orders, cancellationToken);
    return orders;
}

// Controller — ASP.NET Core tự inject token từ HTTP request
[HttpGet("{userId}/orders")]
public async Task<ActionResult<List<Order>>> GetOrders(
    int userId,
    CancellationToken cancellationToken)  // ASP.NET Core auto-inject
{
    // Khi client ngắt kết nối → cancellationToken.IsCancellationRequested = true
    var orders = await _orderService.GetOrdersAsync(userId, cancellationToken);
    return Ok(orders);
}

// Manual cancel — timeout sau 5 giây
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
try {
    var result = await _service.LongRunningTaskAsync(cts.Token);
} catch (OperationCanceledException) {
    // Task bị cancel hoặc timeout
}

// Linked tokens — cancel khi request cancel HOẶC timeout
using var requestCts = CancellationTokenSource.CreateLinkedTokenSource(
    httpContext.RequestAborted,
    new CancellationTokenSource(TimeSpan.FromSeconds(30)).Token
);

// ============ ASYNC STREAM — IASYNCENUMERABLE ============
// Streaming data từ DB hoặc external source

// Producer — yield kết quả từng phần
public async IAsyncEnumerable<Order> StreamOrdersAsync(
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    await foreach (var order in _ctx.Orders
        .AsAsyncEnumerable()
        .WithCancellation(cancellationToken))
    {
        yield return order;  // trả về từng order, không load all vào memory
    }
}

// Consumer
await foreach (var order in _service.StreamOrdersAsync(cancellationToken)) {
    await ProcessOrderAsync(order);
}

// ============ CONFIGUREWAIT(FALSE) ============
// Quan trọng trong library code

// ❌ Có thể deadlock trong legacy ASP.NET (không phải ASP.NET Core)
public async Task<string> GetDataAsync() {
    var result = await httpClient.GetStringAsync(url);  // capture context
    return result;
}

// ✅ Library code nên dùng ConfigureAwait(false)
public async Task<string> GetDataAsync() {
    var result = await httpClient.GetStringAsync(url)
        .ConfigureAwait(false);  // không cần resume trên original context
    return result;
}
// Lý do: ASP.NET Core không có SynchronizationContext → ConfigureAwait ít quan trọng hơn
// Nhưng library code nên dùng để tương thích với WPF, WinForms, legacy ASP.NET

// ============ VALUETASK — PERFORMANCE OPTIMIZATION ============

// Task<T> luôn allocate trên heap (ngay cả khi result sync available)
public async Task<int> GetCachedCountAsync() {
    if (_cache.TryGet("count", out int count))
        return count;  // Task allocation dù không cần async
    return await _db.CountAsync();
}

// ValueTask<T> — no allocation khi sync path
public ValueTask<int> GetCachedCountAsync2() {
    if (_cache.TryGet("count", out int count))
        return ValueTask.FromResult(count);  // zero allocation
    return new ValueTask<int>(_db.CountAsync());
}

// ============ EXCEPTION HANDLING ============

// ❌ Không catch exception từ Task.WhenAll đúng cách
try {
    await Task.WhenAll(task1, task2, task3);
} catch (Exception ex) {
    // Chỉ catch exception đầu tiên! Các exception khác bị bỏ qua
}

// ✅ Đúng cách — check từng task
var tasks = new[] { task1, task2, task3 };
await Task.WhenAll(tasks);  // chờ tất cả kể cả khi có exception

var exceptions = tasks
    .Where(t => t.IsFaulted)
    .Select(t => t.Exception!)
    .ToList();

if (exceptions.Any())
    throw new AggregateException(exceptions);
```

## Ứng Dụng Thực Tế

`CancellationToken` là pattern quan trọng nhất cần adopt khi viết .NET code — propagate từ HTTP request xuống tận DB query giúp free resources ngay khi client disconnect. Với background service, dùng `IHostedService` + `CancellationToken` từ `stoppingToken` parameter. Java dev cần chú ý: không có `ExecutionException` unwrapping như Java — exception từ `await` propagate trực tiếp, stack trace tự nhiên hơn.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>async/await có tạo thread mới không?</strong></summary>

**A:** Không — `async/await` không tạo thread mới. `await` release thread hiện tại về thread pool khi chờ I/O, và resume trên thread pool thread (có thể khác thread) khi I/O complete. Đây là cooperative multitasking, không phải preemptive. Thread pool size không tăng vì async — tương tự event loop model. Điểm khác với Java Virtual Thread: VT tạo lightweight thread object riêng; C# `async/await` compile thành state machine không có thread object riêng khi await.

</details>

<details>
<summary><strong>Khi nào dùng Task.WhenAll vs Task.WhenAny?</strong></summary>

**A:** `Task.WhenAll`: chờ tất cả task hoàn thành — dùng khi cần kết quả của tất cả task trước khi tiếp tục (ví dụ: gọi 3 API song song, cần cả 3 kết quả). `Task.WhenAny`: return khi task đầu tiên complete — dùng cho: (1) **Race condition** — gọi 2 service, lấy kết quả nhanh hơn; (2) **Timeout pattern** — `WhenAny(actualTask, Task.Delay(timeout))`, nếu Delay win thì timeout; (3) **Heartbeat/polling** — process xong một task thì pick task tiếp theo. Chú ý: `WhenAny` không cancel task còn lại — cần dùng `CancellationToken` để cancel manual.

</details>

<details>
<summary><strong>CancellationToken hoạt động thế nào khi client disconnect?</strong></summary>

**A:** ASP.NET Core inject `HttpContext.RequestAborted` CancellationToken vào controller action. Khi client disconnect (close browser, network timeout, cancel request), ASP.NET Core set `RequestAborted.IsCancellationRequested = true` và cancel token. Nếu code propagate token xuống (EF Core query, HttpClient call, cache set), các operations đó sẽ throw `OperationCanceledException` → resource freed sớm. Pattern: controller nhận `CancellationToken ct`, pass xuống service, service pass xuống repo/DB. Framework (EF Core, HttpClient, Npgsql) đều support token natively — chỉ cần pass thêm parameter.

</details>
