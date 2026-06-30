---
key: "Metaspace"
title: "Metaspace"
crumb: "1. Core Java › JVM Internals"
---

Metaspace (thay thế PermGen từ Java 8) lưu class metadata, bytecode method và static variable, tự động mở rộng trong native memory thay vì heap.

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
// - Static variables (references live in Metaspace; objects on heap)
// - JIT-compiled code stubs
// - Interned strings (moved from PermGen to heap in Java 7)

// ---- Static field clarification ----
public class OrderConfig {
    // The REFERENCE 'DEFAULT_CURRENCY' lives in Metaspace (class static area)
    // The String object "USD" lives on HEAP (interned string pool)
    public static final String DEFAULT_CURRENCY = "USD";

    // Map reference: Metaspace; HashMap object + entries: HEAP
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

1. Sự khác biệt giữa PermGen và Metaspace là gì?
1. Nguyên nhân nào gây ra OutOfMemoryError: Metaspace?
1. Spring AOP ảnh hưởng đến Metaspace như thế nào?
