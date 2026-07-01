---
key: "Integration Test"
title: "Integration Testing"
crumb: "9. Testing"
---

Integration test kiểm tra nhiều component hoạt động cùng nhau — test real database query, Spring wiring, HTTP layer và transaction behavior mà unit test không thể bắt được.

## Điểm Chính

- Chậm hơn unit test nhưng bắt được wiring bug, SQL issue, mapping error, transaction problem.
- <code>@SpringBootTest</code>: load full hoặc partial application context.
- <code>@DataJpaTest</code>: JPA slice — chỉ load JPA context + embedded DB (test repository nhanh).
- <code>@WebMvcTest</code>: web layer slice — load controller + MockMvc (test controller nhanh).
- TestContainers: real Docker DB/Redis/Kafka cho test — bắt được DB-specific issue mà H2 bỏ qua.

## Ví Dụ Code

*@SpringBootTest + MockMvc: full CRUD flow với JWT, TestContainers, @MockBean EmailService*

```java
// ── @SpringBootTest: full context + MockMvc CRUD flow ───────────────────────
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
@ActiveProfiles("test")
class OrderApiIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("orders_test");

    @DynamicPropertySource
    static void configureDb(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",      postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired OrderRepository orderRepository;
    @MockBean  EmailService emailService;   // avoid real email in tests

    private String jwtToken;

    @BeforeEach
    void setUp() {
        orderRepository.deleteAll();       // clean slate per test
        jwtToken = "Bearer " + generateTestJwt("user-1", "ROLE_USER");
    }

    @Test
    @DisplayName("POST /api/orders → 201 with location header")
    void createOrder_validRequest_returns201() throws Exception {
        OrderRequest req = new OrderRequest("user-1",
            List.of(new OrderItem("product-a", 2, new BigDecimal("49.99"))));

        mockMvc.perform(post("/api/orders")
                .header("Authorization", jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andExpect(header().exists("Location"))
            .andExpect(jsonPath("$.status").value("CONFIRMED"))
            .andExpect(jsonPath("$.total").value(99.98))
            .andExpect(jsonPath("$.orderId").isNotEmpty());

        verify(emailService).sendConfirmation(eq("user-1"), any());
    }

    @Test
    @DisplayName("GET /api/orders/{id} → 200 with correct order data")
    void getOrder_existingId_returns200() throws Exception {
        Order saved = orderRepository.save(
            new Order("user-1", List.of(new OrderItem("p1", 1, new BigDecimal("29.99")))));

        mockMvc.perform(get("/api/orders/" + saved.getId())
                .header("Authorization", jwtToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value("user-1"))
            .andExpect(jsonPath("$.items[0].productId").value("p1"));
    }

    @Test
    @DisplayName("DELETE /api/orders/{id} → 204, order cancelled in DB")
    void cancelOrder_confirmedOrder_returns204() throws Exception {
        Order saved = orderRepository.save(confirmedOrder("user-1"));

        mockMvc.perform(delete("/api/orders/" + saved.getId())
                .header("Authorization", jwtToken))
            .andExpect(status().isNoContent());

        Order updated = orderRepository.findById(saved.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(OrderStatus.CANCELLED);
    }

    @Test
    @DisplayName("POST /api/orders without JWT → 401 Unauthorized")
    void createOrder_missingJwt_returns401() throws Exception {
        mockMvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validRequest())))
            .andExpect(status().isUnauthorized());
    }
}
```

## Ứng Dụng Thực Tế

Dùng slice test để tăng tốc: @DataJpaTest cho repo, @WebMvcTest cho controller, chỉ @SpringBootTest đầy đủ cho end-to-end path. Spring cache context — đừng phá nó bằng @MockBean quá nhiều.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa @SpringBootTest và @DataJpaTest?</strong></summary>

**A:** **`@SpringBootTest`**: load **full ApplicationContext** — tất cả beans, auto-configuration, web layer. Chậm hơn nhưng test real integration. Dùng cho end-to-end test. **`@DataJpaTest`**: load **chỉ JPA slice** — entity, repository, JPA config, in-memory DB (H2 default) — không load service, controller, security. Nhanh hơn nhiều. Tương tự: `@WebMvcTest` (MVC slice), `@DataMongoTest`, `@DataRedisTest`. Principle: dùng slice test khi chỉ cần test một layer.

</details>

<details>
<summary><strong>Tại sao ưu tiên TestContainers hơn H2 cho JPA test?</strong></summary>

**A:** H2 là in-memory DB khác với PostgreSQL/MySQL về: (1) **SQL dialect**: H2 không support tất cả syntax (window function, JSON, specific type). (2) **Behavior**: H2 có thể pass test nhưng fail production (constraint handling, sequence behavior). (3) **Migration**: Flyway/Liquibase script cho production DB có thể syntax error trong H2. TestContainers chạy **actual Docker container** của production DB — test chính xác hơn, tránh "works in test, fails in prod".

</details>

<details>
<summary><strong>Slice test cải thiện CI speed thế nào?</strong></summary>

**A:** `@SpringBootTest` load full context mất 10-30s mỗi test class. Slice test load partial context mất 1-3s. Với 100 test class: full = 1000s-3000s; slice = 100s-300s. Ngoài ra, Spring **cache ApplicationContext** — test class dùng cùng config tái sử dụng context. `@MockBean` phá cache (tạo context mới). Tip: nhóm test dùng cùng mock setup vào cùng class, minimize `@MockBean` để maximize context reuse, dùng `@DirtiesContext` chỉ khi thực sự cần.

</details>
