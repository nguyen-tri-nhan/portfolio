---
key: "MyBatis"
title: "Tổng Quan MyBatis"
crumb: "4. Database"
---

MyBatis là persistence framework ánh xạ Java interface method sang SQL statement qua XML hoặc annotation. Khác với JPA/Hibernate, MyBatis giữ SQL tường minh — toàn quyền kiểm soát query trong khi tự động xử lý parameter binding và result mapping.

## Điểm Chính

- <strong>SQL-first</strong>: bạn viết SQL; MyBatis lo parameter binding (PreparedStatement) và result mapping.
- <strong>Mapper interface</strong>: Java interface với <code>@Mapper</code>; Spring Boot tự inject implementation.
- XML mapper file: SQL nằm trong XML; namespace = tên đầy đủ của interface.
- <code>#{param}</code>: PreparedStatement binding (an toàn với SQL injection). <code>${param}</code>: string substitution (nguy hiểm — tránh dùng với user input).
- <strong>vs JPA</strong>: MyBatis = SQL tường minh (dễ debug, dự đoán được); JPA = SQL tự generate (ít boilerplate, nhiều "magic").
- <strong>Chọn MyBatis khi</strong>: query phức tạp, SQL do DBA quản lý, stored procedure, đường dẫn performance-critical.

## Ứng Dụng Thực Tế

Nhiều công ty tech gốc Trung Quốc (Alibaba, Baidu ecosystem) ưa MyBatis vì SQL tường minh và có thể kiểm soát. Nếu JD nhắc MyBatis, expect phỏng vấn viết dynamic SQL. Rule tuyệt đối: luôn dùng <code>#{}</code> cho user input — <code>${}</code> là string interpolation, mở cửa cho SQL injection.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>#{} và ${} trong MyBatis khác nhau thế nào?</strong></summary>

**A:** `#{param}` → PreparedStatement parameter (`?`) — JDBC escape, an toàn SQL injection. `${param}` → string substitution trực tiếp vào SQL — nguy hiểm SQL injection với user input. Dùng `${}` chỉ cho column name/table name (dynamic SQL với whitelist validate): `ORDER BY ${column}`. Ví dụ: `WHERE id = #{userId}` (safe) vs `WHERE ${field} = #{value}` (unsafe nếu field là user input).

</details>

<details>
<summary><strong>MyBatis ngăn SQL injection thế nào so với nối chuỗi?</strong></summary>

**A:** String concatenation: `"SELECT * FROM users WHERE id = " + userId` — attacker inject `1 OR 1=1` → trả về tất cả user. MyBatis với `#{userId}`: generate `SELECT * FROM users WHERE id = ?` và bind parameter qua JDBC PreparedStatement — DB xử lý giá trị là data, không phải SQL syntax. PreparedStatement cũng có performance benefit: DB cache execution plan cho parameterized query.

</details>

<details>
<summary><strong>Khi nào chọn MyBatis thay vì JPA/Hibernate?</strong></summary>

**A:** Chọn **MyBatis** khi: (1) Cần kiểm soát SQL hoàn toàn — complex query, stored procedure, DB-specific optimization. (2) Legacy DB với schema không phù hợp ORM convention. (3) DBA viết SQL, Java dev mapping kết quả. (4) Report/analytics query phức tạp. Chọn **JPA/Hibernate** khi: domain model phức tạp với nhiều quan hệ, muốn tự động dirty checking, cần database-agnostic code, team quen với ORM pattern. Kết hợp cả hai trong cùng project là valid.

</details>
