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

1. Sự khác biệt giữa mock, stub và spy?
1. Khi nào KHÔNG nên mock?
1. ArgumentCaptor dùng để làm gì?
