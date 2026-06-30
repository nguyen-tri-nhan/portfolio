---
key: "Prototype"
title: "Prototype Pattern"
crumb: "10. Design Patterns › Creational"
---

Prototype tạo object bằng cách clone instance có sẵn, tránh khởi tạo tốn kém khi tạo nhiều object tương tự.

## Điểm Chính

- Java: implement <code>Cloneable</code> + override <code>clone()</code>. Nhưng <code>Cloneable</code> được coi là broken (shallow mặc định).
- Tốt hơn: copy constructor — rõ ràng, type-safe, deep copy.
- Trick Jackson: <code>objectMapper.readValue(objectMapper.writeValueAsString(original), Type.class)</code> — JSON deep clone.
- Use case: document template, game entity cloning, config snapshot.

## Ví Dụ Code

*Copy constructor deep clone + Jackson deepClone utility + Spring prototype scope*

```java
// ── 1. Copy constructor — preferred over Cloneable (explicit, type-safe) ─────
public class OrderTemplate {
    private String       templateName;
    private List<OrderItem> defaultItems;   // must be deep copied
    private BigDecimal   defaultDiscount;
    private String       currency;

    // Copy constructor: explicit deep clone
    public OrderTemplate(OrderTemplate src) {
        this.templateName    = src.templateName;      // String: immutable, safe to share
        this.defaultItems    = src.defaultItems.stream()
                                   .map(OrderItem::copy)  // deep copy each item
                                   .collect(Collectors.toList());
        this.defaultDiscount = src.defaultDiscount;   // BigDecimal: immutable
        this.currency        = src.currency;
    }

    public OrderTemplate clone() { return new OrderTemplate(this); }

    // Factory methods for common templates
    public static OrderTemplate flashSaleTemplate() {
        OrderTemplate t = new OrderTemplate();
        t.templateName    = "Flash Sale Order";
        t.defaultDiscount = new BigDecimal("30");   // 30% off
        t.currency        = "VND";
        return t;
    }
}

// Usage: clone template and customize — avoids rebuilding from scratch
OrderTemplate base    = OrderTemplate.flashSaleTemplate();
OrderTemplate copy1   = base.clone();
copy1.setTemplateName("Flash Sale - Electronics");
copy1.addItem(new OrderItem("laptop-01", 1, new BigDecimal("15000000")));

OrderTemplate copy2   = base.clone();   // base is untouched
copy2.setTemplateName("Flash Sale - Phones");

// ── 2. Jackson deep clone — convenient for DTOs ────────────────────────────
@Component
public class DeepCloner {
    private final ObjectMapper mapper;
    public DeepCloner(ObjectMapper mapper) { this.mapper = mapper; }

    public <T> T deepClone(T obj, Class<T> type) {
        try {
            // Serialize → deserialize: simple deep clone for any serializable object
            String json = mapper.writeValueAsString(obj);
            return mapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Deep clone failed for: " + type.getSimpleName(), e);
        }
    }
}
// Usage
OrderRequest clonedRequest = deepCloner.deepClone(originalRequest, OrderRequest.class);

// ── 3. Spring prototype scope — new instance per injection point ─────────────
@Component
@Scope(value = ConfigurableBeanFactory.SCOPE_PROTOTYPE, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class ShoppingCart {
    private final List<CartItem> items = new ArrayList<>();
    private String sessionId;
    // Each injection point / each request gets a fresh ShoppingCart instance
    public void addItem(CartItem item) { items.add(item); }
}

// ⚠️ Prototype into Singleton: must use @Lookup or ObjectProvider — not @Autowired directly
@Service
public class CheckoutService {
    @Autowired ObjectProvider<ShoppingCart> cartProvider;
    public ShoppingCart newCart(String sessionId) {
        ShoppingCart cart = cartProvider.getObject();  // always new instance
        cart.setSessionId(sessionId);
        return cart;
    }
}
```

## Ứng Dụng Thực Tế

Ưu tiên copy constructor hơn Cloneable. Jackson deep clone tiện lợi cho DTO nhưng chậm với hot path performance-critical. Dùng prototype khi xây object mới từ đầu tốn kém hơn đáng kể so với clone.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa shallow clone và deep clone?
1. Tại sao Cloneable được coi là broken trong Java?
1. Khi nào dùng Prototype thay vì Factory?
