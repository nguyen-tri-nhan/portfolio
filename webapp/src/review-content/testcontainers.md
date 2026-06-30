---
key: "TestContainers"
title: "TestContainers"
crumb: "9. Testing › Integration Test"
---

TestContainers khởi động real Docker container (Postgres, Redis, Kafka) trong khi chạy JUnit test, cung cấp môi trường giống production mà không có H2 compatibility issue.

## Điểm Chính

- <code>@Container</code> + <code>@Testcontainers</code>: lifecycle được quản lý bởi JUnit extension.
- Container <code>static</code>: chia sẻ qua các method test class (nhanh hơn). Non-static: container mới mỗi test.
- Hỗ trợ: PostgreSQL, MySQL, Redis, Kafka, RabbitMQ, MongoDB, Elasticsearch, LocalStack.
- Reuse mode: <code>.withReuse(true)</code> giữ container sống giữa các test run — iteration local nhanh.
- Lần chạy đầu pull Docker image — lần tiếp theo dùng cached image.

## Ví Dụ Code

*Nhiều container với DynamicPropertySource*

```java
@SpringBootTest @Testcontainers
class InventoryTest {
    @Container
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");
    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    @DynamicPropertySource static void config(DynamicPropertyRegistry r){
        r.add("spring.datasource.url",        pg::getJdbcUrl);
        r.add("spring.data.redis.host",       redis::getHost);
        r.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }
    @Autowired InventoryRepository repo;
    @Test void decrementStock_concurrent_noOversell(){
        repo.save(new Inventory("p1", 10));
        IntStream.range(0,15).parallel()
            .forEach(i -> { try { repo.decrement("p1",1); } catch(Exception e){} });
        assertThat(repo.findByProductId("p1").getQuantity()).isGreaterThanOrEqualTo(0);
    }
}
```

## Ứng Dụng Thực Tế

Thay tất cả H2 integration test bằng TestContainers Postgres — bắt được SQL syntax difference, constraint behavior và concurrent locking mà H2 xử lý khác hoặc không hỗ trợ.

## Câu Hỏi Phỏng Vấn

1. TestContainers có lợi thế gì so với H2?
1. Làm thế nào để chia sẻ container qua nhiều test class?
1. TestContainers reuse mode là gì?
