---
key: "Phân tích Heap Dump"
title: "Phân Tích Heap Dump"
crumb: "1. Core Java › Performance Tuning"
---

Heap dump là snapshot toàn bộ object trong JVM heap tại một thời điểm. Phân tích bằng Eclipse MAT hoặc VisualVM để tìm memory leak — object vẫn reachable từ GC root nhưng không còn cần thiết.

## Điểm Chính

- Trigger: <code>jmap -dump:live,format=b,file=heap.hprof &lt;pid&gt;</code> hoặc tự động khi OOM: <code>-XX:+HeapDumpOnOutOfMemoryError</code>.
- <strong>Eclipse MAT</strong>: mở .hprof → chạy "Leak Suspects Report" → tìm object giữ nhiều memory nhất.
- <strong>Dominator Tree</strong>: object nào "chiếm" (giữ sống duy nhất) nhiều memory nhất.
- <strong>Retained Heap</strong>: tổng memory giải phóng được nếu object này bị GC (bao gồm mọi thứ nó giữ).
- <strong>Shallow Heap</strong>: chỉ bản thân object đó (không tính những gì nó trỏ tới).
- Leak phổ biến: <code>Map/List</code> static tăng mãi, <code>ThreadLocal</code> không remove trong thread pool, listener không deregister.

## Ví Dụ Code

*Ba pattern memory leak phổ biến và cách fix*

```java
// Leak pattern 1: Cache static không có eviction (tăng mãi)
class BadCache {
    private static final Map<String, byte[]> CACHE = new HashMap<>();
    // Mỗi key thêm vào đều tồn tại mãi trong memory!
}
// Fix: dùng Caffeine với max size và TTL
Cache<String, byte[]> cache = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(1, TimeUnit.HOURS)
    .build();

// Leak pattern 2: ThreadLocal không remove trong thread pool
// Thread pool tái sử dụng thread — ThreadLocal request trước bị leak!
class Service {
    static ThreadLocal<UserContext> CTX = new ThreadLocal<>();
    void handle(Request req) {
        CTX.set(new UserContext(req.getUserId()));
        try {
            doWork();
        } finally {
            CTX.remove(); // QUAN TRỌNG — không có dòng này: memory leak + rủi ro bảo mật
        }
    }
}

// Leak pattern 3: Listener không deregister
class Widget {
    Widget(EventBus bus) {
        bus.register(this); // đăng ký listener
        // Nếu Widget bị discard nhưng bus còn sống → Widget không thể bị GC
    }
    // Fix: gọi bus.unregister(this) trong destroy/close
}
```

## Ứng Dụng Thực Tế

Sau khi có heap dump: 1) Chạy "Leak Suspects" report trong MAT trước — tự xác định top offender. 2) Mở Dominator Tree sort theo retained heap. 3) Right-click object nghi ngờ → "Path to GC Roots" để biết cái gì đang giữ nó sống. Luôn bật <code>-XX:+HeapDumpOnOutOfMemoryError</code> trong production để capture trạng thái ngay lúc failure.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Shallow heap và retained heap khác nhau thế nào?</strong></summary>

**A:** **Shallow heap**: memory của chính object đó — chỉ tính các field trực tiếp, không tính objects nó reference. `String` object: ~48 bytes. **Retained heap**: tổng memory sẽ được giải phóng nếu object này bị GC — bao gồm tất cả object mà object này **giữ duy nhất** (transitively reachable và không có GC root khác). `String[] strings` có retained heap = shallow(array) + sum(shallow(string_i)). Trong Eclipse MAT: retained heap của object lớn hơn shallow → object đó là root của memory leak.

</details>

<details>
<summary><strong>Tìm memory leak bằng Eclipse MAT thế nào?</strong></summary>

**A:** (1) **Leak Suspects Report**: MAT tự detect object chiếm >1% heap. (2) **Dominator Tree**: liệt kê object theo retained heap giảm dần — tìm object "unexpected large" ở top. (3) **OQL** (Object Query Language): `SELECT * FROM java.util.HashMap WHERE this.size > 10000` — tìm collection quá lớn. (4) **Unreachable objects**: object không còn reachable nhưng chưa GC — dấu hiệu soft/weak reference issue. (5) So sánh hai heap dump (trước và sau) bằng `Histogram` → tìm class count tăng liên tục.

</details>

<details>
<summary><strong>Kể ba nguyên nhân memory leak phổ biến trong Java.</strong></summary>

**A:** (1) **ThreadLocal không gọi remove()**: ThreadLocal trong thread pool không được clear → giữ object lâu dài theo thread lifetime. (2) **Static collection tăng không giới hạn**: `static Map cache = new HashMap()` được add mà không remove — không bị GC. (3) **Listener/Observer không deregister**: đăng ký listener nhưng không remove khi object không còn cần → listener giữ reference → object không được GC. Thêm: ClassLoader leak trong hot deploy, inner class ẩn giữ reference đến outer class.

</details>
