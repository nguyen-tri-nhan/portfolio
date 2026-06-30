---
key: "Heap"
title: "JVM Heap"
crumb: "1. Core Java › JVM Internals"
---

Heap là vùng dữ liệu runtime nơi tất cả các object instance và array tồn tại, được chia thành Young và Old generation để tối ưu garbage collection.

## Điểm Chính

- <strong>Young Generation</strong>: Eden + Survivor spaces (S0/S1). Hầu hết object chết sớm (giả thuyết thế hệ).
- <strong>Old Generation (Tenured)</strong>: các object sống lâu được promote từ Young Gen.
- Minor GC: dọn Young Gen (nhanh, thường xuyên). Major/Full GC: dọn Old Gen (chậm, tốn kém).
- Cấp phát object nhanh: bump-pointer allocation trong Eden gần như không tốn chi phí.
- <code>OutOfMemoryError: Java heap space</code> — heap cạn kiệt; tăng <code>-Xmx</code> hoặc sửa memory leak.
- Dùng <code>jmap -heap</code> hoặc VisualVM để kiểm tra heap usage trực tiếp.

## Ví Dụ Code

*Heap generations + runtime monitoring + container sizing*

```java
import java.lang.management.*;
import java.util.*;

// ---- Young Gen vs Old Gen lifecycle demo ----
public class HeapDemo {

    // Short-lived objects → allocated in Eden → collected by Minor GC
    public static Order processRequest(String customerId) {
        // These temp objects die before the next Minor GC sweep
        List<String> tempTags = new ArrayList<>();
        tempTags.add("web");
        tempTags.add("v2");

        // The returned Order may survive into Old Gen if held long enough
        return new Order(UUID.randomUUID().toString(), customerId);
    }

    // Long-lived cache → tenured to Old Gen after several Minor GCs
    private static final Map<String, Product> PRODUCT_CACHE = new HashMap<>();

    public static void warmCache(List<Product> products) {
        products.forEach(p -> PRODUCT_CACHE.put(p.getId(), p)); // these objects get promoted
    }
}

// ---- Monitoring heap at runtime ----
public static void printHeapStats() {
    MemoryMXBean memBean = ManagementFactory.getMemoryMXBean();
    MemoryUsage heap = memBean.getHeapMemoryUsage();
    System.out.printf("Heap  — init: %dM  used: %dM  committed: %dM  max: %dM%n",
        toMB(heap.getInit()), toMB(heap.getUsed()),
        toMB(heap.getCommitted()), toMB(heap.getMax()));

    // Per-generation stats (Young / Old / Survivor)
    for (MemoryPoolMXBean pool : ManagementFactory.getMemoryPoolMXBeans()) {
        if (pool.getType() == MemoryType.HEAP) {
            MemoryUsage u = pool.getUsage();
            System.out.printf("  Pool %-25s used=%dM max=%dM%n",
                pool.getName(), toMB(u.getUsed()), toMB(u.getMax()));
        }
    }
}
private static long toMB(long bytes) { return bytes / 1_048_576; }

// ---- Docker / K8s sizing example ----
// Container limit: 1 GB
// -XX:+UseContainerSupport            (default Java 11+)
// -XX:MaxRAMPercentage=75.0           → JVM heap max = 768 MB
// Leave 25% for: OS, Metaspace, code cache, thread stacks, off-heap NIO buffers
```

## Ứng Dụng Thực Tế

Trong môi trường container, đặt <code>-XX:+UseContainerSupport</code> (mặc định Java 11+) để JVM đọc giới hạn bộ nhớ cgroup thay vì bộ nhớ host. Đặt <code>-XX:MaxRAMPercentage=75</code> để giới hạn heap ở 75% bộ nhớ container.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Có bao nhiêu loại OutOfMemoryError và nguyên nhân từng loại?</strong></summary>

**A:** Ba loại chính: (1) `java.lang.OutOfMemoryError: Java heap space` — heap đầy, object không được GC. (2) `OutOfMemoryError: Metaspace` — quá nhiều class được load (thường do class generation libraries như CGLIB, Groovy). (3) `OutOfMemoryError: GC overhead limit exceeded` — JVM dành >98% thời gian cho GC nhưng chỉ giải phóng <2% heap — dấu hiệu memory leak nghiêm trọng. Xử lý: tăng heap size và điều tra heap dump.

</details>

<details>
<summary><strong>Heap dump là gì và lấy nó thế nào trong production?</strong></summary>

**A:** Heap dump là snapshot toàn bộ object trong JVM heap tại một thời điểm. Có thể lấy bằng: `jmap -dump:live,format=b,file=heap.hprof <pid>`, `jcmd <pid> GC.heap_dump /path/heap.hprof`, hoặc tự động khi OOM với flag `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/`. Phân tích bằng Eclipse MAT: chạy "Leak Suspects Report", xem Dominator Tree sort theo Retained Heap để tìm root cause. Luôn bật `HeapDumpOnOutOfMemoryError` trong production.

</details>

<details>
<summary><strong>Tại sao Object được tạo trên Heap chứ không phải Stack?</strong></summary>

**A:** Stack frame bị destroy khi method return — object tồn tại lâu hơn vòng đời method cần sống trên Heap để có thể share giữa các method và thread. JVM Escape Analysis có thể quyết định cấp phát object trên Stack nếu object không "escape" ra ngoài method — đây là optimization hiếm, không thể rely on. Primitive types và references (không phải object chúng trỏ vào) được lưu trên Stack.

</details>
