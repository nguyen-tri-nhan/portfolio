---
key: "Interface vs Abstract Class"
title: "Interface vs Abstract Class"
crumb: "1. Core Java › OOP"
---

Cả hai đều định nghĩa hợp đồng nhưng khác nhau về state, access modifier và trường hợp sử dụng: dùng interface cho các type không liên quan chia sẻ hành vi, abstract class cho các type liên quan chia sẻ code.

## Điểm Chính

- <strong>Interface</strong>: toàn method public, không có instance state, cho phép đa implement.
- <strong>Abstract class</strong>: có thể có bất kỳ access modifier, instance state, constructor và partial implementation.
- Java 8+: interface có thể có method <code>default</code> và <code>static</code>.
- Java 9+: interface có thể có method <code>private</code> (dùng cho helper của default method).
- Một class có thể implement nhiều interface nhưng chỉ extend một abstract class.
- Nguyên tắc: mặc định dùng interface; dùng abstract class khi cần shared state hoặc template-method pattern.

## Ví Dụ Code

*Interface vs Abstract Class: Auditable/Exportable interfaces + BaseOrder abstract class*

```java
import java.time.Instant;

// ---------- Interfaces: capability contracts (unrelated implementors possible) ----------
public interface Auditable {
    Instant getCreatedAt();
    String  getCreatedBy();
    Instant getUpdatedAt();
    String  getUpdatedBy();
}

public interface Exportable {
    String toJson();    // export to JSON string
    byte[] toCsv();     // export to CSV bytes
}

public interface Searchable {
    String toSearchIndex();  // text for full-text search engine

    // Default: bulk-indexing prefix; implementors can override
    default String indexPrefix() { return "doc"; }
}

// ---------- Abstract class: shared domain state for all Order variants ----------
public abstract class BaseOrder implements Auditable {
    private final String  orderId;
    private final String  customerId;
    private final Instant createdAt;
    private final String  createdBy;
    private Instant updatedAt;
    private String  updatedBy;

    protected BaseOrder(String orderId, String customerId, String createdBy) {
        this.orderId     = Objects.requireNonNull(orderId);
        this.customerId  = Objects.requireNonNull(customerId);
        this.createdBy   = Objects.requireNonNull(createdBy);
        this.createdAt   = Instant.now();
        this.updatedAt   = this.createdAt;
        this.updatedBy   = createdBy;
    }

    // Subclasses define their own total calculation
    public abstract BigDecimal totalAmount();

    // Shared concrete behaviour — same for all order types
    protected void markUpdated(String by) {
        this.updatedAt = Instant.now();
        this.updatedBy = by;
    }

    // Auditable implementation — all subclasses get this for free
    @Override public Instant getCreatedAt() { return createdAt; }
    @Override public String  getCreatedBy() { return createdBy; }
    @Override public Instant getUpdatedAt() { return updatedAt; }
    @Override public String  getUpdatedBy() { return updatedBy; }

    public String getOrderId()    { return orderId; }
    public String getCustomerId() { return customerId; }
}

// Concrete class: inherits shared state, adds export/search capability via interfaces
public class PhysicalOrder extends BaseOrder implements Exportable, Searchable {
    private final List<OrderItem> items;
    private final ShippingAddress shippingAddress;

    public PhysicalOrder(String orderId, String customerId, String createdBy,
                         List<OrderItem> items, ShippingAddress address) {
        super(orderId, customerId, createdBy);
        this.items           = List.copyOf(items);       // defensive copy
        this.shippingAddress = Objects.requireNonNull(address);
    }

    @Override
    public BigDecimal totalAmount() {
        return items.stream().map(OrderItem::totalPrice)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Override public String  toJson()         { return JsonUtil.toJson(this); }
    @Override public byte[]  toCsv()          { return CsvUtil.toCsv(this); }
    @Override public String  toSearchIndex()  { return getOrderId() + " " + shippingAddress.getCity(); }
}
```

## Ứng Dụng Thực Tế

Trong Spring Boot: <code>Repository</code> (interface) + <code>SimpleJpaRepository</code> (base class với default implementation). Áp dụng pattern tương tự cho domain: định nghĩa interface, cung cấp default implementation, cho phép override.

## Câu Hỏi Phỏng Vấn

1. Có thể thêm method mới vào interface mà không phá vỡ implementation hiện tại không?
1. Abstract method và default method trong Java 8 khác nhau thế nào?
1. Khi nào bạn chọn abstract class thay vì interface trong codebase lớn?
