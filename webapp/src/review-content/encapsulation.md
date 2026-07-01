---
key: "Encapsulation"
title: "Đóng Gói (Encapsulation)"
crumb: "1. Core Java › OOP"
---

Encapsulation hạn chế truy cập trực tiếp vào nội bộ đối tượng, chỉ lộ hành vi qua một interface được định nghĩa rõ ràng, giảm bug do mutation state ngoài ý muốn.

## Điểm Chính

- Dùng field <code>private</code>; expose qua <code>public</code> getter/setter hoặc các method có ý nghĩa.
- Validation nằm trong setter/constructor — một nơi duy nhất để đảm bảo invariant.
- Immutable class (toàn field final, không có setter) là hình thức encapsulation mạnh nhất.
- Java 16+ <code>record</code> tự động cung cấp encapsulation + immutability.

## Ví Dụ Code

*Encapsulation: validation trong constructor và controlled mutation*

```java
import java.util.Objects;
import java.math.BigDecimal;

// Encapsulation: all state is private; behavior exposed via a clean API
public final class OrderItem {
    private final String productId;
    private final String productName;
    private int quantity;          // mutable — controlled via setter
    private final BigDecimal unitPrice;

    public OrderItem(String productId, String productName, int quantity, BigDecimal unitPrice) {
        // Validation lives in ONE place — invariants always upheld
        if (quantity <= 0) throw new IllegalArgumentException("Quantity must be > 0, got: " + quantity);
        if (unitPrice.compareTo(BigDecimal.ZERO) < 0)
            throw new IllegalArgumentException("Unit price cannot be negative");
        this.productId   = Objects.requireNonNull(productId);
        this.productName = Objects.requireNonNull(productName);
        this.quantity    = quantity;
        this.unitPrice   = unitPrice;
    }

    // Controlled mutation — enforces the same invariant as the constructor
    public void updateQuantity(int newQty) {
        if (newQty <= 0) throw new IllegalArgumentException("Quantity must be > 0");
        this.quantity = newQty;
    }

    // Computed behaviour — callers never need to know how total is calculated
    public BigDecimal totalPrice() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }

    // Read-only accessors — no setter for productId/unitPrice (immutable business keys)
    public String getProductId()   { return productId; }
    public String getProductName() { return productName; }
    public int    getQuantity()    { return quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
}

// --- Usage ---
OrderItem item = new OrderItem("P-001", "Laptop Pro", 2, new BigDecimal("1299.99"));
item.updateQuantity(3);
System.out.println(item.totalPrice()); // 3899.97 — caller never touches internal math
```

## Ứng Dụng Thực Tế

Value object bất biến (Money, UserId) phòng tránh cả lớp bug threading mà không cần synchronization. Dùng <code>record</code> trong Java 16+ để tạo immutable DTO ngắn gọn.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Encapsulation khác information hiding như thế nào?</strong></summary>

**A:** **Encapsulation**: kỹ thuật bundling data và behavior vào cùng class, với access modifier (private/protected/public) kiểm soát truy cập — *cơ chế*. **Information hiding**: nguyên tắc thiết kế — ẩn implementation detail, chỉ expose interface cần thiết — *mục tiêu*. Encapsulation là công cụ để đạt information hiding. Ví dụ: private field + getter/setter là encapsulation; nhưng nếu setter expose toàn bộ internal state → encapsulation nhưng không information hiding.

</details>

<details>
<summary><strong>Tại sao immutable class mặc định thread-safe?</strong></summary>

**A:** Immutable object không có state mutation sau khi khởi tạo → không có race condition khi nhiều thread cùng đọc cùng lúc — không cần synchronization. String, Integer, LocalDate trong Java là immutable và thread-safe. Điều kiện immutable: tất cả fields phải `final`, không có setter, fields mutable (collection) phải defensive copy trong constructor. **Shared-nothing** là cách scale dễ nhất: immutable data pass between threads.

</details>

<details>
<summary><strong>Vấn đề gì xảy ra khi trả về trực tiếp field collection có thể thay đổi?</strong></summary>

**A:** Caller nhận reference đến internal collection, có thể modify → phá vỡ invariant của class:
```java
public List<String> getItems() { return this.items; } // unsafe!
cart.getItems().clear(); // xóa internal state!
```
Fix: trả về **defensive copy** hoặc **unmodifiable view**:
```java
return Collections.unmodifiableList(this.items); // view, thay đổi ném UnsupportedOperationException
return new ArrayList<>(this.items); // deep copy
return List.copyOf(this.items); // Java 10+, immutable copy
```

</details>
