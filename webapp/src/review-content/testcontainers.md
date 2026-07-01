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

<details>
<summary><strong>TestContainers giải quyết vấn đề gì trong integration testing?</strong></summary>

**A:** Integration test cần real dependency (DB, Redis, Kafka) — mock không đủ faithful. Options: (1) Shared dev database — data contamination, parallel test conflict. (2) H2 in-memory — không match production DB behavior (SQL dialect, features). (3) **TestContainers**: start **real Docker container** per test suite — isolated, real DB, tear down after test. Spring Boot 3.1+: `@ServiceConnection` annotation tự động configure connection đến container. Ví dụ:
```java
@Container
static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");
```
Test chạy chậm hơn H2 nhưng catch real issues.

</details>

<details>
<summary><strong>Cách dùng TestContainers với Spring Boot 3.1+ thế nào?</strong></summary>

**A:** Spring Boot 3.1 tích hợp TestContainers với `@ServiceConnection`:
```java
@SpringBootTest
@Testcontainers
class UserRepositoryTest {
    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");
    
    @Autowired UserRepository repo;
    
    @Test
    void testSave() {
        repo.save(new User("Alice"));
        assertThat(repo.count()).isEqualTo(1);
    }
}
```
`@ServiceConnection` tự detect container type → auto-configure Spring DataSource. Không cần manually set URL/credentials. Dùng `static` container → shared across test methods trong class (faster).

</details>

<details>
<summary><strong>TestContainers vs H2 in-memory: khi nào dùng cái nào?</strong></summary>

**A:** **H2 in-memory**: nhanh (không start Docker), đủ cho unit test logic, không cần Docker. Nhưng: behavior khác PostgreSQL/MySQL (type system, locking, specific functions). **TestContainers**: slower startup (pull image, start container), nhưng **real database** — test catch production issues. Chọn: H2 cho service unit test (mock repository); TestContainers cho repository/integration test cần production-like behavior. Rule: nếu test query phức tạp (window functions, JSON operations, specific index behavior) → TestContainers. Nếu đơn giản CRUD → H2 acceptable. Hybrid: H2 cho local rapid dev, TestContainers trong CI.

</details>
