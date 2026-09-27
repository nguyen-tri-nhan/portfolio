---
key: "Metaspace"
title: "Metaspace"
crumb: "1. Core Java › JVM Internals"
---

Metaspace (thay thế PermGen từ Java 8) lưu class metadata và bytecode method, tự động mở rộng trong native memory thay vì heap.

## Điểm Chính

- Thay thế <strong>PermGen</strong> (Java ≤ 7) vốn là vùng heap cố định.
- Metaspace dùng native memory và tự động mở rộng theo mặc định (không có giới hạn cố định).
- Rủi ro: tải class không giới hạn (dynamic proxy, Groovy script, lạm dụng reflection) gây native OOM.
- <code>-XX:MaxMetaspaceSize</code> giới hạn; nên đặt trong production để ngăn tăng trưởng không kiểm soát.
- <code>OutOfMemoryError: Metaspace</code> — tải quá nhiều class; kiểm tra class loader leak.
- Spring dùng cglib/byte-buddy cho proxy — mỗi bean được proxy tạo ra class mới trong Metaspace.

## Ví Dụ Code

*Metaspace: static fields, monitoring, classloader leak và production tuning*

```java
// ---- What lives in Metaspace ----
// - Class metadata (field/method descriptors, bytecode)
// KHÔNG ở Metaspace:
// - Static fields: nằm trong object java.lang.Class trên HEAP (JEP 122 — chuyển khỏi PermGen)
// - Interned strings: trên HEAP (JEP 122)
// - JIT-compiled code: trong Code Cache (vùng native riêng)

// ---- Static field clarification ----
public class OrderConfig {
    // The static field 'DEFAULT_CURRENCY' is stored with the Class object on the HEAP
    // The String object "USD" lives on HEAP (interned string pool)
    public static final String DEFAULT_CURRENCY = "USD";

    // Static field + HashMap object + entries: all on HEAP; only class metadata is in Metaspace
    private static final Map<String, PaymentGateway> GATEWAYS = new HashMap<>();
}

// ---- Monitoring Metaspace ----
public static void printMetaspaceStats() {
    ManagementFactory.getMemoryPoolMXBeans().stream()
        .filter(p -> p.getName().contains("Metaspace"))
        .forEach(pool -> {
            MemoryUsage u = pool.getUsage();
            System.out.printf("Metaspace: used=%dMB  committed=%dMB  max=%s%n",
                u.getUsed()      / 1_048_576,
                u.getCommitted() / 1_048_576,
                u.getMax() == -1 ? "unlimited" : u.getMax() / 1_048_576 + "MB");
        });
}

// ---- Common Metaspace leak: anonymous classloader per request ----
// BAD pattern in some scripting engines / OSGi plugins:
// Each 'ScriptEngine.eval()' call compiles a new class and loads it with a
// throwaway ClassLoader that is never GC'd → Metaspace grows until OOM

// FIX: reuse a single ScriptEngine instance (and its ClassLoader)
// @Component — Spring manages a singleton
public class GroovyScriptRunner {
    // One engine per application lifecycle → classes load into stable Metaspace region
    private final ScriptEngine engine = new ScriptEngineManager().getEngineByName("groovy");

    public Object run(String script) throws ScriptException {
        return engine.eval(script);
    }
}

// ---- Production tuning ----
// -XX:MetaspaceSize=128m       initial Metaspace size (avoid early GC trigger)
// -XX:MaxMetaspaceSize=256m    hard cap — fail fast rather than swamp native memory
// Without MaxMetaspaceSize: JVM can consume all native memory → OS OOM killer
```

## Ứng Dụng Thực Tế

Nếu bạn dùng OSGi, application server với classloader isolation, hoặc sinh code runtime nhiều (Groovy DSL, Spring AOP proxy), hãy monitor Metaspace qua <code>jcmd &lt;pid&gt; VM.native_memory</code> hoặc Prometheus JMX metrics.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa PermGen và Metaspace là gì?</strong></summary>

**A:** **PermGen** (Java 7-): cố định size trong heap (default 64-256MB), lưu class metadata, static data, interned strings. Dễ gây `OutOfMemoryError: PermGen space`. **Metaspace** (Java 8+): native memory thay vì heap — size chỉ giới hạn bởi system memory (hoặc `-XX:MaxMetaspaceSize`). Class metadata vẫn ở đây; interned strings và static variable chuyển sang heap (JEP 122). Không còn PermGen OOM vì config; nhưng nếu không set MaxMetaspaceSize, có thể dùng hết native memory.

</details>

<details>
<summary><strong>Nguyên nhân nào gây ra OutOfMemoryError: Metaspace?</strong></summary>

**A:** (1) **Class loader leak**: ClassLoader không được GC (vẫn có strong reference) → tất cả class nó load vẫn trong Metaspace. Thường xảy ra với framework dynamic class generation (CGLIB, reflection heavy code). (2) **Dynamic class generation không kiểm soát**: Groovy, CGLIB, ByteBuddy tạo quá nhiều class. (3) **MaxMetaspaceSize quá nhỏ** cho ứng dụng thực sự cần nhiều class. Debug: `jcmd <pid> VM.metaspace` (Metaspace dùng bao nhiêu, cho loader nào) và `jcmd <pid> VM.classloader_stats` (số class theo từng ClassLoader — loader cũ vẫn còn class là dấu hiệu leak). `VM.class_stats` không còn trên JDK hiện đại (JDK 21 không có lệnh này).

</details>

<details>
<summary><strong>Spring AOP ảnh hưởng đến Metaspace như thế nào?</strong></summary>

**A:** Spring AOP tạo **CGLIB proxy** cho mỗi bean cần proxy (`@Transactional`, `@Cacheable`, `@Async`, custom aspect). Mỗi proxy là một class mới trong Metaspace. Với ứng dụng lớn (500+ bean được proxy), Metaspace usage tăng đáng kể. JDK proxy (chỉ cho interface) nhẹ hơn CGLIB (generate subclass). Spring Boot mặc định dùng CGLIB (`spring.aop.proxy-target-class=true`); đặt `false` để dùng JDK proxy cho bean có interface. Theo dõi: `/actuator/metrics/jvm.memory.used?tag=area:nonheap`.

</details>
