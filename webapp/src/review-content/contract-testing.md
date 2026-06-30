---
key: "Contract Testing"
title: "Contract Testing"
crumb: "9. Testing"
---

Contract testing kiểm tra thỏa thuận API consumer-provider một cách độc lập, phát hiện breaking change trước khi deploy mà không cần cả hai service chạy đồng thời.

## Điểm Chính

- Vấn đề: integration test giữa microservice chậm và brittle.
- <strong>Consumer-driven contract</strong>: consumer định nghĩa interaction kỳ vọng, provider verify.
- Pact: tạo contract JSON file từ consumer test; provider verify với real implementation.
- Pact Broker: lưu contract và kết quả verification; <code>can-i-deploy</code> kiểm tra compatibility.
- Nhanh hơn E2E test, bắt breaking change sớm hơn, scale tốt với nhiều service.

## Ví Dụ Code

*Pact consumer test: 2 interactions (get user + 404), type-safe DSL, publish to Broker*

```java
// ── Consumer side: order-service defines contract for user-service ───────────
@ExtendWith(PactConsumerTestExt.class)
@PactTestFor(providerName = "user-service")
@DisplayName("OrderClient Contract — user-service API")
class OrderClientContractTest {

    // Interaction 1: get existing user
    @Pact(consumer = "order-service", provider = "user-service")
    RequestResponsePact getUserByIdPact(PactDslWithProvider builder) {
        return builder
            .given("user with id 1 exists and is VIP")
            .uponReceiving("GET /api/users/1 — fetch user for order placement")
                .method("GET")
                .path("/api/users/1")
                .headers(Map.of("Authorization", "Bearer test-token"))
            .willRespondWith()
                .status(200)
                .headers(Map.of("Content-Type", "application/json"))
                .body(newJsonBody(body -> {
                    body.integerType("id", 1);
                    body.stringType("email", "alice@example.com");
                    body.stringType("name", "Alice");
                    body.stringMatcher("type", "VIP|REGULAR|MEMBER", "VIP");
                    body.booleanType("active", true);
                }).build())
            .toPact();
    }

    // Interaction 2: get non-existent user → 404
    @Pact(consumer = "order-service", provider = "user-service")
    RequestResponsePact getUserNotFoundPact(PactDslWithProvider builder) {
        return builder
            .given("user with id 999 does not exist")
            .uponReceiving("GET /api/users/999 — user not found")
                .method("GET").path("/api/users/999")
            .willRespondWith()
                .status(404)
                .body(newJsonBody(body -> {
                    body.stringType("error", "User not found");
                    body.stringType("code",  "USER_NOT_FOUND");
                }).build())
            .toPact();
    }

    // Test 1: consumer parses response correctly
    @Test
    @PactTestFor(pactMethod = "getUserByIdPact")
    @DisplayName("UserClient.getById() maps JSON response to User domain object")
    void getUserById_existingUser_mapsCorrectly(MockServer mockServer) {
        UserClient client = new UserClient(mockServer.getUrl(), "Bearer test-token");
        User user = client.getById(1L);

        assertAll(
            () -> assertThat(user.getId()).isEqualTo(1L),
            () -> assertThat(user.getEmail()).isEqualTo("alice@example.com"),
            () -> assertThat(user.getType()).isEqualTo(UserType.VIP)
        );
    }

    // Test 2: consumer handles 404 correctly
    @Test
    @PactTestFor(pactMethod = "getUserNotFoundPact")
    @DisplayName("UserClient.getById() throws UserNotFoundException on 404")
    void getUserById_notFound_throwsException(MockServer mockServer) {
        UserClient client = new UserClient(mockServer.getUrl(), "Bearer test-token");
        assertThrows(UserNotFoundException.class, () -> client.getById(999L));
    }
}
// Generated pact file published to Pact Broker on CI:
// mvn pact:publish -Dpact.broker.url=https://broker.example.com
```

## Ứng Dụng Thực Tế

Tích hợp Pact Broker trong CI: consumer publish contract khi build, provider verify khi build. Gate deployment với <code>can-i-deploy</code> — ngăn release provider version phá vỡ consumer contract.

## Câu Hỏi Phỏng Vấn

1. Contract testing giải quyết vấn đề gì so với integration test?
1. Vai trò của Pact Broker là gì?
1. can-i-deploy là gì?
