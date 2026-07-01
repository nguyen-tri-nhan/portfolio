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

<details>
<summary><strong>Unit test tốt có những đặc điểm nào?</strong></summary>

**A:** **F.I.R.S.T** principles: **F**ast (run trong ms, không I/O), **I**solated (không depend vào external system, không shared state giữa tests), **R**epeatable (cùng result mỗi lần run, bất kể environment), **S**elf-validating (assert clearly pass/fail, không cần manual check), **T**imely (viết cùng lúc với code, không sau). Thêm: **one assertion per test** (hoặc ít nhất một concept per test), **descriptive name** (`givenValidUser_whenSave_thenReturnId`), **AAA pattern** (Arrange, Act, Assert). Test nhỏ, fast, không depend vào nhau.

</details>

<details>
<summary><strong>Test coverage 100% có nghĩa là code không có bug không?</strong></summary>

**A:** **Không** — 100% line coverage chỉ nghĩa là mọi line được execute ít nhất một lần, không đảm bảo đúng behavior. Vấn đề: (1) Test không có meaningful assertion. (2) Branch coverage thấp — test một path nhưng không test branch khác. (3) Không test edge cases (null, empty, boundary values). (4) Integration issues không được cover bởi unit test. (5) Race conditions, memory leak, performance không được detect. Coverage là **necessary but not sufficient** — 70-80% meaningful coverage > 100% coverage với bad tests. Focus: mutation testing (PIT) để verify test quality.

</details>

<details>
<summary><strong>Given-When-Then (GWT) pattern là gì?</strong></summary>

**A:** GWT (BDD-style) structure test để rõ ràng: **Given** (Arrange): setup preconditions, test data, mocks. **When** (Act): execute action under test. **Then** (Assert): verify expected outcome. Ví dụ:
```java
@Test
void givenInsufficientFunds_whenWithdraw_thenThrowException() {
    // Given
    Account account = new Account(50.0);
    // When / Then
    assertThrows(InsufficientFundsException.class,
        () -> account.withdraw(100.0));
}
```
Benefit: test là executable documentation — đọc test biết behavior. Thay vì AAA comment, dùng GWT style cho BDD test với Cucumber/Serenity. Nhất quán hơn khi có tên test method follow "given_when_then".

</details>
