---
key: "MySQL Deep Dive"
title: "MySQL — Kiến Thức Chuyên Sâu"
crumb: "4. Database"
---

Kiến thức MySQL chuyên sâu: InnoDB engine internals, đọc EXPLAIN plan, phân tích slow query, và cấu hình connection pool — tất cả đều quan trọng cho Java backend engineer làm việc với MySQL production.

## Điểm Chính

- InnoDB: storage engine mặc định. Row-level locking, ACID transaction, clustered index, MVCC.
- EXPLAIN: phân tích execution plan để phát hiện full table scan và index bị thiếu.
- Slow Query Log: tìm ra bottleneck hiệu năng thực từ traffic production.
- HikariCP: connection pool mặc định của Spring Boot — tune <code>maximumPoolSize</code> và timeout.

## Ứng Dụng Thực Tế

Kiến thức MySQL được expect nếu JD nhắc đến MySQL. Biết InnoDB internals (clustered index, MVCC) để giải thích locking behavior. Đọc được EXPLAIN plan là kỹ năng thực tế nhất để fix slow query.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Clustered index là gì và InnoDB implement thế nào?</strong></summary>

**A:** Clustered index: table data được **sắp xếp vật lý** theo index key — một table chỉ có một clustered index. **InnoDB**: tự động dùng **Primary Key** làm clustered index; table data pages chứa actual row data được tổ chức theo PK order. Nếu không có PK → dùng UNIQUE NOT NULL; nếu cũng không có → tạo hidden 6-byte row ID. Hệ quả: secondary index leaf node chứa PK value (không phải row pointer) → secondary index lookup phải đọc clustered index (two-lookup).

</details>

<details>
<summary><strong>type=ALL trong EXPLAIN có nghĩa gì?</strong></summary>

**A:** `type=ALL` là **full table scan** — đọc tất cả row trong table. Thường là dấu hiệu missing index. EXPLAIN type từ tốt đến xấu: `system > const > eq_ref > ref > range > index > ALL`. `type=ALL` acceptable khi: table nhỏ (<1000 rows), không có selective WHERE condition. Cần fix khi: table lớn, query chậm. Kiểm tra `Extra` column: "Using where" = filter sau full scan; "Using filesort" = sort không dùng index.

</details>

<details>
<summary><strong>Tune HikariCP pool size thế nào?</strong></summary>

**A:** Công thức HikariCP: `pool_size = Tn × (Cm - 1) + 1` (Tn = max threads, Cm = max concurrent query per thread) nhưng thực tế đơn giản hơn. Rule: `maximumPoolSize = (CPU cores × 2) + disk_spindle` (PostgreSQL recommendation). Thực chiến: bắt đầu nhỏ (10-20), monitor `hikaricp.pending.threads` — nếu luôn > 0 → tăng pool. Tăng pool không phải lúc nào cũng giúp: nếu DB là bottleneck, thêm connection chỉ thêm contention. Tối ưu query trước.

</details>
