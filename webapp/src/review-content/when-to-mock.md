---
key: "When to Mock"
title: "Khi Nào Nên Mock"
crumb: "9. Testing › Mocking"
---

Mock external infrastructure (DB, HTTP, messaging); ĐỪNG mock value object, domain logic hoặc class đang test — over-mocking tạo ra test brittle pass ngay cả khi code bị hỏng.

## Điểm Chính

- <strong>NÊN mock</strong>: repository, HTTP client, message producer, email service, clock.
- <strong>KHÔNG nên mock</strong>: value object, domain entity, data class đơn giản, List/Map/String.
- <strong>KHÔNG nên mock</strong> class đang test — làm mất ý nghĩa test.
- Mock đau đớn = tín hiệu design: quá nhiều dependency hoặc sai abstraction level.

## Ví Dụ Code

*Mock PaymentGateway/Repo (infrastructure) — test OrderCalculator trực tiếp (domain)*

```java
// ── GOOD: mock external infrastructure, test real business logic ────────────
@ExtendWith(MockitoExtension.class)
class OrderDiscountTest {
    @Mock UserRepository   userRepo;      // MOCK: external I/O
    @Mock PaymentGateway   paymentGw;     // MOCK: third-party HTTP
    @Mock EmailService     emailService;  // MOCK: side-effect service
    @InjectMocks OrderService service;

    @Test
    @DisplayName("VIP user gets 20% discount — real logic executed")
    void applyDiscount_vipUser_gets20Percent() {
        // Only mock the repo (I/O boundary); OrderService logic runs for real
        when(userRepo.findById(1L)).thenReturn(Optional.of(vipUser()));
        BigDecimal result = service.applyDiscount(1L, new BigDecimal("100.00"));
        assertThat(result).isEqualByComparingTo("80.00");
    }

    @Test
    @DisplayName("payment fails → order NOT saved, failure email sent")
    void placeOrder_paymentDeclined_noOrderSaved() {
        when(userRepo.findById(any())).thenReturn(Optional.of(regularUser()));
        when(paymentGw.charge(any())).thenThrow(new PaymentDeclinedException("insufficient funds"));
        assertThrows(PaymentException.class,
            () -> service.placeOrder(orderRequest()));
        // Real business rule: don't persist order if payment fails
        verify(emailService).sendPaymentFailure(eq("u1"), contains("insufficient funds"));
    }
}

// ── BAD: mocking the class under test — tests nothing real ──────────────────
// OrderService mockService = mock(OrderService.class);
// when(mockService.applyDiscount(any(), any())).thenReturn(new BigDecimal("80.00"));
// This is NOT a test — it just replays what you told the mock to return.

// ── GOOD: test pure domain object WITHOUT any mocks ─────────────────────────
class OrderCalculatorTest {          // No @ExtendWith, no mocks needed
    OrderCalculator calculator = new OrderCalculator();  // real object

    @Test void calculateTotal_multipleItems_sumsCorrectly() {
        List<OrderItem> items = List.of(
            new OrderItem("p1", 2, new BigDecimal("30.00")),  // 60.00
            new OrderItem("p2", 1, new BigDecimal("15.50"))   // 15.50
        );
        assertThat(calculator.calculateTotal(items)).isEqualByComparingTo("75.50");
    }

    @Test void applyDiscount_zeroPrice_returnsZero() {
        assertThat(calculator.applyDiscount(BigDecimal.ZERO, 20))
            .isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test void money_add_sumsCorrectly() {
        assertThat(Money.of(100, "USD").add(Money.of(50, "USD")))
            .isEqualTo(Money.of(150, "USD"));
    }
}

// ── RULE: mock at service boundary, never mock domain ────────────────────────
// MOCK:   Repository, PaymentGateway, EmailClient, MessageProducer, Clock
// DON'T:  OrderCalculator, Money, OrderItem, UserType, discount rules
// SIGNAL: >5 mocks in one test → class has too many dependencies → split it
```

## Ứng Dụng Thực Tế

Nguyên tắc: mock infrastructure (I/O), test domain. Test với 10+ mock là code smell — xem xét chia nhỏ class. Test chỉ verify interaction (không assertion state) thường pass ngay cả khi hành vi sai.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào nên mock và khi nào không nên?</strong></summary>

**A:** **Nên mock**: (1) External system (email service, payment API, SMS) — slow, side effects, cost. (2) Time-dependent code (`LocalDateTime.now()`) — inject `Clock` và mock. (3) Non-deterministic behavior (random, network latency). (4) Isolate SUT — test một class mà không cần init toàn bộ dependency graph. **Không nên mock**: (1) Value objects, DTOs — không có logic. (2) Repository → dùng `@DataJpaTest` với real DB thay vì mock. (3) Simple utility (Math, String) — overhead không worth it. (4) Khi mock phức tạp hơn actual impl — sign to use real object.

</details>

<details>
<summary><strong>Over-mocking là gì và vấn đề gì?</strong></summary>

**A:** Over-mocking: mock quá nhiều dependencies → test brittle và không meaningful. Vấn đề: (1) Test verify implementation details (mock interactions) thay vì behavior — refactor làm test break dù behavior đúng. (2) False confidence: mock ≠ real behavior → test pass nhưng production fail. (3) Test maintenance burden: thay đổi internal implementation → phải update nhiều mock setup. (4) Test không catch integration issues. **Guideline**: prefer testing behavior over implementation. Nếu test phụ thuộc nhiều vào `verify(mock.method()...)` thay vì assert output → over-mocked. Prefer integration test hoặc narrower unit test.

</details>

<details>
<summary><strong>Spy trong Mockito dùng khi nào?</strong></summary>

**A:** `@Spy` (partial mock): wrap real object, real methods được gọi mặc định — có thể stub specific methods. Dùng khi: muốn test class thực nhưng cần stub một method cụ thể (ví dụ method gọi external service). Ví dụ:
```java
@Spy
EmailService emailService = new EmailService();
// Stub chỉ sendEmail để tránh thực sự gửi email
doReturn(true).when(emailService).sendEmail(any());
// Các method khác vẫn gọi real implementation
```
Khác `@Mock`: mock tất cả methods return default (null/0/false). Cẩn thận với spy: dùng `doReturn()` thay vì `when().thenReturn()` — khi stubbing spy, `when()` gọi real method trước khi stub.

</details>
