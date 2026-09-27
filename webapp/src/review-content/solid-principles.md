---
key: "SOLID Principles"
title: "SOLID Principles"
crumb: "9. Design Patterns › Design Principles"
---

SOLID là 5 nguyên tắc thiết kế hướng đối tượng do Robert C. Martin tập hợp (tên viết tắt do Michael Feathers đặt). Mục tiêu chung: code **dễ thay đổi** — sửa một yêu cầu thì chỉ phải đụng vào ít chỗ, và không làm hỏng chỗ khác. SOLID không phải luật cứng; áp dụng máy móc sinh ra hàng chục interface và lớp trừu tượng không cần thiết.

## Điểm Chính

- **S — Single Responsibility Principle**: một module chỉ nên có **một lý do để thay đổi**. Trong *Clean Architecture*, Martin diễn đạt lại: một module chỉ chịu trách nhiệm với **một actor** (một nhóm người dùng/bên liên quan). Không phải "một class chỉ làm một việc" theo nghĩa một method.
- **O — Open/Closed Principle** (Bertrand Meyer, 1988): module **mở để mở rộng, đóng để sửa đổi** — thêm hành vi mới bằng cách thêm code (class mới, implementation mới) thay vì sửa code đang chạy ổn định.
- **L — Liskov Substitution Principle** (Barbara Liskov, 1987): object của lớp con phải **thay thế được** lớp cha mà không làm sai chương trình. Lớp con không được đòi hỏi điều kiện đầu vào chặt hơn, không được đảm bảo kết quả yếu hơn, không được ném ngoại lệ mà lớp cha không hứa.
- **I — Interface Segregation Principle**: client không nên bị buộc phụ thuộc vào method nó không dùng → tách interface lớn thành các interface nhỏ theo vai trò.
- **D — Dependency Inversion Principle**: module cấp cao (business logic) không phụ thuộc module cấp thấp (DB, HTTP client); cả hai phụ thuộc vào **abstraction**, và abstraction thuộc về phía cấp cao. Spring DI là cơ chế để *thực hiện* DIP, nhưng DI ≠ DIP: inject một class cụ thể vẫn là phụ thuộc vào chi tiết.

## Ví Dụ Code

*SRP — tách theo actor*

```java
// ❌ Một class phục vụ ba actor: kế toán (tính lương), HR (báo cáo giờ), DBA (lưu trữ)
class Employee {
    Money calculatePay() { ... }          // đổi khi phòng kế toán đổi quy tắc
    String reportHours() { ... }          // đổi khi HR đổi định dạng báo cáo
    void save() { ... }                   // đổi khi đổi schema/DB
}
// Kế toán yêu cầu đổi cách tính giờ làm thêm → sửa helper dùng chung → báo cáo HR sai theo

// ✅ Mỗi actor một class; Employee chỉ còn dữ liệu
record Employee(long id, String name, BigDecimal hourlyRate) {}
class PayCalculator      { Money calculatePay(Employee e, Timesheet t) { ... } }
class HoursReporter      { String report(Employee e, Timesheet t) { ... } }
class EmployeeRepository { void save(Employee e) { ... } }
```

*OCP — thêm phương thức thanh toán mà không sửa code cũ*

```java
// ❌ Mỗi phương thức mới phải sửa switch này (và mọi switch tương tự rải rác)
BigDecimal fee(Payment p) {
    return switch (p.method()) {
        case CARD   -> p.amount().multiply(new BigDecimal("0.03"));
        case WALLET -> new BigDecimal("1.00");
        // thêm BANK_TRANSFER → sửa ở đây, test lại toàn bộ
    };
}

// ✅ Strategy: thêm phương thức = thêm một bean
interface FeePolicy {
    PaymentMethod method();
    BigDecimal fee(BigDecimal amount);
}

@Component class CardFee implements FeePolicy {
    public PaymentMethod method() { return PaymentMethod.CARD; }
    public BigDecimal fee(BigDecimal amount) { return amount.multiply(new BigDecimal("0.03")); }
}

@Service class FeeService {
    private final Map<PaymentMethod, FeePolicy> policies;
    FeeService(List<FeePolicy> all) {                       // Spring inject mọi implementation
        this.policies = all.stream().collect(Collectors.toMap(FeePolicy::method, p -> p));
    }
    BigDecimal fee(Payment p) { return policies.get(p.method()).fee(p.amount()); }
}
```

*LSP — ví dụ kinh điển và ví dụ trong JDK*

```java
// ❌ Square "là" Rectangle về mặt toán học, nhưng không thay thế được về hành vi
class Rectangle {
    protected int w, h;
    void setWidth(int w)  { this.w = w; }
    void setHeight(int h) { this.h = h; }
    int area() { return w * h; }
}
class Square extends Rectangle {
    @Override void setWidth(int w)  { this.w = w; this.h = w; }
    @Override void setHeight(int h) { this.w = h; this.h = h; }
}

void resize(Rectangle r) {
    r.setWidth(5);
    r.setHeight(4);
    assert r.area() == 20;   // Square → 16: code viết cho Rectangle bị sai
}

// Trong JDK: List.of(...) trả về List nhưng add() ném UnsupportedOperationException
List<String> names = List.of("a", "b");
names.add("c");              // runtime exception — hợp đồng List có ghi add là "optional operation",
                             // nhưng code nhận List vẫn phải biết điều đó → ranh giới của LSP
```

*ISP — tách interface theo vai trò*

```java
// ❌ Worker phải implement cả những thứ không liên quan
interface OrderOperations {
    Order find(long id);
    void save(Order o);
    byte[] exportPdf(long id);
    void sendReminderEmail(long id);
}

// ✅ Mỗi client chỉ phụ thuộc thứ nó cần
interface OrderReader   { Order find(long id); }
interface OrderWriter   { void save(Order o); }
interface OrderExporter { byte[] exportPdf(long id); }

class ReportController {
    private final OrderReader reader;       // không thể vô tình gọi save()
    private final OrderExporter exporter;
    ...
}
```

*DIP — abstraction thuộc về tầng business*

```java
// ❌ Business logic phụ thuộc trực tiếp chi tiết hạ tầng
class CheckoutService {
    private final StripeClient stripe = new StripeClient("sk_live_...");   // tự tạo, khóa cứng
    void checkout(Cart cart) { stripe.charge(cart.total()); }
}

// ✅ Tầng domain định nghĩa port; hạ tầng implement
package com.example.shop.checkout;           // domain
public interface PaymentGateway {
    PaymentResult charge(Money amount, String idempotencyKey);
}

@Service
class CheckoutService {
    private final PaymentGateway gateway;    // phụ thuộc abstraction, inject qua constructor
    CheckoutService(PaymentGateway gateway) { this.gateway = gateway; }
}

package com.example.shop.infrastructure.stripe;   // chi tiết
@Component
class StripePaymentGateway implements PaymentGateway { ... }
// Test CheckoutService bằng fake PaymentGateway, không cần gọi Stripe
```

## Ứng Dụng Thực Tế

**SOLID trong Spring**: constructor injection + interface cho các cổng ra ngoài (payment, email, storage) = DIP; inject `List<Strategy>`/`Map<String, Strategy>` = OCP; `JpaRepository` tách khỏi service = SRP. Kiến trúc Hexagonal/Clean Architecture là DIP áp dụng ở cấp độ module.

**Đừng lạm dụng**:
- Interface chỉ có đúng một implementation và không có lý do thay thế (không phải cổng ra hạ tầng, không cần fake khi test) thường là thừa — thêm khi thật sự cần.
- Tách class quá nhỏ làm logic phân mảnh, phải mở 10 file để hiểu một luồng.
- OCP không có nghĩa là không bao giờ sửa code — chỉ tạo điểm mở rộng ở chỗ **đã thấy thay đổi lặp lại** (lần thứ hai, thứ ba), không đoán trước.

**Dấu hiệu vi phạm hay gặp trong code review**:
- Service 2.000 dòng với 20 dependency (SRP).
- Chuỗi `if/else instanceof` hoặc `switch` theo loại lặp lại ở nhiều nơi (OCP).
- Lớp con override method rồi ném `UnsupportedOperationException` (LSP/ISP).
- `new` trực tiếp HTTP client/repository bên trong business logic (DIP).

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Single Responsibility có nghĩa là mỗi class chỉ có một method?</strong></summary>

**A:** Không. SRP nói về **lý do thay đổi**: một module chỉ nên thay đổi vì yêu cầu của một actor (một nhóm bên liên quan). Class `InvoicePdfRenderer` có thể có 10 method, vẫn đúng SRP nếu tất cả phục vụ việc render PDF hóa đơn. Ngược lại, một class 3 method vừa tính thuế (theo yêu cầu kế toán), vừa định dạng email (theo marketing) là vi phạm — hai nhóm yêu cầu khác nhau cùng sửa một file, dễ làm hỏng của nhau và gây conflict khi merge.

</details>

<details>
<summary><strong>Cho ví dụ vi phạm Liskov Substitution Principle.</strong></summary>

**A:** Kinh điển: `Square extends Rectangle` — `setWidth` của Square đổi cả chiều cao, nên code viết cho Rectangle (đặt width 5, height 4, mong diện tích 20) nhận kết quả sai. Thực tế hơn: lớp con override method rồi ném `UnsupportedOperationException`, hoặc thêm điều kiện đầu vào chặt hơn (`ReadOnlyRepository extends Repository` với `save()` ném lỗi). Dấu hiệu: code sử dụng phải `instanceof` để kiểm tra loại con trước khi gọi. Cách sửa: dùng composition, hoặc tách interface (ISP) để lớp con chỉ cam kết những gì làm được.

</details>

<details>
<summary><strong>Dependency Injection và Dependency Inversion khác nhau thế nào?</strong></summary>

**A:** Dependency Inversion là **nguyên tắc thiết kế**: module cấp cao và cấp thấp đều phụ thuộc abstraction, và abstraction do phía cấp cao định nghĩa — hướng phụ thuộc trong source code ngược với hướng gọi lúc runtime. Dependency Injection là **kỹ thuật**: object nhận dependency từ bên ngoài (constructor, setter) thay vì tự tạo. DI giúp thực hiện DIP, nhưng có thể dùng DI mà vẫn vi phạm DIP (inject thẳng `StripeClient` cụ thể vào service), và có thể theo DIP mà không cần container (tự truyền implementation qua constructor).

</details>

<details>
<summary><strong>Open/Closed Principle áp dụng thế nào trong Spring?</strong></summary>

**A:** Định nghĩa một interface cho điểm thay đổi (ví dụ `NotificationChannel`), mỗi biến thể là một bean. Service nhận `List<NotificationChannel>` hoặc `Map<String, NotificationChannel>` (key là tên bean) qua constructor. Thêm kênh mới (Slack, SMS) = thêm một class `@Component`, không sửa service. Các điểm mở rộng có sẵn của Spring cũng theo OCP: `BeanPostProcessor`, `HandlerInterceptor`, auto-configuration với `@ConditionalOnMissingBean` — mở rộng hành vi framework mà không sửa source của nó.

</details>
