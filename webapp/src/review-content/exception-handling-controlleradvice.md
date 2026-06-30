---
key: "Exception Handling (@ControllerAdvice)"
title: "Xử Lý Exception với @ControllerAdvice"
crumb: "3. Spring Ecosystem › Spring MVC"
---

<code>@ControllerAdvice</code> cung cấp cơ chế tập trung để xử lý exception trên tất cả controller, map domain exception sang HTTP response một cách nhất quán.

## Điểm Chính

- <code>@ExceptionHandler(ExceptionType.class)</code>: method xử lý loại exception đó từ bất kỳ controller nào.
- <code>@ResponseStatus</code>: đặt HTTP status. <code>ResponseEntity</code>: kiểm soát response đầy đủ.
- Thứ tự giải quyết: class exception cụ thể nhất trước, sau đó superclass.
- <code>BindException</code> / <code>MethodArgumentNotValidException</code>: xử lý lỗi validation <code>@Valid</code>.
- <code>@RestControllerAdvice</code> = <code>@ControllerAdvice</code> + <code>@ResponseBody</code> — trả về JSON theo mặc định.

## Ví Dụ Code

*@RestControllerAdvice: OrderNotFoundException (404), PaymentFailed (402), @Valid errors (400), DataIntegrity (409), catch-all (500) + ErrorResponse DTO*

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.dao.DataIntegrityViolationException;
import java.time.Instant;

// ---- Consistent error response DTO ----
public record ErrorResponse(
    String    code,       // machine-readable: "ORDER_NOT_FOUND", "VALIDATION_FAILED"
    String    message,    // human-readable: exposed to API consumers
    Instant   timestamp,
    String    path        // which endpoint failed
) {
    public static ErrorResponse of(String code, String message, String path) {
        return new ErrorResponse(code, message, Instant.now(), path);
    }
}

// ---- @RestControllerAdvice: single class handles exceptions from ALL controllers ----
// = @ControllerAdvice + @ResponseBody (responses are JSON by default)
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // ---- Domain exceptions: map to specific HTTP status ----

    @ExceptionHandler(OrderNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)                          // 404
    public ErrorResponse handleOrderNotFound(OrderNotFoundException ex,
                                              HttpServletRequest request) {
        log.warn("Order not found: orderId={}", ex.getOrderId());
        // NOTE: safe to include ex.getMessage() — it only contains order ID, not internal details
        return ErrorResponse.of("ORDER_NOT_FOUND", ex.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(PaymentFailedException.class)
    public ResponseEntity<ErrorResponse> handlePaymentFailed(PaymentFailedException ex,
                                                               HttpServletRequest request) {
        // Use ResponseEntity when status is dynamic (e.g. depends on exception fields)
        log.error("Payment failed: gatewayCode={}, amount={}", ex.getGatewayCode(), ex.getAmountCents());
        ErrorResponse body = ErrorResponse.of("PAYMENT_FAILED",
            "Payment could not be processed. Please try again.",  // NEVER expose gateway details
            request.getRequestURI());
        return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(body);    // 402
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.CONFLICT)                           // 409 — e.g. cancel SHIPPED order
    public ErrorResponse handleConflict(IllegalStateException ex, HttpServletRequest request) {
        log.warn("Business rule violation: {}", ex.getMessage());
        return ErrorResponse.of("BUSINESS_RULE_VIOLATION", ex.getMessage(), request.getRequestURI());
    }

    // ---- Spring MVC validation: @Valid on @RequestBody fails ----
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)                        // 400
    public ErrorResponse handleValidation(MethodArgumentNotValidException ex,
                                          HttpServletRequest request) {
        // Collect all field errors into a readable message
        String details = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
            .collect(Collectors.joining("; "));
        log.debug("Validation failed: {}", details);
        return ErrorResponse.of("VALIDATION_FAILED",
            "Request validation failed: " + details,
            request.getRequestURI());
    }

    // ---- Database constraint violation (e.g. duplicate order ID) ----
    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)                           // 409
    public ErrorResponse handleDataIntegrity(DataIntegrityViolationException ex,
                                              HttpServletRequest request) {
        // DO NOT expose raw SQL error — log internally, return generic message
        log.error("Data integrity violation at {}: {}", request.getRequestURI(), ex.getMessage());
        return ErrorResponse.of("DATA_CONFLICT",
            "A resource with the same unique identifier already exists.",
            request.getRequestURI());
    }

    // ---- Catch-all: last resort for unexpected exceptions ----
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)              // 500
    public ErrorResponse handleAll(Exception ex, HttpServletRequest request) {
        // Log full stack trace server-side — NEVER send it to the client
        log.error("Unhandled exception at {}", request.getRequestURI(), ex);
        return ErrorResponse.of("INTERNAL_ERROR",
            "An unexpected error occurred. Please contact support.",
            request.getRequestURI());
        // Response: {"code":"INTERNAL_ERROR","message":"An unexpected...","timestamp":"...","path":"/api/v1/orders"}
    }
}
```

## Ứng Dụng Thực Tế

Luôn trả về cấu trúc error response nhất quán (error code + message + timestamp + path). Đừng bao giờ lộ stack trace hoặc tên class nội bộ cho client. Chỉ log exception đầy đủ phía server.

## Câu Hỏi Phỏng Vấn

1. @ControllerAdvice khác try-catch trong mỗi controller thế nào?
1. Spring giải quyết nhiều @ExceptionHandler method theo thứ tự nào?
1. Làm thế nào để xử lý lỗi validation từ @Valid?
