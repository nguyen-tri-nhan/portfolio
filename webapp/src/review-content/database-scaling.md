---
key: "Database Scaling"
title: "Database Scaling"
crumb: "7. System Design"
---

Chiến lược database scaling bao gồm read replica (horizontal read scale), sharding (horizontal write scale) và CQRS (tách biệt read/write model) để xử lý tải cao.

## Điểm Chính

- <strong>Read Replica</strong>: replicate DB sang bản read-only. Route read đến replica, write đến primary.
- <strong>Sharding</strong>: partition dữ liệu qua nhiều DB (theo range, hash hoặc directory). Cho phép horizontal write scale.
- <strong>CQRS</strong>: Command Query Responsibility Segregation — tách biệt read/write data model và store.
- Connection pooling: PgBouncer giảm connection overhead. Mỗi app instance pool 10 connection.
- Vertical scale: instance RDS lớn hơn thường là fix nhanh nhất. Xem xét trước sharding (phức tạp).

## Ví Dụ Code

*Read replica routing với AbstractRoutingDataSource; readOnly annotation; dual datasource config*

```java
// Read replica routing: @Transactional(readOnly=true) → replica, else → primary
@Configuration
public class DataSourceConfig {

    @Bean @Primary
    @ConfigurationProperties("spring.datasource.primary")
    public DataSource primaryDataSource() { return DataSourceBuilder.create().build(); }

    @Bean
    @ConfigurationProperties("spring.datasource.replica")
    public DataSource replicaDataSource() { return DataSourceBuilder.create().build(); }

    @Bean
    public DataSource routingDataSource(
            @Qualifier("primaryDataSource") DataSource primary,
            @Qualifier("replicaDataSource") DataSource replica) {
        AbstractRoutingDataSource routing = new AbstractRoutingDataSource() {
            @Override
            protected Object determineCurrentLookupKey() {
                // readOnly tx → replica; write tx → primary
                return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
                    ? "replica" : "primary";
            }
        };
        routing.setTargetDataSources(Map.of("primary", primary, "replica", replica));
        routing.setDefaultTargetDataSource(primary);
        routing.afterPropertiesSet();
        return routing;
    }
}

// Service layer: annotate all read-only methods (routes to replica automatically)
@Service
public class OrderQueryService {

    @Transactional(readOnly = true)   // → replica DataSource
    public List<Order> findOrdersByUser(String userId) {
        return orderRepo.findByUserId(userId); // read from replica
    }

    @Transactional                    // → primary DataSource (default)
    public Order placeOrder(PlaceOrderCommand cmd) {
        Order order = orderRepo.save(new Order(cmd)); // write to primary
        eventPublisher.publish(new OrderCreatedEvent(order));
        return order;
    }
}

// application.yml: dual datasource config
// spring.datasource.primary.url: jdbc:postgresql://db-primary:5432/orders
// spring.datasource.primary.hikari.maximum-pool-size: 20
// spring.datasource.replica.url: jdbc:postgresql://db-replica:5432/orders
// spring.datasource.replica.hikari.maximum-pool-size: 50  # more connections for reads

// Scaling path: cache → read replica → connection pool (PgBouncer) → sharding
// Sharding is last resort: massive operational complexity, no cross-shard JOINs
```

## Ứng Dụng Thực Tế

Dùng <code>@Transactional(readOnly=true)</code> trên tất cả service method read-only — Spring tự động route những này đến replica. Đây là thay đổi có tác động lớn nhất cho Spring Boot app nặng về đọc. Thêm replica trước khi sharding — sharding thêm độ phức tạp vận hành rất lớn.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Read replica giúp gì với database scalability?</strong></summary>

**A:** Read replica là bản sao read-only của primary DB, nhận replication stream. **Offload read traffic** khỏi primary: SELECT, report query, analytics chạy trên replica; primary chỉ xử lý write. Hầu hết ứng dụng là read-heavy (80-90% read) → replica giảm đáng kể load trên primary. Spring với `@Transactional(readOnly=true)` có thể route đến replica tự động khi config `AbstractRoutingDataSource`.

</details>

<details>
<summary><strong>Replication lag là gì và ảnh hưởng đến ứng dụng thế nào?</strong></summary>

**A:** **Replication lag**: độ trễ giữa write trên primary và khi write đó apply trên replica — có thể từ milliseconds đến seconds khi primary bận. Ảnh hưởng: user vừa create record → đọc từ replica → không thấy record vừa tạo. Giải pháp: (1) Sau write, đọc từ primary trong cùng transaction/request. (2) "Read-your-writes": dùng session token track version, chờ replica catch up. (3) Tăng replication hardware. Monitor: `SHOW SLAVE STATUS` / `pg_stat_replication`.

</details>

<details>
<summary><strong>Khi nào bạn chọn sharding thay vì read replica?</strong></summary>

**A:** Read replica giúp **scale reads**, không scale writes — primary vẫn là single write node. Chọn **sharding** khi: write throughput vượt khả năng một primary, dataset quá lớn cho một node, hoặc cần geographic distribution writes. Sharding phức tạp hơn nhiều: cross-shard joins không thể, transactions phức tạp, resharding costly. Thứ tự scale: vertical → read replica → sharding. Sharding là last resort vì complexity cao.

</details>
