---
key: "Mockito (Mock / Spy / Captor)"
title: "Mockito: Mock, Spy, Captor"
crumb: "9. Testing › Mocking"
---

Mockito cung cấp ba loại test double: Mock (kiểm soát hoàn toàn), Spy (fake một phần bọc object thật) và ArgumentCaptor (capture argument để assertion).

## Điểm Chính

- <code>@Mock</code>: tất cả method trả về default; có thể verify.
- <code>@Spy</code>: gọi method thật theo default; stub từng cái cụ thể.
- <code>@InjectMocks</code>: Mockito tạo class đang test và inject mock/spy.
- <code>doReturn(val).when(spy).method()</code>: dùng cú pháp này cho spy (tránh gọi method thật khi stubbing).
- <code>verify(mock, times(2)).method()</code> / <code>verify(mock, never()).method()</code>.

## Ví Dụ Code

*OrderService test với @Mock/@Spy/@Captor — verify argument details và interaction order*

```java
@ExtendWith(MockitoExtension.class)
@DisplayName("Mockito: Mock / Spy / Captor")
class OrderServiceMockitoTest {

    @Mock  OrderRepository  orderRepo;
    @Mock  EmailService     emailService;
    @Spy   OrderCalculator  calculator = new OrderCalculator();   // SPY: real object
    @Captor ArgumentCaptor<Order>        orderCaptor;
    @Captor ArgumentCaptor<EmailRequest> emailCaptor;
    @InjectMocks OrderService service;

    // ── MOCK: full control, no real method called ────────────────────────────
    @Test
    @DisplayName("mock: verify order is saved with CONFIRMED status")
    void placeOrder_mockRepo_savesConfirmedOrder() {
        when(orderRepo.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(42L);           // simulate DB-generated ID
            return o;
        });
        service.placeOrder(new OrderRequest("u1", List.of(item("p1", 2, 50))));

        verify(orderRepo).save(orderCaptor.capture());
        Order saved = orderCaptor.getValue();
        assertAll(
            () -> assertThat(saved.getStatus()).isEqualTo(OrderStatus.CONFIRMED),
            () -> assertThat(saved.getUserId()).isEqualTo("u1"),
            () -> assertThat(saved.getTotal()).isEqualByComparingTo("100.00")
        );
    }

    // ── CAPTOR: inspect what was passed to email service ─────────────────────
    @Test
    @DisplayName("captor: email sent to correct address with correct amount")
    void placeOrder_sendsConfirmationEmail_withCorrectDetails() {
        when(orderRepo.save(any())).thenReturn(confirmedOrder());
        service.placeOrder(new OrderRequest("u1", List.of(item("p1", 1, 200))));

        verify(emailService).send(emailCaptor.capture());
        EmailRequest email = emailCaptor.getValue();
        assertAll(
            () -> assertThat(email.getTo()).isEqualTo("u1@example.com"),
            () -> assertThat(email.getSubject()).contains("Order Confirmation"),
            () -> assertThat(email.getBody()).contains("200.00")
        );
    }

    // ── SPY: real method called by default, stub specific method ─────────────
    @Test
    @DisplayName("spy: real calculateTotal() used, but applyVipDiscount() stubbed")
    void placeOrder_vipUser_realCalculatorWithStubbedDiscount() {
        // BAD way with spy → doReturn().when() to avoid calling real method prematurely
        doReturn(new BigDecimal("80.00")).when(calculator).applyVipDiscount(any());

        Order result = service.placeOrderForVip("u1", List.of(item("p1", 1, 100)));

        // Real calculateTotal() was called (not stubbed)
        verify(calculator).calculateTotal(any());          // real method invoked
        verify(calculator).applyVipDiscount(any());        // stubbed: returns 80.00
        assertThat(result.getTotal()).isEqualByComparingTo("80.00");
    }

    // ── verify interaction count and order ───────────────────────────────────
    @Test
    @DisplayName("verify: email sent exactly once, repo saved before email")
    void placeOrder_interactionOrder_repoBeforeEmail() {
        when(orderRepo.save(any())).thenReturn(confirmedOrder());
        service.placeOrder(new OrderRequest("u1", List.of(item("p1", 1, 50))));

        InOrder inOrder = inOrder(orderRepo, emailService);
        inOrder.verify(orderRepo).save(any());          // repo first
        inOrder.verify(emailService).send(any());       // then email
        verify(emailService, times(1)).send(any());     // exactly once
        verify(emailService, never()).sendFailure(any()); // no failure email
    }

    private OrderItem item(String productId, int qty, double price) {
        return new OrderItem(productId, qty, new BigDecimal(price + ""));
    }
    private Order confirmedOrder() {
        Order o = new Order("u1", List.of()); o.setId(1L); o.setStatus(OrderStatus.CONFIRMED);
        return o;
    }
}
```

## Ứng Dụng Thực Tế

Ưu tiên mock hơn spy. Spy trên object thật thường báo hiệu class đang test quá coupled với collaborator. Chỉ dùng spy cho partial mocking của legacy code khó refactor.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa spy() và mock()?
1. Tại sao dùng doReturn() thay vì when().thenReturn() với spy?
1. @InjectMocks inject mock thế nào?
