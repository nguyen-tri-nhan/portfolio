---
key: "Observer"
title: "Observer Pattern"
crumb: "10. Design Patterns › Behavioral"
---

Observer định nghĩa quan hệ one-to-many trong đó subject thông báo tất cả observer đã đăng ký khi state thay đổi — nền tảng của event-driven system.

## Điểm Chính

- Subject (publisher): duy trì danh sách observer, thông báo khi state thay đổi.
- Observer (subscriber): implement <code>update(event)</code>.
- Decoupled: subject không biết loại observer, chỉ biết interface.
- Spring: <code>ApplicationEventPublisher</code> + <code>@EventListener</code>. Async với <code>@Async</code>.
- Synchronous mặc định: exception của observer rollback transaction của publisher.

## Ví Dụ Code

*Spring ApplicationEvent Observer với @Async*

```java
// Spring event-driven Observer
public record OrderPlacedEvent(Long orderId, String userId, BigDecimal total){}

@Service public class OrderService {
    @Autowired ApplicationEventPublisher pub;
    @Transactional
    public Order place(OrderRequest req){
        Order o = repo.save(new Order(req));
        pub.publishEvent(new OrderPlacedEvent(o.getId(), req.getUserId(), o.getTotal()));
        return o;
    }
}
// Observers — completely decoupled from OrderService
@Component class EmailObs {
    @EventListener @Async
    void on(OrderPlacedEvent e){ email.sendConfirmation(e.userId()); }
}
@Component class InventoryObs {
    @EventListener void on(OrderPlacedEvent e){ inventory.reserve(e.orderId()); }
}
```

## Ứng Dụng Thực Tế

Dùng @Async cho observer để tách biệt thất bại của chúng khỏi transaction của publisher. Để quan sát cross-service, dùng Kafka — Spring event chỉ trong process. Dùng @TransactionalEventListener để fire sau khi transaction commit.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Observer Pattern và Spring ApplicationEvent khác nhau thế nào?</strong></summary>

**A:** GoF Observer: subject giữ list observers, gọi trực tiếp. Tight coupling: subject biết về observer interface. Spring ApplicationEvent: EventPublisher publish event → container dispatch đến tất cả listeners trong context. Loose coupling: publisher không biết về listeners. Async: `@Async @EventListener` để process asynchronously. Transactional: `@TransactionalEventListener(phase=AFTER_COMMIT)` — chỉ trigger sau transaction commit. Ví dụ: OrderCreated event → send email (async) + update inventory + notify analytics.

</details>
