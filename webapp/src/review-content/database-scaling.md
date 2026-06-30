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

1. Read replica giúp gì với database scalability?
1. Replication lag là gì và ảnh hưởng đến ứng dụng thế nào?
1. Khi nào bạn chọn sharding thay vì read replica?
