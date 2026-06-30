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

1. Clustered index là gì và InnoDB implement thế nào?
1. type=ALL trong EXPLAIN có nghĩa gì?
1. Tune HikariCP pool size thế nào?
