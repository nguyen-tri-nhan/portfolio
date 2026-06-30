---
key: "Factory Method"
title: "Factory Method Pattern"
crumb: "10. Design Patterns › Creational"
---

Factory Method định nghĩa interface để tạo object nhưng để subclass quyết định class nào sẽ được khởi tạo — hỗ trợ Open/Closed Principle.

## Điểm Chính

- Creator định nghĩa abstract <code>create()</code>; concrete creator override cho product cụ thể.
- Caller phụ thuộc vào interface, không phải concrete type — decoupled khỏi khởi tạo.
- Ví dụ Spring: inject tất cả implementation vào registry map — thêm type mới không cần thay đổi code hiện có.

## Ví Dụ Code

*PaymentProcessorFactory: Stripe/PayPal/VNPay via Spring Map injection — OCP compliant*

```java
// ── Payment Processor Factory — returns correct impl by region/provider ─────
// Step 1: define interface with discriminator
interface PaymentProcessor {
    String getProvider();  // "STRIPE" | "PAYPAL" | "VNPAY"
    PaymentResult charge(ChargeRequest request);
    PaymentResult refund(String chargeId, BigDecimal amount);
}

// Step 2: concrete implementations — each a Spring @Component
@Component class StripeProcessor implements PaymentProcessor {
    public String getProvider() { return "STRIPE"; }
    public PaymentResult charge(ChargeRequest req) {
        // Stripe SDK call
        Charge charge = Stripe.charges.create(Map.of(
            "amount",   req.getAmountCents(),
            "currency", req.getCurrency().toLowerCase(),
            "source",   req.getCardToken()
        ));
        return new PaymentResult(charge.getId(), "SUCCEEDED");
    }
    public PaymentResult refund(String chargeId, BigDecimal amount) { /* ... */ return null; }
}

@Component class PayPalProcessor implements PaymentProcessor {
    public String getProvider() { return "PAYPAL"; }
    public PaymentResult charge(ChargeRequest req) { /* PayPal REST API */ return null; }
    public PaymentResult refund(String chargeId, BigDecimal amount) { /* ... */ return null; }
}

@Component class VNPayProcessor implements PaymentProcessor {
    public String getProvider() { return "VNPAY"; }
    public PaymentResult charge(ChargeRequest req) { /* VNPay integration */ return null; }
    public PaymentResult refund(String chargeId, BigDecimal amount) { /* ... */ return null; }
}

// Step 3: Factory — Spring auto-collects all implementations
@Component
public class PaymentProcessorFactory {
    private final Map<String, PaymentProcessor> registry;

    // Spring injects ALL PaymentProcessor beans — no manual wiring
    public PaymentProcessorFactory(List<PaymentProcessor> processors) {
        this.registry = processors.stream()
            .collect(Collectors.toMap(PaymentProcessor::getProvider, Function.identity()));
        // registry = { "STRIPE": StripeProcessor, "PAYPAL": PayPalProcessor, ... }
    }

    public PaymentProcessor getProcessor(String provider) {
        return Optional.ofNullable(registry.get(provider.toUpperCase()))
            .orElseThrow(() -> new UnsupportedPaymentProviderException(
                "No processor for provider: " + provider +
                ". Supported: " + registry.keySet()));
    }
}

// Step 4: Service uses factory — decoupled from concrete implementations
@Service
public class PaymentService {
    private final PaymentProcessorFactory factory;

    public PaymentResult processPayment(Order order, String provider) {
        PaymentProcessor processor = factory.getProcessor(provider);
        ChargeRequest request = ChargeRequest.from(order);
        return processor.charge(request);
    }
}

// Adding a new provider (e.g., MoMo):
// @Component class MoMoProcessor implements PaymentProcessor { ... }
// Zero changes to Factory, Service, or any other class — true OCP
```

## Ứng Dụng Thực Tế

Registry pattern là Factory Method idiom của Spring. Định nghĩa interface với discriminator method (<code>getRegion()</code>), để Spring thu thập tất cả implementation, build map. Strategy mới không cần thay đổi code hiện có.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Factory Method và Abstract Factory khác nhau thế nào?</strong></summary>

**A:** Factory Method: một method trong class tạo một loại object — subclass override để tạo loại cụ thể. Ví dụ: NotificationFactory có `createNotification()`, EmailFactory override tạo EmailNotification. Abstract Factory: interface tạo **family of related objects** — không chỉ một object mà nhiều objects liên quan (Button + Checkbox + Dialog theo theme). Dùng Factory Method khi: muốn subclass quyết định loại object. Abstract Factory khi: cần tạo nhóm objects phải compatible nhau.

</details>
