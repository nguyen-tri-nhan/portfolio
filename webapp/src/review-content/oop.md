---
key: "OOP"
title: "Lập Trình Hướng Đối Tượng (OOP)"
crumb: "1. Core Java"
---

OOP tổ chức code xoay quanh bốn trụ cột — <strong>Encapsulation, Inheritance, Polymorphism, Abstraction</strong> — giúp xây dựng hệ thống modular, tái sử dụng và dễ bảo trì.

## Điểm Chính

- Encapsulation: gom dữ liệu và hành vi lại, che giấu nội bộ sau một public API rõ ràng.
- Inheritance: subclass kế thừa và tái sử dụng parent class qua <code>extends</code>; Java chỉ hỗ trợ đơn kế thừa class.
- Polymorphism: cùng một tham chiếu, hành vi khác nhau lúc runtime — method dispatch được giải quyết tại runtime.
- Abstraction: chỉ lộ <em>cái gì</em> chứ không lộ <em>làm thế nào</em>; dùng interface hoặc abstract class.
- Ưu tiên <strong>composition thay vì inheritance</strong> để tránh tight coupling và vấn đề fragile base-class.

## Ví Dụ Code

*OOP: Template Method + Polymorphism trong Order processing*

```java
import java.util.Objects;

// Abstraction: callers invoke process(), not the internal steps
public abstract class OrderProcessor {
    private final String processorId;
    private ProcessorStatus status = ProcessorStatus.IDLE;

    protected OrderProcessor(String processorId) {
        this.processorId = Objects.requireNonNull(processorId, "processorId required");
    }

    // Template Method — defines the skeleton; subclasses fill in the blanks
    public final ProcessingResult process(Order order) {
        validateOrder(order);                    // hook — subclass defines HOW
        ProcessingResult result = executeProcessing(order);
        this.status = result.isSuccess()
            ? ProcessorStatus.DONE : ProcessorStatus.FAILED;
        return result;
    }

    protected abstract void validateOrder(Order order);
    protected abstract ProcessingResult executeProcessing(Order order);

    // Encapsulation: controlled read-only access to internal state
    public ProcessorStatus getStatus() { return status; }
    public String getProcessorId()     { return processorId; }
}

// Inheritance + Polymorphism: concrete subclass fills in the contract
public class DigitalOrderProcessor extends OrderProcessor {
    private final EmailService emailService;

    public DigitalOrderProcessor(EmailService emailService) {
        super("digital-processor");
        this.emailService = Objects.requireNonNull(emailService);
    }

    @Override
    protected void validateOrder(Order order) {
        if (order.getItems().isEmpty())
            throw new IllegalArgumentException("Order must have at least one item");
    }

    @Override
    protected ProcessingResult executeProcessing(Order order) {
        emailService.sendDownloadLink(order.getCustomerEmail(), order.getItems());
        return ProcessingResult.success(order.getId());
    }
}

// --- Usage: caller works with the abstract type (Polymorphism) ---
OrderProcessor processor = new DigitalOrderProcessor(emailService);
ProcessingResult result = processor.process(order); // dispatched to DigitalOrderProcessor at runtime
```

## Ứng Dụng Thực Tế

Trong phỏng vấn, hãy liên kết OOP với Spring: các class <code>@Service</code> là các implementation của interface; Spring inject đúng implementation (polymorphism + DI). Đề cập SOLID principles — chúng mở rộng tư tưởng OOP thành hướng dẫn kiến trúc.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Giải thích bốn trụ cột OOP kèm ví dụ từ codebase của bạn.</strong></summary>

**A:** (1) **Encapsulation**: ẩn internal state, expose qua method — `private` fields với getter/setter, validation trong setter. (2) **Inheritance**: reuse và extend — `AdminUser extends User`, Spring `@Repository` extends JPA pattern. (3) **Polymorphism**: cùng interface, behavior khác nhau — `PaymentService.pay()` với `CreditCardPayment` và `PaypalPayment` implementation. (4) **Abstraction**: hide complexity — `OrderRepository` interface ẩn JPA implementation, service chỉ biết repository interface.

</details>

<details>
<summary><strong>Khi nào bạn chọn composition thay vì inheritance?</strong></summary>

**A:** **Composition** (has-a) thường tốt hơn **inheritance** (is-a) vì: (1) Linh hoạt hơn — swap behavior runtime bằng cách inject khác. (2) Tránh tight coupling với parent implementation — thay đổi parent không ảnh hưởng. (3) Tránh diamond problem và deep hierarchy. (4) Testable hơn — inject mock thay vì override. Inheritance hợp lý khi có "is-a" rõ ràng (không chỉ muốn reuse code) và subclass có thể thay thế parent (Liskov). Rule: "Favor composition over inheritance" (GoF principle).

</details>

<details>
<summary><strong>Overloading và overriding khác nhau thế nào?</strong></summary>

**A:** **Overloading** (compile-time polymorphism): cùng class, cùng tên method, khác parameter type/count — compiler chọn version đúng dựa trên argument type lúc compile. **Overriding** (runtime polymorphism): subclass redefine method của parent với cùng signature — JVM chọn version dựa trên actual object type lúc runtime (`invokevirtual`). Overloading: `log(String)`, `log(Exception)`. Overriding: `Animal.speak()` được Dog override thành "Woof". `@Override` annotation giúp compiler kiểm tra overriding đúng không.

</details>
