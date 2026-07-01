---
key: "Checked vs Unchecked"
title: "Checked vs Unchecked Exception"
crumb: "1. Core Java › Exception Handling"
---

Checked exception là một phần hợp đồng method (compiler bắt buộc); unchecked (subclass của RuntimeException) đại diện cho lỗi lập trình hoặc điều kiện không thể phục hồi.

## Điểm Chính

- <strong>Checked</strong>: <code>IOException</code>, <code>SQLException</code>, <code>ParseException</code> — người gọi phải xử lý hoặc khai báo <code>throws</code>.
- <strong>Unchecked</strong>: <code>NullPointerException</code>, <code>IllegalArgumentException</code>, <code>IllegalStateException</code> — chỉ ra bug.
- Phong cách Spring/Java hiện đại: ưu tiên unchecked exception cho domain error; checked exception cho I/O có thể phục hồi.
- Exception chaining: luôn truyền cause gốc: <code>new ServiceException("msg", cause)</code>.
- Multi-catch: <code>catch (IOException | ParseException e)</code> — xử lý gọn gàng các exception liên quan.

## Ví Dụ Code

*Checked vs unchecked: ConfigLoader wraps IOException, Order validates invariants*

```java
import java.io.*;
import java.nio.file.*;

// ---- Checked exception: I/O you CAN recover from ----
// Compiler FORCES callers to handle or declare — makes failure explicit in API
public class OrderConfigLoader {

    // Signature declares checked exception — caller knows this can fail
    public OrderConfig load(Path configPath) throws ConfigLoadException {
        try {
            String json = Files.readString(configPath);  // throws IOException (checked)
            return parseConfig(json);
        } catch (IOException e) {
            // Boundary: convert low-level checked → domain unchecked
            // Always preserve the original cause for debugging!
            throw new ConfigLoadException("Cannot load order config from: " + configPath, e);
        }
    }

    // Multi-catch: handle related exceptions the same way
    private OrderConfig parseConfig(String json) {
        try {
            return JsonUtil.parse(json, OrderConfig.class);
        } catch (JsonParseException | IllegalArgumentException e) {
            // Both treated as config format error — multi-catch avoids duplication
            throw new ConfigLoadException("Invalid config format: " + e.getMessage(), e);
        }
    }
}

// ---- Unchecked exception: programming errors / invariant violations ----
public class Order {
    private final String orderId;
    private OrderStatus status;

    public Order(String orderId) {
        // Precondition violation → caller's bug → IllegalArgumentException
        if (orderId == null || orderId.isBlank())
            throw new IllegalArgumentException("orderId must not be blank");
        this.orderId = orderId;
        this.status  = OrderStatus.PENDING;
    }

    public void cancel() {
        // State invariant → IllegalStateException
        if (status == OrderStatus.SHIPPED || status == OrderStatus.DELIVERED)
            throw new IllegalStateException(
                "Cannot cancel order #" + orderId + " in status " + status);
        this.status = OrderStatus.CANCELLED;
    }

    public void applyDiscount(double percent) {
        // Range validation → IllegalArgumentException (not an I/O error — always unchecked)
        if (percent < 0 || percent > 100)
            throw new IllegalArgumentException("Discount percent must be 0–100, got: " + percent);
    }
}

// ---- Caller at service boundary ----
@Service
public class OrderService {
    public void cancelOrder(String orderId) {
        Order order = repository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));  // unchecked
        try {
            order.cancel();  // unchecked — no try-catch needed in happy path
        } catch (IllegalStateException e) {
            // Optionally translate to domain exception with HTTP mapping
            throw new OrderCancellationException(orderId, order.getStatus(), e);
        }
    }
}
```

## Ứng Dụng Thực Tế

Spring Framework bọc checked JDBC exception thành unchecked <code>DataAccessException</code> subclass — giải phóng bạn khỏi boilerplate try-catch trong service code. Áp dụng pattern tương tự cho layer của bạn: bắt checked ở ranh giới, rethrow như domain unchecked.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao Java bao gồm checked exception? Lập luận ủng hộ và phản đối là gì?</strong></summary>

**A:** **Ủng hộ**: Compiler buộc caller phải xử lý hoặc declare — "fail loudly" khi bỏ sót error handling, phù hợp I/O operations có thể fail. **Phản đối**: Verbose, thường bị "swallow" bằng `catch(Exception e){}` vô nghĩa; spread qua nhiều layer (DAO → Service → Controller); không phù hợp với lambda (Functional interfaces không khai báo checked exception). Xu hướng hiện đại: wrap trong unchecked RuntimeException và xử lý ở global @ExceptionHandler.

</details>

<details>
<summary><strong>Khi nào bạn nên bọc checked exception trong unchecked?</strong></summary>

**A:** Bọc khi: (1) Exception là implementation detail không nên leak qua API (JPA wrap `SQLException` thành `DataAccessException`). (2) Caller không thể xử lý meaningful — re-throw vô nghĩa. (3) Dùng trong functional/lambda context — `CheckedFunction` workaround xấu. Pattern: `throw new ServiceException("Failed to read config", e)` — preserve original exception làm cause để không mất stack trace.

</details>

<details>
<summary><strong>Exception chaining là gì và tại sao quan trọng?</strong></summary>

**A:** Exception chaining: khi wrap exception, pass original làm cause: `new RuntimeException("message", originalException)`. Đảm bảo root cause không bị mất — `getCause()` và stack trace đầy đủ giúp debug. Không chain: chỉ thấy high-level exception, không biết nguyên nhân gốc rễ. Anti-pattern: `catch(SQLException e) { throw new ServiceException("error"); }` — mất nguyên nhân. Luôn: `throw new ServiceException("error", e)`.

</details>
