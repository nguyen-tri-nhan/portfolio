---
key: "Creational"
title: "Creational Patterns"
crumb: "10. Design Patterns"
---

Creational pattern trừu tượng hóa và kiểm soát việc tạo object — Singleton, Factory Method, Builder, Prototype — tách client khỏi class cụ thể.

## Điểm Chính

- <strong>Singleton</strong>: một instance mỗi JVM. Spring singleton scope.
- <strong>Factory Method</strong>: subclass/implementation quyết định class nào được khởi tạo.
- <strong>Builder</strong>: xây dựng object phức tạp từng bước. Kết quả bất biến.
- <strong>Prototype</strong>: clone object có sẵn thay vì xây từ đầu.

## Ví Dụ Code

*4 Creational Patterns: Singleton / Factory Method / Builder / Prototype trong Order domain*

```java
// ── SINGLETON: one instance per JVM / Spring context ────────────────────────
// Spring way (preferred — testable via DI)
@Component public class OrderIdGenerator {
    private final AtomicLong counter = new AtomicLong(0);
    public String next() { return "ORD-" + counter.incrementAndGet(); }
}
// Manual (enum — simplest thread-safe singleton in Java)
enum AppConfig { INSTANCE;
    private final String region = System.getenv("AWS_REGION");
    public String region() { return region; }
}

// ── FACTORY METHOD: caller depends on interface, not concrete type ─────────
interface PaymentProcessor { String region(); PaymentResult charge(ChargeRequest req); }
@Component class StripeProcessor implements PaymentProcessor {
    public String region() { return "US"; }
    public PaymentResult charge(ChargeRequest req) { /* Stripe API call */ return new PaymentResult("stripe"); }
}
@Component class VNPayProcessor implements PaymentProcessor {
    public String region() { return "VN"; }
    public PaymentResult charge(ChargeRequest req) { /* VNPay API call */ return new PaymentResult("vnpay"); }
}
@Component class PaymentProcessorFactory {
    private final Map<String, PaymentProcessor> registry;
    PaymentProcessorFactory(List<PaymentProcessor> processors) {
        registry = processors.stream().collect(toMap(PaymentProcessor::region, p -> p));
    }
    public PaymentProcessor get(String region) { return registry.get(region); }
}

// ── BUILDER: fluent construction with validation ───────────────────────────
@Builder @Value public class Order {
    String userId;
    @Builder.Default List<OrderItem> items = new ArrayList<>();
    @Builder.Default String currency = "USD";
    @Builder.Default OrderStatus status = OrderStatus.PENDING;
}
Order o = Order.builder().userId("u1").currency("VND")
               .items(List.of(new OrderItem("p1", 2, new BigDecimal("50")))).build();

// ── PROTOTYPE: clone template instead of constructing from scratch ─────────
public class DocumentTemplate {
    private String title;
    private List<Section> sections;
    // Copy constructor — deep clone
    public DocumentTemplate(DocumentTemplate src) {
        this.title    = src.title;
        this.sections = src.sections.stream().map(Section::copy).toList();
    }
    public DocumentTemplate clone() { return new DocumentTemplate(this); }
}
DocumentTemplate invoice = invoiceTemplate.clone(); // reuse structure, change data
```

## Ứng Dụng Thực Tế

Dùng Lombok @Builder cho DTO/request nhiều field. Dùng Factory Method khi khởi tạo có conditional logic phức tạp làm ô nhiễm caller.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào dùng Builder thay vì constructor?</strong></summary>

**A:** Dùng Builder khi: (1) Class có nhiều optional parameter — tránh telescoping constructor (4-5 overloaded constructors). (2) Muốn immutable object với nhiều field. (3) Các parameter cùng type dễ nhầm lẫn thứ tự — Builder đặt tên rõ ràng. Ví dụ: `HttpRequest.newBuilder().GET().uri(url).timeout(Duration.ofSeconds(5)).build()`. Lombok `@Builder` generate tự động. Java records với compact constructor là alternative cho immutable simple DTO.

</details>

<details>
<summary><strong>Sự khác biệt giữa Factory Method và Abstract Factory?</strong></summary>

**A:** **Factory Method**: define interface để tạo object, subclass quyết định concrete class nào. Một product, nhiều variant qua subclassing. Ví dụ: `createConnection()` trong `PostgresRepository` vs `MysqlRepository`. **Abstract Factory**: interface để tạo **family of related objects** — tất cả cùng nhau. Ví dụ: `UIFactory` tạo `Button`, `TextField`, `Dialog` — `DarkUIFactory` vs `LightUIFactory` tạo consistent family. Abstract Factory dùng Factory Method nội bộ.

</details>

<details>
<summary><strong>Spring quản lý Singleton bean thế nào?</strong></summary>

**A:** Spring singleton: **một instance per ApplicationContext** (không phải per JVM như GoF Singleton). Container tạo bean khi context start (eager), giữ trong registry map (key=bean name, value=instance), inject cùng instance cho mọi dependency. Thread-safety: bean phải stateless hoặc dùng synchronized — Spring không tự make bean thread-safe. `@Scope("prototype")`: tạo instance mới mỗi lần inject/request. `@Scope("request")` cho web: một instance per HTTP request.

</details>
