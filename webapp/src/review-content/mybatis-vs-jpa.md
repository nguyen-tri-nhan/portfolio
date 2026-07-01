---
key: "MyBatis vs JPA"
title: "MyBatis vs JPA/Hibernate"
crumb: "4. Database › MyBatis"
---

MyBatis và JPA đại diện cho hai triết lý ORM đối lập: MyBatis SQL-first (tường minh, kiểm soát được); JPA object-first (tiện lợi CRUD, SQL tự generate). Chọn dựa trên độ phức tạp query và kỹ năng team.

## Điểm Chính

- <strong>MyBatis</strong>: bạn viết SQL. Toàn quyền kiểm soát, execution plan dự đoán được, tốt cho query phức tạp và reporting.
- <strong>JPA/Hibernate</strong>: SQL tự generate từ entity model. CRUD nhanh, quản lý entity lifecycle, khó tối ưu query phức tạp.
- Thế mạnh MyBatis: JOIN phức tạp, stored procedure, batch operation, phối hợp với DBA, đường dẫn performance-critical.
- Thế mạnh JPA: CRUD entity đơn giản, audit field (@CreatedDate), phân trang, portability giữa các DB.
- <strong>N+1 risk</strong>: JPA lazy loading gây N+1 nếu quên @EntityGraph hoặc JOIN FETCH. MyBatis tường minh tất cả loading — không query ẩn.
- <strong>Hybrid</strong>: Spring Data JPA cho repo đơn giản + MyBatis mapper cho reporting phức tạp — hoạt động trong cùng project.

## Ví Dụ Code

*So sánh N+1 và approach hybrid*

```java
// JPA: CRUD tiện nhưng có N+1 risk
@Entity public class Order {
    @OneToMany(fetch = FetchType.LAZY) // N+1 nếu access ngoài transaction!
    List<OrderItem> items;
}
// Fix: join fetch trong JPQL
@Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.id = :id")
Order findWithItems(@Param("id") Long id);

// MyBatis: JOIN tường minh, không N+1 bất ngờ
// (xem ví dụ ResultMap ở trên — query một lần trả về Order + items)

// Hybrid trong cùng Spring Boot project:
@Repository
public interface OrderRepo extends JpaRepository<Order, Long> {}  // CRUD đơn giản

@Mapper
public interface OrderReportMapper {
    List<MonthlySalesRow> monthlySalesByProduct(@Param("year") int year); // report phức tạp
}

// Config MyBatis (application.yml):
// mybatis:
//   configuration:
//     map-underscore-to-camel-case: true
//   mapper-locations: classpath:mapper/**/*.xml
```

## Ứng Dụng Thực Tế

Khi hỏi "MyBatis vs JPA": nêu cả hai trade-off, rồi đưa ra recommendation có lý do. JPA cho service user CRUD đơn giản. MyBatis cho module báo cáo tài chính với JOIN 20 bảng. Approach hybrid (JPA + MyBatis trong cùng project) phổ biến trong enterprise — Spring Boot hỗ trợ cả hai cùng lúc.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>N+1 query trong JPA do đâu và fix thế nào?</strong></summary>

**A:** N+1: load 1 parent entity list (1 query), rồi access LAZY collection của từng entity → N queries. Ví dụ: 100 Order → access `order.getItems()` mỗi cái → 100 thêm query = 101 total. Fix: (1) **JOIN FETCH**: `SELECT o FROM Order o JOIN FETCH o.items`. (2) **@EntityGraph**: `@EntityGraph(attributePaths="items")` trên repository method. (3) **Batch fetching**: `@BatchSize(size=20)` — load items của 20 order một lần. (4) **DTO projection** với constructor query.

</details>

<details>
<summary><strong>Dùng cả MyBatis và Spring Data JPA trong cùng Spring Boot project được không?</strong></summary>

**A:** **Có** — hoàn toàn valid. Config hai DataSource hoặc một DataSource với hai transaction manager (chú ý transaction boundary). MyBatis Mapper bean và JPA Repository bean tồn tại song song. Use case: JPA cho domain entity CRUD; MyBatis cho complex report query hoặc batch operation. Dependency: `mybatis-spring-boot-starter` và `spring-boot-starter-data-jpa` cùng trong pom.xml. Chỉ cần đảm bảo `@Primary` transaction manager đúng.

</details>

<details>
<summary><strong>Khi nào recommend MyBatis cho project mới?</strong></summary>

**A:** Recommend MyBatis cho project mới khi: (1) **SQL-first team**: DBA/BA viết SQL, dev binding kết quả; SQL là source of truth. (2) **Financial system**: audit requirement — muốn thấy chính xác SQL nào chạy. (3) **Complex reporting**: window function, CTE, DB-specific feature không support tốt trong JPQL. (4) **Performance-critical**: cần fine-tune từng query, không muốn JPA query generation overhead. Không recommend khi: team nhỏ, schema sạch, muốn rapid CRUD development.

</details>
