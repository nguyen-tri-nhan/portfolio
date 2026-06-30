---
key: "Inheritance"
title: "Kế Thừa (Inheritance)"
crumb: "1. Core Java › OOP"
---

Inheritance cho phép subclass tái sử dụng và chuyên biệt hóa parent class; Java hỗ trợ đơn kế thừa class nhưng đa kế thừa interface, và lạm dụng sẽ dẫn đến tight coupling.

## Điểm Chính

- <code>extends</code> cho kế thừa class; <code>implements</code> cho interface.
- Override method yêu cầu cùng chữ ký + annotation <code>@Override</code> (tránh lỗi đánh máy).
- <code>super()</code> gọi constructor cha; phải là câu lệnh đầu tiên.
- Class hoặc method <code>final</code> ngăn kế thừa/override thêm.
- Liskov Substitution Principle: subclass phải thay thế được cho parent mà không làm hỏng hành vi.
- Hierarchy kế thừa sâu trở nên dễ vỡ — ưu tiên interface + composition.

## Ví Dụ Code

*Inheritance: PaymentMethod hierarchy với shared state và subclass contracts*

```java
import java.math.BigDecimal;
import java.util.Objects;

// Base class: shared state + common behaviour for all payment methods
public abstract class PaymentMethod {
    private final String paymentId;
    private final String ownerId;    // user who owns this payment method

    protected PaymentMethod(String paymentId, String ownerId) {
        this.paymentId = Objects.requireNonNull(paymentId);
        this.ownerId   = Objects.requireNonNull(ownerId);
    }

    // Shared final behaviour — subclasses cannot override (prevents LSP violations)
    public final String getPaymentId() { return paymentId; }
    public final String getOwnerId()   { return ownerId; }

    // Contract for subclasses: each payment type handles charge differently
    public abstract PaymentResult charge(BigDecimal amount, String currency);
    public abstract boolean      supportsRefund();
    public abstract String       getDisplayName();   // e.g. "Visa **** 4242"
}

// Subclass 1: Credit card — inherits base fields, adds card-specific logic
public class CreditCardPayment extends PaymentMethod {
    private final String maskedNumber;   // e.g. "**** **** **** 4242"
    private final String network;        // VISA, MASTERCARD

    public CreditCardPayment(String paymentId, String ownerId,
                             String maskedNumber, String network) {
        super(paymentId, ownerId);       // super() must be first
        this.maskedNumber = maskedNumber;
        this.network = network;
    }

    @Override
    public PaymentResult charge(BigDecimal amount, String currency) {
        // Card-specific logic: fraud check, 3DS, etc.
        return stripeGateway.charge(getPaymentId(), amount, currency);
    }

    @Override public boolean supportsRefund() { return true; }

    @Override public String getDisplayName() {
        return network + " " + maskedNumber;  // "VISA **** 4242"
    }
}

// Subclass 2: Wallet — different charge mechanism, no refund
public class DigitalWalletPayment extends PaymentMethod {
    private BigDecimal balance;

    public DigitalWalletPayment(String paymentId, String ownerId, BigDecimal balance) {
        super(paymentId, ownerId);
        this.balance = balance;
    }

    @Override
    public PaymentResult charge(BigDecimal amount, String currency) {
        if (balance.compareTo(amount) < 0)
            return PaymentResult.failure("Insufficient wallet balance");
        balance = balance.subtract(amount);
        return PaymentResult.success(getPaymentId());
    }

    @Override public boolean supportsRefund() { return false; }
    @Override public String  getDisplayName() { return "Wallet (balance: " + balance + ")"; }
}
```

## Ứng Dụng Thực Tế

Trong Spring, tránh subclass các framework class trừ khi tài liệu cho phép. Ưu tiên implement interface như <code>ApplicationListener</code> hoặc <code>HandlerInterceptor</code> thay vì extend abstract adapter (thường bị deprecated để nhường chỗ cho interface với default method).

## Câu Hỏi Phỏng Vấn

1. Diamond problem là gì và Java giải quyết nó thế nào?
1. Khi nào inheritance phù hợp hơn composition?
1. Liskov Substitution Principle có ý nghĩa gì trong thực tế?
