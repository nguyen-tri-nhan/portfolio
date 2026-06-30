---
key: "Strategy"
title: "Strategy Pattern"
crumb: "10. Design Patterns › Behavioral"
---

Strategy encapsulate thuật toán đằng sau interface và làm chúng có thể thay thế lúc runtime — loại bỏ khối if-else/switch lớn và cho phép Open/Closed Principle.

## Điểm Chính

- Định nghĩa interface cho thuật toán. Một class mỗi variant. Client giữ strategy reference.
- Swap strategy lúc runtime không cần thay đổi class sử dụng.
- Spring: inject tất cả strategy bean, build registry map. Strategy mới = @Component mới.
- Ví dụ: sorting, pricing, validation, authentication, notification channel.

## Ví Dụ Code

*PricingStrategy: RegularPricing/VipPricing/FlashSalePricing — Spring Map injection, OCP*

```java
// ── Step 1: Strategy interface ────────────────────────────────────────────────
public interface PricingStrategy {
    String customerType();                              // discriminator for registry
    BigDecimal calculate(BigDecimal basePrice);
    boolean isApplicable(Order order);                 // optional guard
}

// ── Step 2: concrete strategies — each a @Component ─────────────────────────
@Component
class RegularPricing implements PricingStrategy {
    public String customerType() { return "REGULAR"; }
    public boolean isApplicable(Order o) { return o.getCustomerType() == CustomerType.REGULAR; }
    public BigDecimal calculate(BigDecimal base) { return base; }   // no discount
}

@Component
class VipPricing implements PricingStrategy {
    public String customerType() { return "VIP"; }
    public boolean isApplicable(Order o) { return o.getCustomerType() == CustomerType.VIP; }
    public BigDecimal calculate(BigDecimal base) {
        return base.multiply(new BigDecimal("0.80"))   // 20% discount
                   .setScale(2, RoundingMode.HALF_UP);
    }
}

@Component
class FlashSalePricing implements PricingStrategy {
    private final FlashSaleRepository flashSaleRepo;   // strategy can have dependencies
    FlashSalePricing(FlashSaleRepository r) { this.flashSaleRepo = r; }

    public String customerType() { return "FLASH_SALE"; }
    public boolean isApplicable(Order o) {
        return flashSaleRepo.isActiveSale(o.getProductIds());
    }
    public BigDecimal calculate(BigDecimal base) {
        FlashSale sale = flashSaleRepo.getCurrentSale();
        return base.multiply(BigDecimal.ONE.subtract(sale.getDiscountRate()))
                   .setScale(2, RoundingMode.HALF_UP);
    }
}

// ── Step 3: PricingService — Spring injects all strategies automatically ─────
@Service
public class PricingService {
    private final Map<String, PricingStrategy> registry;

    // Spring collects ALL PricingStrategy beans and injects as a list
    public PricingService(List<PricingStrategy> strategies) {
        this.registry = strategies.stream()
            .collect(Collectors.toMap(PricingStrategy::customerType, Function.identity()));
        // { "REGULAR": RegularPricing, "VIP": VipPricing, "FLASH_SALE": FlashSalePricing }
    }

    public BigDecimal calculatePrice(Order order) {
        // Find strategy for this order
        PricingStrategy strategy = registry.getOrDefault(
            order.getCustomerType().name(),
            new RegularPricing()  // fallback
        );
        return strategy.calculate(order.getSubtotal());
    }

    // Runtime strategy selection — choose applicable one
    public BigDecimal calculateBestPrice(Order order) {
        return registry.values().stream()
            .filter(s -> s.isApplicable(order))
            .map(s -> s.calculate(order.getSubtotal()))
            .min(Comparator.naturalOrder())            // best (lowest) price for customer
            .orElse(order.getSubtotal());
    }
}

// ── Adding MemberPricing: ZERO changes to PricingService ────────────────────
// @Component class MemberPricing implements PricingStrategy { ... }
// Spring auto-discovers it → registry grows automatically
```

## Ứng Dụng Thực Tế

Khi bạn thêm case thứ ba vào pricing/validation switch, đó là tín hiệu để extract Strategy. Trong Spring, để DI container inject tất cả implementation vào registry — đây là cách tự nhiên và mở rộng nhất.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Strategy Pattern giải quyết vấn đề gì? Ví dụ thực tế.</strong></summary>

**A:** Thay vì if/switch chọn algorithm, encapsulate mỗi algorithm trong class riêng, swap runtime. Ví dụ: PaymentService có các strategy: CreditCardPayment, PayPalPayment, CryptoPayment. `paymentService.setStrategy(new CreditCardPayment()); paymentService.pay(amount);`. Khi thêm payment method mới: chỉ thêm class mới, không sửa PaymentService (Open/Closed Principle). Spring: inject strategy bằng `Map<String, PaymentStrategy>` — key là payment type, value là bean. Factory method để select strategy.

</details>
