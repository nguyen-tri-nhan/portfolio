---
key: java-21
title: Java 21 LTS (Virtual Threads & Modern Java)
crumb: Java Versions > Java 21
---

Java 21 (Sep 2023) là LTS lớn nhất kể từ Java 8. **Virtual Threads** (Project Loom) là revolution cho concurrent programming. Đây là target hiện tại cho greenfield project.

## Điểm Chính

- **Virtual Threads (FINAL)** — hàng triệu threads, blocking style, scale như reactive
- **Sequenced Collections** — API đồng nhất cho collection có thứ tự
- **Record Patterns (FINAL)** — deconstruct record trong pattern matching
- **Pattern Matching for Switch (FINAL)** — type patterns, guarded patterns
- Unnamed Patterns `_` (preview) — wildcard trong pattern
- Structured Concurrency (preview) — quản lý lifecycle of concurrent tasks
- Scoped Values (preview) — thay thế ThreadLocal cho virtual threads

## Ví Dụ Code

```java
// ── Virtual Threads ──────────────────────────────────────────

// Cách cũ: Platform thread (1-1 với OS thread, ~1MB stack)
Thread t = new Thread(() -> {
    // block I/O → waste OS thread
    String result = callExternalAPI();
});

// Virtual Thread — cực nhẹ, hàng triệu cùng lúc
Thread vt = Thread.ofVirtual().start(() -> {
    // block trên I/O → JVM unmount khỏi carrier thread
    // carrier thread free để chạy virtual thread khác
    String result = callExternalAPI(); // blocking style!
});

// ExecutorService với virtual threads
try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 100_000; i++) {
        final int taskId = i;
        executor.submit(() -> {
            // Mỗi task là một virtual thread — không có thread pool limit
            processOrder(taskId); // blocking DB call
        });
    }
} // auto-close → wait for all tasks

// Spring Boot 3.2 — enable virtual threads
// application.properties:
// spring.threads.virtual.enabled=true
// → Tomcat dùng virtual thread per request tự động

// ── Sequenced Collections ─────────────────────────────────────

// Trước Java 21: không có unified API cho "first/last element"
// List: get(0), get(size()-1)
// Deque: peekFirst(), peekLast()
// LinkedHashSet: không có API!

// Java 21: SequencedCollection interface
SequencedCollection<String> list = new ArrayList<>(List.of("a", "b", "c"));
list.getFirst();    // "a"
list.getLast();     // "c"
list.addFirst("z"); // prepend
list.addLast("y");  // append
list.removeFirst(); // remove và return first
list.reversed();    // reversed view (lazy, không copy)

// SequencedMap
SequencedMap<String, Integer> map = new LinkedHashMap<>();
map.put("one", 1); map.put("two", 2); map.put("three", 3);
map.firstEntry();   // Map.Entry("one", 1)
map.lastEntry();    // Map.Entry("three", 3)
map.sequencedKeySet();    // SequencedSet<String>
map.sequencedValues();    // SequencedCollection<Integer>

// ── Record Patterns ───────────────────────────────────────────

record Point(int x, int y) {}
record Line(Point start, Point end) {}

// Pattern Matching + Record deconstruction
Object obj = new Line(new Point(1, 2), new Point(3, 4));

if (obj instanceof Line(Point(var x1, var y1), Point(var x2, var y2))) {
    // x1=1, y1=2, x2=3, y2=4 — tất cả bound trong một expression
    double length = Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
}

// Trong switch
String describe(Object obj) {
    return switch (obj) {
        case Point(var x, var y) when x == 0 && y == 0 -> "Origin";
        case Point(var x, var y) when x == 0           -> "On Y-axis";
        case Point(var x, var y)                        -> "Point(%d,%d)".formatted(x, y);
        case Line(Point p1, Point p2)                   -> "Line from %s to %s".formatted(p1, p2);
        default                                         -> "Unknown";
    };
}

// ── Pattern Matching for Switch (FINAL) ─────────────────────

sealed interface Expr permits Num, Add, Mul {}
record Num(int value) implements Expr {}
record Add(Expr left, Expr right) implements Expr {}
record Mul(Expr left, Expr right) implements Expr {}

int eval(Expr expr) {
    return switch (expr) {
        case Num(var v)              -> v;
        case Add(var l, var r)       -> eval(l) + eval(r);
        case Mul(var l, var r)       -> eval(l) * eval(r);
        // Compiler: exhaustive — no default needed!
    };
}

// ── Structured Concurrency (preview) ─────────────────────────

// Thay vì launch tasks và manage futures manually:
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Future<String> userTask  = scope.fork(() -> fetchUser(userId));
    Future<String> orderTask = scope.fork(() -> fetchOrders(userId));
    
    scope.join();          // wait for all
    scope.throwIfFailed(); // propagate first failure
    
    // Cả hai thành công
    String user   = userTask.resultNow();
    String orders = orderTask.resultNow();
}
// Nếu một task fail → scope cancel task còn lại → no leak

// ── Scoped Values (preview) ──────────────────────────────────

// ThreadLocal vấn đề với virtual threads: ThreadLocal được inherit
// bởi child threads → potential leak trong structured concurrency

// Scoped Values: immutable, bounded scope, không inherit (unless explicit)
static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

// Bind value trong scope
ScopedValue.where(CURRENT_USER, authenticatedUser)
           .run(() -> processRequest(request));

// Trong child code
void processRequest(Request req) {
    User user = CURRENT_USER.get(); // chỉ available trong scope
}
```

## Ứng Dụng Thực Tế

**Virtual Threads** là game-changer cho I/O-bound Java microservices:

```
Trước: Platform thread pool cố định (200 threads)
       → 200 concurrent requests tối đa
       → Thread starvation khi I/O chậm

Sau: Virtual thread per request (Spring Boot 3.2+)
     → Hàng nghìn concurrent requests
     → Blocking I/O không waste OS thread
     → Code giống synchronous nhưng scale như async
```

Không cần chuyển sang reactive (WebFlux) chỉ để scale — Virtual Threads đơn giản hơn nhiều với cùng throughput tương đương I/O-bound workloads.

**Pattern Matching + Records + Sealed = Modern Java ADT:**
```java
sealed interface ApiResult<T> permits Ok<T>, Err {}
record Ok<T>(T value) implements ApiResult<T> {}
record Err(String message, int code) implements ApiResult<Object> {}

ApiResult<User> result = callApi();
switch (result) {
    case Ok(var user)       -> processUser(user);
    case Err(var msg, 404)  -> handleNotFound();
    case Err(var msg, var c)-> handleError(msg, c);
}
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Virtual Thread và Platform Thread khác nhau thế nào về chi phí?</strong></summary>

**A:** Platform thread: mapped 1-1 với OS thread — stack 512KB-1MB default, context switch là OS kernel operation (~microseconds overhead, mode switch). Tạo 10,000 platform threads: ~10GB RAM, OS scheduling overhead lớn. Virtual thread: managed bởi JVM trên ForkJoinPool (N carrier threads = N CPU cores). Stack ~KB và grow/shrink dynamically. Khi block I/O → JVM unmount virtual thread khỏi carrier thread (save continuation), carrier thread tự do. Tạo 10,000 virtual threads: vài MB RAM. Limit: đừng pin virtual thread trên synchronized block với blocking I/O — dùng ReentrantLock thay thế.

</details>

<details>
<summary><strong>Khi nào KHÔNG nên dùng Virtual Threads?</strong></summary>

**A:** (1) **CPU-bound tasks**: Virtual Threads không giúp gì — bottleneck là CPU, không phải thread. Dùng ForkJoinPool với platform threads. (2) **synchronized pinning**: nếu code trong synchronized block gọi blocking I/O — virtual thread bị "pinned" (không unmount được), carrier thread bị block → mất benefit. Migrate sang `ReentrantLock`. (3) **ThreadLocal-heavy code**: ThreadLocal được inherit và chứa state lớn → memory leak khi có hàng triệu virtual threads. Dùng Scoped Values thay thế. (4) **Short-lived compute**: overhead của virtual thread scheduling không worth it cho tasks < 1ms.

</details>

<details>
<summary><strong>SequencedCollection giải quyết vấn đề gì?</strong></summary>

**A:** Trước Java 21: không có unified API để get first/last element của collection có thứ tự. `List` có `get(0)`, `Deque` có `peekFirst()`, `SortedSet` có `first()` — interface khác nhau. `LinkedHashSet` (có thứ tự insertion) không có API get first/last element nào cả! `SequencedCollection` thêm `getFirst()`, `getLast()`, `addFirst()`, `addLast()`, `removeFirst()`, `removeLast()`, `reversed()` vào hierarchy. Không breaking change — `List`, `Deque`, `SortedSet` đều retroactively implement `SequencedCollection` với default method.

</details>
