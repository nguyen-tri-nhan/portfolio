---
key: "Exception Handling"
title: "Xử Lý Ngoại Lệ"
crumb: "1. Core Java"
---

Mô hình exception của Java phân biệt checked exception (phải khai báo/bắt) và unchecked (runtime), với try-catch-finally và try-with-resources để quản lý tài nguyên.

## Điểm Chính

- Hierarchy: <code>Throwable</code> → <code>Error</code> (JVM fatal) / <code>Exception</code> → <code>RuntimeException</code> (unchecked).
- Checked exception: phải bắt hoặc khai báo với <code>throws</code>. Unchecked (<code>RuntimeException</code>): tùy chọn.
- <code>finally</code> luôn chạy; <code>try-with-resources</code> (Java 7+) tự đóng tài nguyên <code>AutoCloseable</code>.
- Đừng bao giờ nuốt exception im lặng — log và rethrow hoặc chuyển đổi sang type cụ thể hơn.
- Custom exception: extend <code>RuntimeException</code> cho domain error (không bắt buộc người gọi xử lý).

## Ví Dụ Code

*try-with-resources: JDBC multi-resource với correct close order và streaming export*

```java
import java.sql.*;
import javax.sql.DataSource;
import java.nio.file.*;

// ---- try-with-resources: multiple resources, correct close order ----
// Resources are closed in REVERSE declaration order: rs → ps → conn
public class OrderRepository {

    private final DataSource dataSource;

    public Order findById(long orderId) {
        String sql = "SELECT id, customer_id, status, total FROM orders WHERE id = ?";

        try (Connection conn = dataSource.getConnection();         // closed 3rd
             PreparedStatement ps = conn.prepareStatement(sql)) {  // closed 2nd

            ps.setLong(1, orderId);

            try (ResultSet rs = ps.executeQuery()) {               // closed 1st
                if (rs.next()) {
                    return mapRow(rs);
                }
                throw new OrderNotFoundException(orderId);
            }
        } catch (SQLException e) {
            // Wrap checked exception → domain unchecked — callers don't handle SQL
            throw new DataAccessException("Failed to load order #" + orderId, e);
        }
        // conn, ps, rs are ALL guaranteed closed even if exception is thrown
    }

    // ---- Processing large result set — streaming approach ----
    public void exportOrdersToFile(Path outputPath) throws IOException {
        String sql = "SELECT id, total FROM orders WHERE status = 'COMPLETED'";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery();
             BufferedWriter writer = Files.newBufferedWriter(outputPath)) {

            ps.setFetchSize(500);  // stream in batches of 500 from DB
            while (rs.next()) {
                writer.write(rs.getLong("id") + "," + rs.getBigDecimal("total"));
                writer.newLine();
            }
        } catch (SQLException e) {
            throw new DataAccessException("Export failed", e);
        }
        // conn, ps, rs, writer all auto-closed — no resource leak
    }

    private Order mapRow(ResultSet rs) throws SQLException {
        return new Order(
            rs.getLong("id"),
            rs.getString("customer_id"),
            OrderStatus.valueOf(rs.getString("status")),
            rs.getBigDecimal("total")
        );
    }
}
```

## Ứng Dụng Thực Tế

Trong Spring, annotate exception handler với <code>@ControllerAdvice</code> + <code>@ExceptionHandler</code> để chuyển domain exception thành HTTP response. Không bao giờ lộ stack trace cho client — log phía server, trả về structured error DTO.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa checked và unchecked exception là gì?</strong></summary>

**A:** **Checked exception** (extends `Exception`, không phải `RuntimeException`): compiler buộc caller phải catch hoặc declare `throws` — ví dụ IOException, SQLException. Dùng cho recoverable situations. **Unchecked exception** (extends `RuntimeException`): không cần declare — ví dụ NullPointerException, IllegalArgumentException. Dùng cho programming errors hoặc unrecoverable situations. Modern Java: trend về unchecked bởi vì checked gây boilerplate và thường bị swallow.

</details>

<details>
<summary><strong>Điều gì xảy ra nếu exception được ném trong finally block?</strong></summary>

**A:** Exception trong `finally` **replace** exception từ `try`/`catch` — exception gốc bị mất hoàn toàn, không phải suppressed. Đây là bug nguy hiểm vì mất nguyên nhân gốc. Ví dụ: connection.close() trong finally ném exception → che giấu exception thực từ business logic. Fix: wrap finally body trong try-catch, hoặc dùng **try-with-resources** — resource close exception được suppressed (accessible qua `getSuppressed()`), primary exception được giữ.

</details>

<details>
<summary><strong>try-with-resources hoạt động như thế nào bên dưới?</strong></summary>

**A:** Compiler transform `try (Resource r = new Resource()) { body }` thành code: (1) Gọi `body`. (2) Khi exit (normal hoặc exception), gọi `r.close()`. (3) Nếu cả body và close() đều throw: body exception được giữ, close exception được **suppressed** (`addSuppressed()`). Resource phải implement `AutoCloseable`. Java 9: có thể dùng effectively-final variable đã khai báo ngoài: `try (existingVar)` — không cần khai báo lại.

</details>
