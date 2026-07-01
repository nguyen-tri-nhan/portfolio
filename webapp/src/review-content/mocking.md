---
key: "Mocking"
title: "Mocking"
crumb: "9. Testing"
---

Mocking thay thế dependency thật bằng test double có kiểm soát, cô lập unit đang test khỏi database, HTTP client và external system khác.

## Điểm Chính

- <strong>Mock</strong>: tất cả method trả về default (null, 0, empty) trừ khi được stub. Verify interaction.
- <strong>Spy</strong>: bọc object thật; method thật theo default, chỉ stub một số cụ thể.
- <strong>Stub</strong>: response được lập trình sẵn qua <code>when(...).thenReturn(...)</code>.
- <strong>Captor</strong>: capture argument được truyền vào mocked method để assertion chi tiết.
- Over-mocking: test chỉ verify interaction (không verify kết quả) dễ vỡ — mock infrastructure, không mock business object.

## Ví Dụ Code

*ArgumentCaptor và kiểm tra interaction*

```java
@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {
    @Mock PaymentGateway gateway;
    @Mock NotificationService notifier;
    @Captor ArgumentCaptor<ChargeRequest> chargeCaptor;
    @InjectMocks PaymentService service;

    @Test
    void charge_sendsCorrectAmountToGateway(){
        service.charge("user1", Money.of(5000, "USD"));
        verify(gateway).charge(chargeCaptor.capture());
        assertThat(chargeCaptor.getValue().getAmountCents()).isEqualTo(5000);
        verify(notifier).sendReceipt(eq("user1"), any());
    }
    @Test
    void charge_gatewayThrows_sendsFailure(){
        when(gateway.charge(any())).thenThrow(new GatewayException());
        assertThrows(PaymentException.class, () -> service.charge("user1", any()));
        verify(notifier).sendFailure(eq("user1"), any());
    }
}
```

## Ứng Dụng Thực Tế

Mock tại service boundary: repo, HTTP client, message publisher. Đừng mock domain object — test chúng trực tiếp. Dùng ArgumentCaptor khi cần verify cái gì được truyền, không chỉ là method có được gọi.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Sự khác biệt giữa mock, stub và spy?</strong></summary>

**A:** **Stub**: trả về giá trị cố định, không verify interaction. **Mock**: verify interaction — kiểm tra method có được gọi không, với argument nào, bao nhiêu lần. **Spy**: wrap real object, gọi real method mặc định, override một số method. Mockito: `mock()` tạo mock (tất cả method trả về default). `spy()` wrap real object. Stub ≈ mock trong Mockito (dùng mock nhưng chỉ setup return, không verify = functionally stub).

</details>

<details>
<summary><strong>Khi nào KHÔNG nên mock?</strong></summary>

**A:** (1) **Simple value object/POJO**: không cần mock `User`, `Order` — tạo instance thực. (2) **Third-party library infrastructure**: mock `HttpClient`, `JdbcTemplate` che giấu behavior thực — dùng WireMock, TestContainers thay thế. (3) **Class đang test**: mock the class under test = không test gì cả. (4) **Tất cả dependency**: over-mocking tạo test chỉ verify mock behavior, không verify real integration. Rule: mock external dependencies, không mock value/domain object.

</details>

<details>
<summary><strong>ArgumentCaptor dùng để làm gì?</strong></summary>

**A:** `ArgumentCaptor` capture argument được pass vào mock method để inspect sau:
```java
ArgumentCaptor<EmailRequest> captor = ArgumentCaptor.forClass(EmailRequest.class);
verify(emailService).send(captor.capture());
EmailRequest captured = captor.getValue();
assertEquals("user@example.com", captured.getTo());
```
Hữu ích khi argument là object được tạo trong method (không accessible từ test). Thay thế: `ArgumentMatchers.argThat()` nếu chỉ cần check condition, không cần toàn bộ object.

</details>
