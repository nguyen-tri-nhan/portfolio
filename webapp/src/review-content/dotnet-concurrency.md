---
key: dotnet-concurrency
title: ".NET Concurrency — Thread, TPL & Synchronization"
crumb: "16. .NET > Concurrency"
---

.NET concurrency model: `Thread` cho OS thread trực tiếp, `ThreadPool` cho reusable thread pool, `Task` (TPL) cho high-level async abstraction. Không có GIL như Ruby — true parallelism. Java dev sẽ thấy quen: `Thread` ↔ `Thread`, `ThreadPool` ↔ `ExecutorService`, `Task` ↔ `CompletableFuture`, `SemaphoreSlim` ↔ `Semaphore`.

## Điểm Chính

- **Thread vs Task**: `Thread` là OS thread (tương tự Java `Thread`); `Task` là work item chạy trên `ThreadPool` — prefer Task over Thread cho async work
- **ThreadPool**: .NET managed thread pool — tương tự Java `Executors.newCachedThreadPool()`; tự scale
- **Task Parallel Library (TPL)**: `Parallel.For`, `Parallel.ForEach`, `PLINQ` — tương tự Java Fork/Join + parallel stream
- **SemaphoreSlim**: Async-capable semaphore — `await semaphore.WaitAsync()` — tương tự Java `Semaphore` nhưng có async version
- **Mutex, Monitor, lock**: Mutual exclusion — `lock(obj)` là syntax sugar cho `Monitor.Enter/Exit` — tương tự Java `synchronized`
- **Interlocked**: Lock-free atomic operations — tương tự Java `AtomicInteger`
- **ConcurrentCollections**: `ConcurrentDictionary`, `ConcurrentQueue`, `ConcurrentBag` — tương tự Java `ConcurrentHashMap`, `ConcurrentLinkedQueue`
- **Channels**: `System.Threading.Channels` — high-performance producer/consumer — tương tự Java `BlockingQueue`

## Ví Dụ Code

```csharp
// ============ THREAD vs TASK ============

// Thread — OS thread trực tiếp (tương tự Java Thread)
var thread = new Thread(() => {
    Console.WriteLine($"Running on thread {Thread.CurrentThread.ManagedThreadId}");
});
thread.IsBackground = true;  // daemon thread
thread.Start();
thread.Join();  // wait

// Task — runs on ThreadPool (prefer this)
var task = Task.Run(() => {
    Console.WriteLine("Running on thread pool");
    return 42;
});
int result = await task;

// Task với CancellationToken
var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
var task2 = Task.Run(() => {
    while (!cts.Token.IsCancellationRequested) {
        // do work...
        Thread.Sleep(100);
    }
}, cts.Token);

// ============ TASK PARALLEL LIBRARY ============

// Parallel.For — tương tự Java parallelStream
var results = new int[100];
Parallel.For(0, 100, i => {
    results[i] = ComputeExpensive(i);
});

// Parallel.ForEach
var items = Enumerable.Range(1, 1000).ToList();
Parallel.ForEach(items, new ParallelOptions { MaxDegreeOfParallelism = 4 }, item => {
    ProcessItem(item);
});

// PLINQ — Parallel LINQ (tương tự Java parallelStream)
var primes = Enumerable.Range(2, 1_000_000)
    .AsParallel()
    .WithDegreeOfParallelism(4)
    .Where(IsPrime)
    .ToList();

// PLINQ với ordered output
var orderedResults = Enumerable.Range(1, 100)
    .AsParallel()
    .AsOrdered()  // preserve input order (có overhead)
    .Select(i => i * i)
    .ToArray();

// ============ LOCK — MUTUAL EXCLUSION ============
// lock(obj) = Java synchronized block

private readonly object _lock = new();
private int _counter = 0;

public void Increment() {
    lock (_lock) {
        _counter++;
    }
}

// Monitor (explicit) — tương tự Java Object.wait()/notify()
private readonly object _monitor = new();
private bool _dataReady = false;
private string? _data = null;

public void Producer() {
    lock (_monitor) {
        _data = "Hello from producer";
        _dataReady = true;
        Monitor.Pulse(_monitor);  // tương tự notify()
    }
}

public string Consumer() {
    lock (_monitor) {
        while (!_dataReady)
            Monitor.Wait(_monitor);  // tương tự wait()
        return _data!;
    }
}

// ============ SEMAPHORESLIM — ASYNC SEMAPHORE ============

private readonly SemaphoreSlim _semaphore = new(initialCount: 3, maxCount: 3);

// Rate limiting pattern — max 3 concurrent operations
public async Task ProcessAsync(List<Item> items, CancellationToken ct) {
    var tasks = items.Select(async item => {
        await _semaphore.WaitAsync(ct);
        try {
            await ProcessItemAsync(item, ct);
        } finally {
            _semaphore.Release();
        }
    });
    await Task.WhenAll(tasks);
}

// ============ INTERLOCKED — LOCK-FREE ============
// Tương tự Java AtomicInteger, AtomicLong

private int _requestCount = 0;
private long _totalBytes = 0;

public void RecordRequest(int bytes) {
    Interlocked.Increment(ref _requestCount);        // thread-safe ++
    Interlocked.Add(ref _totalBytes, bytes);         // thread-safe +=
    Interlocked.Exchange(ref _requestCount, 0);      // thread-safe assignment
    Interlocked.CompareExchange(ref _requestCount, 0, 100);  // CAS
}

// ============ CONCURRENT COLLECTIONS ============

// ConcurrentDictionary — tương tự Java ConcurrentHashMap
var cache = new ConcurrentDictionary<string, User>();

// GetOrAdd — atomic check-then-add
var user = cache.GetOrAdd(userId, id => LoadUserFromDb(id));

// AddOrUpdate — atomic update
cache.AddOrUpdate(
    userId,
    addValueFactory: id => new User(id, hits: 1),
    updateValueFactory: (id, existing) => existing with { Hits = existing.Hits + 1 }
);

// ConcurrentQueue — lock-free FIFO
var queue = new ConcurrentQueue<WorkItem>();
queue.Enqueue(new WorkItem("task1"));
if (queue.TryDequeue(out var item)) {
    Process(item);
}

// ============ CHANNELS — HIGH PERFORMANCE PRODUCER/CONSUMER ============
// Tương tự Java BlockingQueue nhưng async-first

// Bounded channel (backpressure support)
var channel = Channel.CreateBounded<LogEntry>(new BoundedChannelOptions(1000) {
    FullMode = BoundedChannelFullMode.Wait,  // hoặc DropOldest, DropNewest
    SingleReader = false,
    SingleWriter = false
});

// Producer
async Task ProduceAsync(CancellationToken ct) {
    await foreach (var entry in GetLogEntriesAsync(ct)) {
        await channel.Writer.WriteAsync(entry, ct);  // backpressure khi full
    }
    channel.Writer.Complete();
}

// Consumer
async Task ConsumeAsync(CancellationToken ct) {
    await foreach (var entry in channel.Reader.ReadAllAsync(ct)) {
        await ProcessLogAsync(entry);
    }
}

// ============ READERWRITERLOCKSLIM ============
// Multiple readers, single writer — tương tự Java ReadWriteLock

private readonly ReaderWriterLockSlim _rwLock = new();
private Dictionary<string, string> _cache = new();

public string? Read(string key) {
    _rwLock.EnterReadLock();  // multiple readers allowed
    try {
        return _cache.TryGetValue(key, out var value) ? value : null;
    } finally {
        _rwLock.ExitReadLock();
    }
}

public void Write(string key, string value) {
    _rwLock.EnterWriteLock();  // exclusive
    try {
        _cache[key] = value;
    } finally {
        _rwLock.ExitWriteLock();
    }
}

// ============ THREAD-SAFE LAZY INITIALIZATION ============

// Lazy<T> — tương tự Java Holder pattern / double-checked locking
private readonly Lazy<ExpensiveResource> _resource =
    new(() => new ExpensiveResource(), LazyThreadSafetyMode.ExecutionAndPublication);

public ExpensiveResource Resource => _resource.Value;  // thread-safe, init once

// Async lazy (không built-in, pattern phổ biến)
private readonly SemaphoreSlim _initLock = new(1, 1);
private volatile ExpensiveResource? _asyncResource;

public async Task<ExpensiveResource> GetResourceAsync() {
    if (_asyncResource is not null) return _asyncResource;
    await _initLock.WaitAsync();
    try {
        _asyncResource ??= await ExpensiveResource.CreateAsync();
        return _asyncResource;
    } finally {
        _initLock.Release();
    }
}

// ============ DEADLOCK DETECTION & PREVENTION ============

// ❌ Deadlock risk — acquire locks in different order
public void MethodA() {
    lock (_lockA) { lock (_lockB) { /* work */ } }
}
public void MethodB() {
    lock (_lockB) { lock (_lockA) { /* work */ } }  // deadlock với MethodA
}

// ✅ Fix — consistent lock order
public void MethodA_Fixed() {
    lock (_lockA) { lock (_lockB) { /* work */ } }
}
public void MethodB_Fixed() {
    lock (_lockA) { lock (_lockB) { /* work */ } }  // same order
}

// ✅ Hoặc dùng timeout
if (Monitor.TryEnter(_lockA, TimeSpan.FromSeconds(1))) {
    try {
        // got lock
    } finally {
        Monitor.Exit(_lockA);
    }
} else {
    // couldn't acquire — handle gracefully
}
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Thread vs Task trong .NET — khi nào dùng cái nào?</strong></summary>

**A:** **Thread**: khi cần control chi tiết (priority, affinity, background/foreground, STA apartment cho COM); khi work là pure CPU-bound long-running (tránh chiếm ThreadPool thread). **Task**: cho hầu hết async work — chạy trên managed ThreadPool, tích hợp với `async/await`, support cancellation, exception aggregation, composable với `WhenAll/WhenAny`. `Task.Run()` queue CPU-bound work lên ThreadPool. Rule: prefer `Task`, dùng `Thread` khi có lý do cụ thể. Tương đương Java: `Thread` ↔ `Thread`; `Task.Run()` ↔ `executor.submit()`; `async method` ↔ `CompletableFuture.supplyAsync()`.

</details>

<details>
<summary><strong>SemaphoreSlim khác Semaphore thế nào? Khi nào dùng cái nào?</strong></summary>

**A:** `Semaphore` là OS-level synchronization primitive — có thể dùng cross-process, nặng hơn. `SemaphoreSlim` là managed implementation — lighter, có `async` support (`WaitAsync`), không cross-process. Rule: **luôn dùng SemaphoreSlim** trong single-process async code. Điểm khác biệt quan trọng: `SemaphoreSlim.WaitAsync()` không block thread khi chờ — release thread về ThreadPool, resume khi slot available. Java `Semaphore` không có async version — blocking, phù hợp hơn với virtual threads.

</details>

<details>
<summary><strong>System.Threading.Channels dùng khi nào?</strong></summary>

**A:** Channels là khi cần **async producer-consumer pipeline** với backpressure. Lợi thế so với `ConcurrentQueue`: (1) `ReadAllAsync()` cho async consumption không busy-wait; (2) Bounded channel tự động backpressure khi full; (3) `Complete()` signal consumer rằng không còn item; (4) Single/multiple reader/writer optimization. Use case: log ingestion pipeline, batch processing queue, event streaming internal. Tương tự Java `ArrayBlockingQueue` nhưng fully async. Với `BoundedChannelOptions.FullMode.Wait` — producer `await WriteAsync()` block (async) khi channel full — natural backpressure.

</details>
