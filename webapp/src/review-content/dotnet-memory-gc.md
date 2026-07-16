---
key: dotnet-memory-gc
title: ".NET Memory & Garbage Collection"
crumb: "16. .NET > Memory & GC"
---

CLR GC (Common Language Runtime Garbage Collector) dùng generational collection tương tự JVM — Gen 0, Gen 1, Gen 2. IDisposable pattern là .NET equivalent của Java try-with-resources nhưng explicit hơn: implement `Dispose()` để release unmanaged resources. Java dev cần chú ý: `using` statement auto-call `Dispose()` — tương tự try-with-resources.

## Điểm Chính

- **Generational GC**: Gen 0 (short-lived), Gen 1 (medium), Gen 2 (long-lived) + LOH (Large Object Heap, objects ≥ 85KB) — tương tự JVM Young/Old Gen
- **IDisposable**: Pattern để release unmanaged resources (DB connection, file handle, network socket) — implement `Dispose()`, dùng với `using`
- **Finalizer**: Tương tự Java `finalize()` — chạy trước khi GC collect object, không đảm bảo timing — avoid khi có thể
- **LOH**: Large Object Heap — objects ≥ 85KB vào đây, chỉ compact khi GC.Collect(2, GCCollectionMode.Compacting) — fragmentation risk
- **Span\<T\> & Memory\<T\>**: Stack-allocated slice — zero allocation khi slice array/string — không có Java equivalent (Project Valhalla partial)
- **ArrayPool\<T\>**: Reuse array để tránh GC pressure — tương tự Java object pooling
- **GC Modes**: Server GC (high-throughput, dùng trong ASP.NET Core) vs Workstation GC (responsive, desktop apps)
- **WeakReference**: Giữ reference không ngăn GC collect — tương tự Java `WeakReference`

## Ví Dụ Code

```csharp
// ============ IDISPOSABLE PATTERN ============

// Simple — chỉ có managed resources
public class DatabaseConnection : IDisposable {
    private SqlConnection? _connection;
    private bool _disposed = false;

    public DatabaseConnection(string connectionString) {
        _connection = new SqlConnection(connectionString);
        _connection.Open();
    }

    public void Execute(string sql) {
        ObjectDisposedException.ThrowIf(_disposed, this);
        // execute...
    }

    public void Dispose() {
        if (_disposed) return;
        _connection?.Dispose();
        _connection = null;
        _disposed = true;
        GC.SuppressFinalize(this);  // không cần finalizer nữa
    }
}

// Full dispose pattern — có unmanaged resources (file handle, OS resource)
public class FileProcessor : IDisposable {
    private FileStream? _stream;
    private IntPtr _unmanagedHandle;  // unmanaged resource
    private bool _disposed = false;

    public void Dispose() {
        Dispose(disposing: true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing) {
        if (_disposed) return;

        if (disposing) {
            // Dispose managed resources
            _stream?.Dispose();
        }

        // Always release unmanaged resources (kể cả khi finalize)
        if (_unmanagedHandle != IntPtr.Zero) {
            NativeLib.ReleaseHandle(_unmanagedHandle);
            _unmanagedHandle = IntPtr.Zero;
        }

        _disposed = true;
    }

    // Finalizer — backup nếu Dispose() không được gọi
    ~FileProcessor() {
        Dispose(disposing: false);
    }
}

// Usage — using statement auto-dispose (tương tự Java try-with-resources)
using var conn = new DatabaseConnection(connectionString);
conn.Execute("SELECT 1");
// conn.Dispose() tự gọi khi ra khỏi scope kể cả khi exception

// Async version
public class AsyncResource : IAsyncDisposable {
    public async ValueTask DisposeAsync() {
        await FlushAsync();
        // cleanup
    }
}

await using var resource = new AsyncResource();

// ============ SPAN<T> — ZERO ALLOCATION SLICING ============

// Không có Java equivalent — stack-allocated slice
public static int ParseFirstInt(ReadOnlySpan<char> input) {
    // Find first number in string — no heap allocation
    var end = input.IndexOf(' ');
    var numberPart = end >= 0 ? input[..end] : input;
    return int.Parse(numberPart);
}

// string → Span<char> (no copy, no allocation)
string line = "42 hello world";
int parsed = ParseFirstInt(line.AsSpan());

// Slice array — no allocation
byte[] buffer = new byte[1024];
ReadOnlySpan<byte> header = buffer.AsSpan(0, 4);   // first 4 bytes
ReadOnlySpan<byte> body   = buffer.AsSpan(4);       // rest

// Stackalloc — allocate on stack
Span<int> stackBuffer = stackalloc int[32];  // 32 ints trên stack, không GC
for (int i = 0; i < stackBuffer.Length; i++)
    stackBuffer[i] = i;

// Memory<T> — như Span nhưng có thể store trong class field
public class Pipeline {
    private Memory<byte> _buffer;  // Span không thể là field (ref struct)
    
    public Pipeline(Memory<byte> buffer) => _buffer = buffer;
    
    public ReadOnlyMemory<byte> GetHeader() => _buffer[..4];
}

// ============ ARRAYPOOL — REDUCE GC PRESSURE ============

// ❌ Allocation mỗi request — GC pressure cao
public byte[] ProcessRequest(byte[] input) {
    var buffer = new byte[4096];   // allocation mỗi lần
    // process...
    return buffer;
}

// ✅ Rent từ pool — tái sử dụng
public byte[] ProcessRequest_Pooled(byte[] input) {
    var pool = ArrayPool<byte>.Shared;
    byte[] buffer = pool.Rent(4096);   // reuse từ pool
    try {
        // process...
        var result = new byte[actualSize];
        Array.Copy(buffer, result, actualSize);
        return result;
    } finally {
        pool.Return(buffer, clearArray: true);  // trả về pool
    }
}

// ============ GC MODES & CONFIGURATION ============

// appsettings.json / runtimeconfig.json
/*
{
  "configProperties": {
    "System.GC.Server": true,         // Server GC — nhiều heap, nhiều thread
    "System.GC.Concurrent": true,     // Background GC
    "System.GC.HeapHardLimit": 1073741824,  // 1GB hard limit
    "System.GC.HighMemoryPercent": 90  // trigger GC khi 90% memory used
  }
}
*/

// Monitor GC via code
var gcInfo = GC.GetGCMemoryInfo();
Console.WriteLine($"Heap size: {gcInfo.HeapSizeBytes / 1024 / 1024} MB");
Console.WriteLine($"Fragmented: {gcInfo.FragmentedBytes / 1024 / 1024} MB");

// Force GC (tránh trong production — thường để benchmark/testing)
GC.Collect(2, GCCollectionMode.Forced, blocking: true, compacting: true);

// Gen collections count
Console.WriteLine($"Gen 0: {GC.CollectionCount(0)} collections");
Console.WriteLine($"Gen 1: {GC.CollectionCount(1)} collections");
Console.WriteLine($"Gen 2: {GC.CollectionCount(2)} collections");

// ============ WEAKREFERENCE ============
// Tương tự Java WeakReference

var obj = new LargeObject();
var weakRef = new WeakReference<LargeObject>(obj);

obj = null!;  // remove strong reference
GC.Collect();  // GC có thể collect LargeObject

if (weakRef.TryGetTarget(out var recovered)) {
    Console.WriteLine("Object still alive");
} else {
    Console.WriteLine("Object was collected");
}

// Cache với WeakReference — entry tự expire khi memory pressure
var cache = new Dictionary<string, WeakReference<CacheEntry>>();

// ============ MEMORY DIAGNOSTICS ============

// ObjectDisposedException — common bug
public class LeakyService : IDisposable {
    private bool _disposed;
    
    public void DoWork() {
        // Nếu không check: NullReferenceException hoặc undefined behavior
        ObjectDisposedException.ThrowIf(_disposed, nameof(LeakyService));
        // work...
    }
    
    public void Dispose() => _disposed = true;
}

// dotnet-counters để monitor memory
// dotnet-counters monitor --process-id <pid> System.Runtime

// Allocation tracking với EventListener
class AllocationTracker : EventListener {
    protected override void OnEventSourceCreated(EventSource eventSource) {
        if (eventSource.Name == "Microsoft-Windows-DotNETRuntime")
            EnableEvents(eventSource, EventLevel.Informational, 
                (EventKeywords)0x1);  // GCKeyword
    }
    
    protected override void OnEventWritten(EventWrittenEventArgs data) {
        if (data.EventName == "GCAllocationTick_V3") {
            var size = (ulong)(data.Payload![3]!);
            Console.WriteLine($"Allocated: {size} bytes");
        }
    }
}
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>IDisposable vs Finalizer — khác nhau và khi nào dùng cái nào?</strong></summary>

**A:** **IDisposable.Dispose()**: deterministic cleanup — caller kiểm soát WHEN resources được release; dùng với `using` statement; không delay. **Finalizer (~ClassName)**: non-deterministic — GC quyết định khi nào chạy, có thể delay nhiều giây đến phút; chạy trên dedicated finalizer thread. Rule: (1) Nếu chỉ có managed resources → implement `IDisposable`, không cần finalizer. (2) Nếu có unmanaged resources (IntPtr, OS handle) → implement cả `IDisposable` và finalizer (safety net). (3) `GC.SuppressFinalize(this)` trong `Dispose()` để skip finalizer khi đã dispose properly — tránh double-cleanup. Giống Java: `Closeable.close()` ↔ `IDisposable.Dispose()`; Java `finalize()` ↔ C# finalizer (cả hai deprecated pattern vì non-deterministic).

</details>

<details>
<summary><strong>Span\<T\> giải quyết vấn đề gì mà array thường không làm được?</strong></summary>

**A:** `Span<T>` là stack-allocated struct — không tạo heap object khi slice. Problem với array: `array.Skip(4).Take(100).ToArray()` tạo new array allocation (copy). `Span<T>` slice không copy: `array.AsSpan(4, 100)` là view trên cùng memory. Use cases: (1) Parse string/binary protocol mà không allocate substring — `input.AsSpan(start, length)`. (2) Stackalloc buffer cho temporary work — `stackalloc byte[256]`, không GC. (3) High-performance serialization — Span-based APIs (BinaryPrimitives, UTF8Encoding). Limitation: Span không thể làm field trong class (ref struct, chỉ stack) — dùng `Memory<T>` nếu cần store. Không có Java equivalent — Project Valhalla (value types) partial cover.

</details>

<details>
<summary><strong>Server GC vs Workstation GC — khi nào cần quan tâm?</strong></summary>

**A:** **Server GC** (default trong ASP.NET Core): một heap + thread per logical core → higher throughput, higher memory usage, stop-the-world pauses có thể dài hơn. **Workstation GC**: một heap, concurrent background GC → lower latency, lower throughput, phù hợp desktop/CLI. Tuning cần thiết khi: (1) Memory spike bất thường (LOH fragmentation — objects ≥ 85KB); (2) Gen 2 GC quá thường (long-lived object nhiều — review caching strategy); (3) GC pause > 100ms (check `GC.GetGCMemoryInfo().PauseTimePercentage`). Công cụ: `dotnet-counters`, PerfView, dotnet-trace. Tương tự JVM: Server GC ≈ G1GC/ZGC; Workstation GC ≈ Serial GC.

</details>
