---
key: "Polymorphism"
title: "Đa Hình (Polymorphism)"
crumb: "1. Core Java › OOP"
---

Polymorphism cho phép một interface đại diện cho nhiều dạng khác nhau — compile-time (overloading) và runtime (overriding) — tạo ra các thiết kế linh hoạt, dễ mở rộng.

## Điểm Chính

- <strong>Compile-time polymorphism</strong>: method overloading — cùng tên, khác tham số.
- <strong>Runtime polymorphism</strong>: method overriding — JVM dispatch đến type thực của object qua vtable.
- Tham chiếu interface cho phép hoán đổi implementation mà không thay đổi code gọi.
- <code>instanceof</code> + pattern matching (<code>instanceof Dog d</code>) để downcast an toàn.
- Covariant return type: method override có thể trả về subtype.

## Ví Dụ Code

*Compile-time overloading + runtime overriding trong Order system*

```java
import java.util.List;

// Compile-time polymorphism: method OVERLOADING (same name, different params)
public class OrderPriceCalculator {
    // Overload 1 — no discount
    public BigDecimal calculate(List<OrderItem> items) {
        return items.stream()
            .map(OrderItem::totalPrice)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
    // Overload 2 — with flat discount
    public BigDecimal calculate(List<OrderItem> items, BigDecimal discountAmount) {
        return calculate(items).subtract(discountAmount).max(BigDecimal.ZERO);
    }
    // Overload 3 — with percentage discount (different type → different overload)
    public BigDecimal calculate(List<OrderItem> items, double discountPercent) {
        BigDecimal subtotal = calculate(items);
        BigDecimal factor   = BigDecimal.valueOf(1.0 - discountPercent);
        return subtotal.multiply(factor);
    }
}

// Runtime polymorphism: method OVERRIDING — JVM dispatches via vtable
public interface NotificationChannel {
    void send(Order order, String message);
    default String channelName() { return getClass().getSimpleName(); }
}

public class EmailChannel implements NotificationChannel {
    @Override public void send(Order order, String message) {
        emailClient.send(order.getCustomerEmail(), "Order Update", message);
    }
}

public class SmsChannel implements NotificationChannel {
    @Override public void send(Order order, String message) {
        smsClient.send(order.getCustomerPhone(), message);
    }
}

public class PushChannel implements NotificationChannel {
    @Override public void send(Order order, String message) {
        pushService.push(order.getCustomerId(), message);
    }
}

// Caller works with the interface — runtime dispatch picks the right impl
public class OrderNotifier {
    private final List<NotificationChannel> channels;  // injected

    public void notifyShipped(Order order) {
        String msg = "Your order #" + order.getId() + " has been shipped!";
        channels.forEach(ch -> ch.send(order, msg));  // polymorphic dispatch
    }
}
```

## Ứng Dụng Thực Tế

Dependency injection của Spring khai thác runtime polymorphism — inject <code>Notifier</code>, Spring cung cấp đúng bean. Điều này cho phép hoán đổi implementation (email→SMS) mà không thay đổi code phía gọi.

## Câu Hỏi Phỏng Vấn

1. Giải thích sự khác biệt giữa method overloading và overriding.
1. JVM quyết định gọi method nào lúc runtime bằng cách nào?
1. Polymorphism hỗ trợ Open/Closed Principle như thế nào?
