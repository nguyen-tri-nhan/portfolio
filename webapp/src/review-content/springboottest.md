---
key: "@SpringBootTest"
title: "@SpringBootTest"
crumb: "9. Testing › Integration Test"
---

@SpringBootTest load full application context, cho phép end-to-end integration test với real wiring, trong khi @DynamicPropertySource và @MockBean cho phép override có kiểm soát.

## Điểm Chính

- <code>webEnvironment=MOCK</code>: mock servlet (default). Dùng với <code>MockMvc</code>.
- <code>webEnvironment=RANDOM_PORT</code>: server thật. Dùng với <code>TestRestTemplate</code> hoặc <code>WebTestClient</code>.
- Context caching: tái sử dụng qua các test cùng config — tránh phá cache với @MockBean mỗi test.
- <code>@DynamicPropertySource</code>: đăng ký TestContainers URL vào Spring property.
- <code>@MockBean</code>: thay thế bean trong context bằng Mockito mock.

## Ví Dụ Code

*@SpringBootTest với TestContainers + @MockBean*

```java
@SpringBootTest(webEnvironment=RANDOM_PORT)
@Testcontainers
class OrderApiTest {
    @Container static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void config(DynamicPropertyRegistry r){
        r.add("spring.datasource.url", pg::getJdbcUrl);
        r.add("spring.datasource.username", pg::getUsername);
        r.add("spring.datasource.password", pg::getPassword);
    }
    @Autowired TestRestTemplate rest;
    @MockBean EmailService emailService;

    @Test void createOrder_returns201(){
        ResponseEntity<OrderResponse> res = rest.postForEntity(
            "/api/orders", validRequest(), OrderResponse.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(emailService).sendConfirmation(any(), any());
    }
}
```

## Ứng Dụng Thực Tế

Dùng @DynamicPropertySource để wire TestContainers vào Spring — đây là pattern chuẩn. Giữ @MockBean tối thiểu — mỗi combination @MockBean unique tạo context riêng, làm chậm test suite.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>@SpringBootTest và @WebMvcTest khác nhau thế nào?</strong></summary>

**A:** **`@SpringBootTest`**: load **full application context** — tất cả beans, auto-configuration. Test gần giống production nhất. Chậm (load nhiều). Dùng khi: integration test cần nhiều layer. **`@WebMvcTest(MyController.class)`**: chỉ load **web layer** — Controller, Filter, ControllerAdvice. Không load Service, Repository. Service phải `@MockBean`. Nhanh. Dùng khi: test controller logic, request/response mapping, validation. **`@DataJpaTest`**: chỉ JPA layer — in-memory H2, Repository beans. **`@JsonTest`**: chỉ JSON serialization. Nguyên tắc: dùng slice annotation nhỏ nhất phù hợp với test mục đích.

</details>

<details>
<summary><strong>MockMvc dùng để test gì và cách dùng?</strong></summary>

**A:** MockMvc: test Spring MVC controllers mà không cần start HTTP server — simulate request/response trong JVM. Setup: `@WebMvcTest` auto-configure. Ví dụ:
```java
@Test
void getUser_shouldReturn200() throws Exception {
    given(userService.findById(1L)).willReturn(new User(1L, "Alice"));
    
    mockMvc.perform(get("/users/1")
        .header("Authorization", "Bearer token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Alice"));
}
```
Verify: status, headers, response body, redirects. Không test thực tế network — dùng `@SpringBootTest + TestRestTemplate` hoặc WebTestClient cho full integration test.

</details>

<details>
<summary><strong>@MockBean và @Mock khác nhau thế nào?</strong></summary>

**A:** **`@Mock`** (Mockito): tạo mock thuần Mockito — không tích hợp Spring context. Dùng với `@ExtendWith(MockitoExtension.class)`. **`@MockBean`** (Spring Test): tạo Mockito mock **và register nó vào Spring Application Context** — thay thế bean thực trong context. Dùng khi: test có `@SpringBootTest` hoặc `@WebMvcTest` cần mock một số bean. Ví dụ: `@WebMvcTest` + `@MockBean UserService service` → controller autowire mock service. `@MockBean` cause context reload (slow) — dùng `@Mock` khi không cần Spring context (unit test với constructor injection).

</details>
