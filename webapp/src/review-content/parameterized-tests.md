---
key: "Parameterized Tests"
title: "Parameterized Tests"
crumb: "9. Testing › Unit Test"
---

Parameterized test chạy cùng logic test với nhiều input, giảm trùng lặp trong khi tăng coverage cho boundary condition và edge case.

## Điểm Chính

- <code>@ParameterizedTest</code> + <code>@ValueSource</code>: input đơn giản một giá trị.
- <code>@CsvSource</code>: nhiều parameter mỗi test case.
- <code>@MethodSource("methodName")</code>: static method trả về <code>Stream&lt;Arguments&gt;</code> cho object phức tạp.
- <code>@EnumSource</code>: test với tất cả hoặc lọc enum value.

## Ví Dụ Code

*@CsvSource, @MethodSource, @EnumSource, @ValueSource cho OrderService*

```java
@ExtendWith(MockitoExtension.class)
@DisplayName("Parameterized Test Examples")
class OrderParameterizedTest {

    @InjectMocks OrderService service;
    @Mock OrderRepository repo;

    // ── @CsvSource: simple tabular input/expected pairs ──────────────────────
    @ParameterizedTest(name = "discount type={0} price={1} → expected={2}")
    @CsvSource({
        "REGULAR,  100.00, 100.00",   // no discount
        "MEMBER,   100.00,  90.00",   // 10% off
        "VIP,      100.00,  80.00",   // 20% off
        "STUDENT,   50.00,  37.50",   // 25% off
    })
    void applyDiscount_variousTypes_correctPrice(String type, BigDecimal price, BigDecimal expected) {
        BigDecimal result = service.applyDiscount(CustomerType.valueOf(type), price);
        assertThat(result).isEqualByComparingTo(expected);
    }

    // ── @MethodSource: complex objects / multiple args ────────────────────────
    @ParameterizedTest(name = "invalid order: {1}")
    @MethodSource("invalidOrderRequests")
    void placeOrder_invalidRequest_throwsValidationException(OrderRequest req, String reason) {
        assertThrows(ValidationException.class,
            () -> service.placeOrder(req),
            "Expected validation failure for: " + reason);
    }

    static Stream<Arguments> invalidOrderRequests() {
        return Stream.of(
            Arguments.of(new OrderRequest(null, validItems()),            "null userId"),
            Arguments.of(new OrderRequest("",   validItems()),            "blank userId"),
            Arguments.of(new OrderRequest("u1", List.of()),               "empty items"),
            Arguments.of(new OrderRequest("u1", null),                    "null items"),
            Arguments.of(new OrderRequest("u1", itemsExceedingLimit()),   "too many items (>100)")
        );
    }

    // ── @EnumSource: test all or filtered enum values ─────────────────────────
    @ParameterizedTest(name = "terminal status {0} cannot be cancelled")
    @EnumSource(value = OrderStatus.class,
                names  = {"CANCELLED", "DELIVERED", "REFUNDED"})  // only these
    void cancelOrder_terminalStatus_throwsInvalidStateException(OrderStatus status) {
        Order order = new Order("u1", validItems());
        order.setStatus(status);
        when(repo.findById(any())).thenReturn(Optional.of(order));
        assertThrows(InvalidStateException.class, () -> service.cancelOrder(order.getId()));
    }

    // ── @ValueSource: simple single-value parameterization ───────────────────
    @ParameterizedTest(name = "blank userId={0} rejected")
    @ValueSource(strings = { " ", "  ", "	", "
" })
    void placeOrder_blankUserId_throwsValidation(String blankId) {
        assertThrows(ValidationException.class,
            () -> service.placeOrder(new OrderRequest(blankId, validItems())));
    }

    // ── helpers ──────────────────────────────────────────────────────────────
    private static List<OrderItem> validItems() {
        return List.of(new OrderItem("product-1", 2, new BigDecimal("29.99")));
    }
    private static List<OrderItem> itemsExceedingLimit() {
        return IntStream.range(0, 101)
            .mapToObj(i -> new OrderItem("p" + i, 1, BigDecimal.ONE))
            .toList();
    }
}
```

## Ứng Dụng Thực Tế

Thay thế các test method lặp lại tương tự bằng @ParameterizedTest. Dùng @CsvSource cho primitive, @MethodSource cho domain object.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Khi nào dùng @MethodSource thay vì @CsvSource?</strong></summary>

**A:** **`@CsvSource`**: phù hợp data đơn giản (string, số, enum) inline trong annotation. **`@MethodSource`**: khi data phức tạp (object, collection, dynamically generated), muốn reuse data giữa nhiều test, cần logic tạo data. Ví dụ `@MethodSource`: test với `User` object không thể dùng CSV. Cú pháp: method trả về `Stream<Arguments>` và được đặt tên trong `@MethodSource("provideTestCases")`. Nếu method cùng class: `@MethodSource("provideTestCases")`; khác class: fully qualified method name.

</details>

<details>
<summary><strong>Làm thế nào để đặt tên mô tả cho parameterized case?</strong></summary>

**A:** Dùng `name` attribute trong `@ParameterizedTest`:
```java
@ParameterizedTest(name = "Input {0} should return {1}")
@CsvSource({"1, odd", "2, even", "3, odd"})
void testParity(int input, String expected) { ... }
```
Placeholders: `{0}`, `{1}`... cho arguments, `{index}` cho test index, `{displayName}` cho method name, `{arguments}` cho tất cả args joined. Custom name giúp đọc test report rõ ràng hơn thay vì default "[1] 1, odd".

</details>

<details>
<summary><strong>Có thể parameterize với enum value không?</strong></summary>

**A:** Có — dùng `@EnumSource`:
```java
@ParameterizedTest
@EnumSource(Status.class)
void testAllStatuses(Status status) {
    assertNotNull(service.process(status));
}
```
Test chạy với tất cả enum values. Filter: `@EnumSource(value=Status.class, names={"ACTIVE", "PENDING"})` hoặc `mode=EXCLUDE`. Cũng có thể dùng `@MethodSource` trả về `Arrays.stream(Status.values())`.

</details>
