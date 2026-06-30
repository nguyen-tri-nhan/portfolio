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

1. @DynamicPropertySource làm gì?
1. Khi nào dùng RANDOM_PORT vs MOCK?
1. @MockBean ảnh hưởng đến Spring context caching thế nào?
