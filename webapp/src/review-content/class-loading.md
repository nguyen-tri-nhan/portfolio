---
key: "Class Loading"
title: "Class Loading"
crumb: "1. Core Java › JVM Internals"
---

Hệ thống ClassLoader tải, liên kết (verify/prepare/resolve) và khởi tạo bytecode class khi lần đầu sử dụng, theo mô hình parent-delegation để đảm bảo bảo mật và nhất quán.

## Điểm Chính

- <strong>Bootstrap ClassLoader</strong>: tải các class JDK core (<code>java.lang.*</code>) từ chính JDK.
- <strong>Platform/Extension ClassLoader</strong>: tải các module extension JDK.
- <strong>Application ClassLoader</strong>: tải các class ứng dụng từ classpath.
- Parent delegation: con hỏi cha trước; chỉ tự tải nếu cha không tìm thấy — ngăn thay thế độc hại các class core.
- Class được tải lazily khi lần đầu sử dụng, không phải lúc khởi động.
- <code>Class.forName("com.example.Foo")</code> tải class một cách tường minh.

## Ví Dụ Code

*Custom ClassLoader: parent delegation + hot-reload DiscountEngine + leak warning*

```java
import java.nio.file.*;
import java.io.IOException;

// ---- Parent Delegation Model ----
// When loading "com.example.Order":
//   ApplicationClassLoader → asks Platform (Extension) CL → asks Bootstrap CL
//   Bootstrap: "not my class" → Platform: "not mine" → Application: loads from classpath
// This prevents app code from replacing java.lang.String etc.

// ---- Custom ClassLoader: hot-reload discount rules at runtime ----
// Use case: business team updates DiscountStrategy .class files without restarting the app
public class RuleHotReloadClassLoader extends ClassLoader {
    private final Path ruleDir;

    public RuleHotReloadClassLoader(Path ruleDir, ClassLoader parent) {
        super(parent);   // always pass parent — preserves delegation chain
        this.ruleDir = ruleDir;
    }

    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        // Only intercept rule classes; delegate everything else to parent
        if (!name.startsWith("com.example.rules.")) {
            return super.findClass(name);
        }

        Path classFile = ruleDir.resolve(name.replace('.', '/') + ".class");
        if (!Files.exists(classFile)) {
            throw new ClassNotFoundException("Rule class not found: " + name);
        }
        try {
            byte[] bytes = Files.readAllBytes(classFile);
            return defineClass(name, bytes, 0, bytes.length);
        } catch (IOException e) {
            throw new ClassNotFoundException("Failed to load rule: " + name, e);
        }
    }
}

// ---- Using the hot-reload loader ----
public class DiscountEngine {
    private volatile RuleHotReloadClassLoader ruleLoader;

    public DiscountEngine(Path rulesDir) {
        this.ruleLoader = new RuleHotReloadClassLoader(rulesDir, getClass().getClassLoader());
    }

    // Called when rule .class files change on disk
    public synchronized void reloadRules(Path rulesDir) {
        // Old loader (and the classes it defined) become eligible for GC
        this.ruleLoader = new RuleHotReloadClassLoader(rulesDir, getClass().getClassLoader());
    }

    public BigDecimal applyDiscount(Order order) throws Exception {
        Class<?> ruleClass = ruleLoader.loadClass("com.example.rules.SeasonalDiscount");
        DiscountRule rule = (DiscountRule) ruleClass.getDeclaredConstructor().newInstance();
        return rule.apply(order);
    }
}

// ---- ClassLoader leak warning ----
// If 'ruleLoader' is referenced by a long-lived object (static field, thread local)
// after reload, the old ClassLoader and ALL classes it loaded stay in Metaspace → OOM
// Fix: make the ClassLoader reference replaceable (volatile field, or WeakReference)
```

## Ứng Dụng Thực Tế

Spring DevTools dùng custom class loader để hot-reload. ClassLoader leak (giữ tham chiếu đến class sau khi undeploy) gây Metaspace OOM trong application server. Luôn dùng <code>Thread.currentThread().getContextClassLoader()</code> trong code framework.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Parent delegation model là gì và tại sao quan trọng?</strong></summary>

**A:** Khi ClassLoader nhận yêu cầu load class, nó delegate cho parent trước khi tự load. Thứ tự: Bootstrap (rt.jar / jdk modules) → Platform (Extension) → Application → Custom. Kết quả: `java.lang.String` luôn được load bởi Bootstrap — không thể override bằng class cùng tên trong classpath. Bảo vệ tính toàn vẹn của core Java libraries. OSGi và Java Module System (JPMS) phá vỡ parent delegation model có kiểm soát để đạt module isolation.

</details>

<details>
<summary><strong>Khi nào cần implement custom ClassLoader?</strong></summary>

**A:** Custom ClassLoader cần khi: (1) Hot reload — load class mới từ filesystem mà không restart JVM (dùng trong dev server như Spring DevTools), (2) Plugin isolation — mỗi plugin có ClassLoader riêng, class của plugin A không xung đột với plugin B (Tomcat webapps, IDE plugins), (3) Load bytecode từ nguồn khác (network, encrypted storage, database). Extend `ClassLoader`, override `findClass()` — không override `loadClass()` để giữ parent delegation.

</details>
