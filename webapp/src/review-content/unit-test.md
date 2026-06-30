---
key: "Unit Test"
title: "Unit Testing"
crumb: "9. Testing"
---

Unit test kiểm tra class/method riêng lẻ trong isolation — nhanh, không có external dependency, tạo nền tảng test pyramid và cho phép refactor an toàn.

## Điểm Chính

- Test pyramid: nhiều unit test → ít integration test hơn → rất ít E2E test.
- AAA pattern: <strong>Arrange</strong> (chuẩn bị), <strong>Act</strong> (thực thi), <strong>Assert</strong> (kiểm tra).
- JUnit 5: <code>@Test</code>, <code>@BeforeEach</code>, <code>@AfterEach</code>, <code>@BeforeAll</code>, <code>@AfterAll</code>.
- Không có Spring context trong unit test — khởi tạo class trực tiếp, mock dependency.
- Nhanh: hàng nghìn unit test phải chạy trong vài giây.

## Ví Dụ Code

*JUnit 5 unit test theo AAA pattern*

```java
class OrderServiceTest {
    OrderRepository repo = mock(OrderRepository.class);
    PaymentGateway gateway = mock(PaymentGateway.class);
    OrderService service = new OrderService(repo, gateway);

    @Test
    void placeOrder_validRequest_savesAndChargesPayment(){
        // Arrange
        when(gateway.charge(any())).thenReturn(new ChargeResult("ch_123"));
        // Act
        Order result = service.placeOrder(validReq());
        // Assert
        assertThat(result.getStatus()).isEqualTo("PENDING");
        verify(repo).save(any(Order.class));
        verify(gateway).charge(any());
    }
    @Test
    void placeOrder_paymentFails_throwsException(){
        when(gateway.charge(any())).thenThrow(new PaymentDeclinedException());
        assertThrows(PaymentException.class, () -> service.placeOrder(validReq()));
    }
}
```

## Ứng Dụng Thực Tế

Viết unit test cho: business logic, edge case, error path, domain rule. Không test getter/setter. Hướng đến coverage cao cho logic, không phải 100% line coverage (khuyến khích test vô nghĩa).

## Câu Hỏi Phỏng Vấn

1. Test pyramid là gì và tại sao quan trọng?
1. AAA pattern là gì?
1. Điều gì KHÔNG nên unit test?
