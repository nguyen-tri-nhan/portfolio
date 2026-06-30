---
key: "try-with-resources"
title: "try-with-resources"
crumb: "1. Core Java › Exception Handling"
---

try-with-resources (Java 7+) tự động đóng bất kỳ tài nguyên <code>AutoCloseable</code> nào ở cuối try block, kể cả khi exception được ném, ngăn resource leak.

## Điểm Chính

- Bất kỳ class nào implement <code>AutoCloseable</code> (có <code>close()</code>) đều có thể dùng.
- <code>close()</code> được gọi theo thứ tự khai báo ngược — đúng cho tài nguyên phụ thuộc nhau.
- Nếu cả try body và <code>close()</code> đều ném exception, exception của close bị <em>suppress</em> (có thể truy cập qua <code>getSuppressed()</code>).
- Nhiều tài nguyên trong một try: <code>try (A a = ...; B b = ...) {}</code>.
- Java 9+: dùng effectively-final variable: <code>try (resource) {}</code> mà không cần khai báo lại.

## Ví Dụ Code

*try-with-resources: OperationTimer + TransactionScope AutoCloseable + suppressed exceptions*

```java
import java.sql.*;
import java.io.*;

// ---- Custom AutoCloseable 1: operation timer for performance tracking ----
public class OperationTimer implements AutoCloseable {
    private final String operationName;
    private final long startNanos = System.nanoTime();

    public OperationTimer(String operationName) {
        this.operationName = operationName;
    }

    @Override
    public void close() {
        long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000;
        // In production: record metric instead of println
        MetricsRegistry.recordLatency(operationName, elapsedMs);
        if (elapsedMs > 500) {
            log.warn("Slow operation '{}': {}ms", operationName, elapsedMs);
        }
    }
}

// ---- Custom AutoCloseable 2: database transaction scope ----
public class TransactionScope implements AutoCloseable {
    private final Connection conn;
    private boolean committed = false;

    public TransactionScope(DataSource ds) throws SQLException {
        this.conn = ds.getConnection();
        this.conn.setAutoCommit(false);
    }

    public Connection getConnection() { return conn; }

    public void commit() throws SQLException {
        conn.commit();
        committed = true;
    }

    @Override
    public void close() throws SQLException {
        try {
            if (!committed) {
                conn.rollback();  // auto-rollback if commit() was never called
            }
        } finally {
            conn.close();         // always release connection to pool
        }
    }
}

// ---- Using both together — suppressed exception demo ----
public class OrderPersistenceService {

    public void saveOrder(Order order, DataSource ds) throws Exception {
        // OperationTimer closed AFTER TransactionScope (reverse declaration order)
        try (OperationTimer timer  = new OperationTimer("saveOrder");
             TransactionScope tx   = new TransactionScope(ds)) {

            insertOrder(tx.getConnection(), order);
            insertOrderItems(tx.getConnection(), order.getItems());
            tx.commit();

        }
        // If insertOrderItems() throws AND tx.close() also throws:
        // the tx.close() exception is SUPPRESSED (attached to the first exception)
        // Retrieve with: e.getSuppressed()
    }

    // ---- Java 9: effectively-final variable in try-with-resources ----
    public String readOrderTemplate(File templateFile) throws IOException {
        BufferedReader reader = new BufferedReader(new FileReader(templateFile));
        // No need to redeclare; works as long as 'reader' is effectively final
        try (reader) {
            return reader.lines().collect(java.util.stream.Collectors.joining("
"));
        }
    }
}
```

## Ứng Dụng Thực Tế

Dùng try-with-resources cho toàn bộ I/O: file, JDBC connection, HTTP client, stream. <code>JdbcTemplate</code> của Spring tự quản lý tài nguyên, nhưng khi viết raw JDBC luôn dùng try-with-resources.

## Câu Hỏi Phỏng Vấn

1. Class phải implement interface nào để dùng với try-with-resources?
1. Điều gì xảy ra khi cả try body và close() đều ném exception?
1. Bạn có thể dùng try-with-resources với effectively-final variable của Java 9 không?
