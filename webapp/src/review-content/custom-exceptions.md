---
key: "Custom Exceptions"
title: "Custom Exception"
crumb: "1. Core Java › Exception Handling"
---

Custom exception diễn đạt rõ ràng các điều kiện lỗi domain, mang dữ liệu lỗi có cấu trúc và cho phép catch block nhắm chính xác vào loại lỗi đúng.

## Điểm Chính

- Extend <code>RuntimeException</code> cho hầu hết domain exception (không bắt buộc xử lý).
- Bao gồm cause khi bọc exception cấp thấp hơn để bảo toàn stack trace.
- Thêm field để mang thông tin lỗi có cấu trúc (error code, resource ID) — tránh nhồi tất cả vào message.
- Dùng hierarchy: <code>AppException</code> → <code>NotFoundException</code>, <code>ValidationException</code>, <code>ConflictException</code>.
- Map sang HTTP status trong <code>@ControllerAdvice</code>, không phải trong chính exception.

## Ví Dụ Code

*Custom exception hierarchy: AppException → OrderNotFoundException + PaymentFailedException + GlobalExceptionHandler*

```java
// ---- Exception hierarchy for an Order domain ----
// Base: all app exceptions share a common root for global handler
public class AppException extends RuntimeException {
    private final String errorCode;

    public AppException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
    public AppException(String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }
    public String getErrorCode() { return errorCode; }
}

// Leaf exception: carries structured context (resource type + id)
public class OrderNotFoundException extends AppException {
    private final long orderId;

    public OrderNotFoundException(long orderId) {
        super("ORDER_NOT_FOUND", "Order not found with id: " + orderId);
        this.orderId = orderId;
    }
    public long getOrderId() { return orderId; }
}

// Leaf exception: payment failure with gateway error detail
public class PaymentFailedException extends AppException {
    private final String gatewayErrorCode;
    private final long   amountCents;

    public PaymentFailedException(String gatewayErrorCode, long amountCents, Throwable cause) {
        super("PAYMENT_FAILED",
              String.format("Payment of %d cents failed: %s", amountCents, gatewayErrorCode),
              cause);
        this.gatewayErrorCode = gatewayErrorCode;
        this.amountCents      = amountCents;
    }
    public String getGatewayErrorCode() { return gatewayErrorCode; }
    public long   getAmountCents()      { return amountCents; }
}

// ---- Domain service throws structured exceptions ----
@Service
public class OrderService {
    public Order getOrder(long orderId) {
        return orderRepository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));
    }

    public PaymentResult chargeOrder(long orderId, PaymentMethod method) {
        Order order = getOrder(orderId);
        try {
            return paymentGateway.charge(method, order.totalAmount());
        } catch (GatewayException e) {
            throw new PaymentFailedException(e.getCode(), order.totalAmount().longValue(), e);
        }
    }
}

// ---- Central HTTP mapping — one place, clean separation ----
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(OrderNotFoundException e) {
        log.warn("Order not found: {}", e.getOrderId());
        return new ErrorResponse(e.getErrorCode(), e.getMessage());
    }

    @ExceptionHandler(PaymentFailedException.class)
    @ResponseStatus(HttpStatus.PAYMENT_REQUIRED)
    public ErrorResponse handlePaymentFailed(PaymentFailedException e) {
        log.error("Payment failed [{}]: {}", e.getGatewayErrorCode(), e.getMessage());
        return new ErrorResponse(e.getErrorCode(), "Payment could not be processed");
        // NOTE: don't leak gateway error details to client — log them server-side
    }

    @ExceptionHandler(AppException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse handleGeneral(AppException e) {
        log.error("Unhandled app error [{}]", e.getErrorCode(), e);
        return new ErrorResponse(e.getErrorCode(), "An internal error occurred");
    }
}
```

## Ứng Dụng Thực Tế

Định nghĩa exception hierarchy trong shared module. Map mỗi exception sang HTTP status trong một <code>@ControllerAdvice</code> trung tâm. Cách này service ném domain exception thoải mái, và web layer xử lý HTTP translation gọn gàng.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Domain exception tùy chỉnh nên là checked hay unchecked? Tại sao?</strong></summary>

**A:** **Unchecked (RuntimeException)** là best practice hiện đại: (1) Caller không bị buộc handle — exception thường lan lên đến global handler. (2) Phù hợp với functional programming (lambda). (3) Không pollute method signatures với `throws`. (4) Spring, JPA, Hibernate đều dùng unchecked exception. Checked chỉ hợp lý cho recoverable scenario mà caller *thực sự* có thể handle (ví dụ `FileNotFoundException` — caller có thể prompt user chọn file khác).

</details>

<details>
<summary><strong>Làm thế nào để map custom exception sang HTTP status code trong Spring?</strong></summary>

**A:** Dùng `@ResponseStatus` trên exception class:
```java
@ResponseStatus(HttpStatus.NOT_FOUND)
public class ResourceNotFoundException extends RuntimeException { ... }
```
Hoặc trong `@ControllerAdvice` với `@ExceptionHandler` để control response body:
```java
@ExceptionHandler(ResourceNotFoundException.class)
public ResponseEntity<ErrorResponse> handle(ResourceNotFoundException e) {
    return ResponseEntity.status(404).body(new ErrorResponse(e.getMessage()));
}
```

</details>

<details>
<summary><strong>Rủi ro của việc đặt business logic trong constructor của exception là gì?</strong></summary>

**A:** (1) **Exception trong exception constructor** → throw exception khi xây dựng exception → NullPointerException hoặc IllegalArgumentException bị throw thay vì exception gốc, che giấu nguyên nhân thực. (2) **Side effects** (log, network call) trong exception constructor → không control được timing, ngăn exception được dùng làm test helper. (3) **Performance**: constructor phức tạp được gọi mỗi lần throw, kể cả trong hot path. Giải pháp: exception chỉ nên giữ message và cause, không làm gì thêm.

</details>
