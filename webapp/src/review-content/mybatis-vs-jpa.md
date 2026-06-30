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

1. N+1 query trong JPA do đâu và fix thế nào?
1. Dùng cả MyBatis và Spring Data JPA trong cùng Spring Boot project được không?
1. Khi nào recommend MyBatis cho project mới?
