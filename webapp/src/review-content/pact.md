---
key: "Pact"
title: "Pact"
crumb: "9. Testing › Contract Testing"
---

Pact là framework consumer-driven contract testing hàng đầu — consumer viết interaction test, Pact tạo JSON contract và provider verify tự động.

## Điểm Chính

- Consumer test → contract <code>pact.json</code> → publish lên Pact Broker.
- Provider CI: download contract, chạy setup <code>@State</code>, verify interaction với real service.
- <code>@State("user 1 exists")</code>: thiết lập precondition trong provider trước mỗi interaction.
- <code>can-i-deploy</code>: kiểm tra consumer+provider version có compatible trước khi deploy.
- Cũng hỗ trợ messaging contract (Kafka, RabbitMQ).

## Ví Dụ Code

*Provider verification: @State setup, Pact Broker integration, can-i-deploy gate*

```java
// ── Provider side: user-service verifies ALL consumer contracts ─────────────
@Provider("user-service")
@PactBroker(
    url = "https://pact-broker.example.com",
    authentication = @PactBrokerAuth(token = "${PACT_BROKER_TOKEN}"),
    // Only verify contracts for consumers that want to deploy to "production"
    consumerVersionSelectors = @VersionSelector(deployedOrReleased = true)
)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
class UserServicePactVerificationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void configureDb(DynamicPropertyRegistry reg) {
        reg.add("spring.datasource.url",      postgres::getJdbcUrl);
        reg.add("spring.datasource.username", postgres::getUsername);
        reg.add("spring.datasource.password", postgres::getPassword);
    }

    @LocalServerPort int port;
    @Autowired UserRepository userRepository;

    // Required: delegate each interaction to Pact framework
    @TestTemplate
    @ExtendWith(PactVerificationInvocationContextProvider.class)
    void verifyPact(PactVerificationContext context) {
        context.verifyInteraction();
    }

    @BeforeEach
    void configureTarget(PactVerificationContext context) {
        // Point Pact at our running Spring Boot instance
        context.setTarget(new HttpTestTarget("localhost", port));
    }

    // ── Provider States: setup data for each interaction ─────────────────────
    @State("user with id 1 exists and is VIP")
    void setupVipUser() {
        userRepository.deleteAll();
        userRepository.save(User.builder()
            .id(1L)
            .name("Alice")
            .email("alice@example.com")
            .type(UserType.VIP)
            .active(true)
            .build());
    }

    @State("user with id 999 does not exist")
    void setupUserNotFound() {
        userRepository.deleteById(999L);    // ensure absent
    }

    // ── CI command to gate deployment ─────────────────────────────────────────
    // pact-broker can-i-deploy     //   --pacticipant user-service     //   --version ${GIT_SHA}     //   --to-environment production     //   --broker-base-url https://pact-broker.example.com
    // Exit code 1 → pipeline fails → deployment blocked
}
```

## Ứng Dụng Thực Tế

Chạy <code>pact can-i-deploy --pacticipant user-service --version 1.2.3 --to-environment prod</code> trong CD pipeline trước khi deploy. Fail deployment nếu bất kỳ consumer contract nào bị phá vỡ.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Provider state trong Pact là gì?</strong></summary>

**A:** **Provider state**: precondition mà provider phải satisfy trước khi chạy verification — đảm bảo DB/service trong đúng trạng thái. Ví dụ trong pact: `"given": "user 123 exists"` → provider state handler tạo user 123 trong test DB trước khi verify. Provider side code:
```java
@State("user 123 exists")
public void setupUser123() {
    userRepository.save(new User(123L, "Alice"));
}
```
Không có provider state → verification fail vì data chưa tồn tại.

</details>

<details>
<summary><strong>can-i-deploy hoạt động thế nào?</strong></summary>

**A:** CLI tool: `pact-broker can-i-deploy --pacticipant OrderService --version 2.1.0 --to production` → query Pact Broker API, kiểm tra tất cả pact contract mà OrderService tham gia (consumer hoặc provider) đã được **verify thành công** với version tương ứng của counterpart. Nếu tất cả verified → exit 0 (deploy được). Nếu có contract chưa verified → exit 1 (không deploy). Tích hợp vào CD pipeline: block deploy nếu can-i-deploy fail.

</details>

<details>
<summary><strong>Điều gì xảy ra khi provider thay đổi tên field API?</strong></summary>

**A:** Consumer pact contract có `"name": "Alice"` → provider đổi thành `"fullName": "Alice"`. Khi provider chạy verification → pact verification **fail**: expected field "name" không có trong response. Pact Broker ghi nhận failed verification. `can-i-deploy` của provider version mới → fail → provider không thể deploy. Flow đúng: (1) Thông báo consumer trước. (2) Consumer update pact (support cả "name" và "fullName" hoặc update expectation). (3) Publish pact mới. (4) Provider verify pact mới. (5) Deploy.

</details>
