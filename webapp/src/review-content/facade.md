---
key: "Facade"
title: "Facade Pattern"
crumb: "10. Design Patterns › Structural"
---

Facade cung cấp interface đơn giản, hướng use-case cho subsystem phức tạp, ẩn độ phức tạp nội bộ và giảm coupling.

## Điểm Chính

- Client tương tác với Facade; subsystem class vẫn có thể truy cập trực tiếp nếu cần.
- KHÔNG thêm chức năng — chỉ đơn giản hóa truy cập.
- Ví dụ Spring: JdbcTemplate (trên raw JDBC), RestTemplate (trên HTTP), RedisTemplate.
- Service class thường đóng vai trò facade điều phối nhiều repository.

## Ví Dụ Code

*CheckoutFacade: InventoryService + PaymentService + EmailService + OrderRepository trong 1 method*

```java
// ── CheckoutFacade: one simple method hides 4 coordinated subsystems ─────────
@Service
@Slf4j
public class CheckoutFacade {

    private final InventoryService  inventoryService;
    private final PaymentService    paymentService;
    private final EmailService      emailService;
    private final OrderRepository   orderRepository;

    // Constructor injection
    public CheckoutFacade(InventoryService inv, PaymentService pay,
                          EmailService email, OrderRepository repo) {
        this.inventoryService = inv;
        this.paymentService   = pay;
        this.emailService     = email;
        this.orderRepository  = repo;
    }

    // ── Single facade method: client doesn't know about subsystem complexity ──
    @Transactional
    public CheckoutResult checkout(CheckoutRequest request) {
        log.info("Checkout start userId={} items={}", request.getUserId(), request.getItemCount());

        // Subsystem 1: validate and reserve inventory
        InventoryReservation reservation = inventoryService.reserve(request.getItems());
        if (!reservation.isSuccessful()) {
            throw new InsufficientStockException(reservation.getUnavailableItems());
        }

        // Subsystem 2: process payment
        PaymentResult payment;
        try {
            payment = paymentService.charge(ChargeRequest.from(request));
        } catch (PaymentDeclinedException e) {
            inventoryService.release(reservation.getReservationId()); // compensate
            throw e;
        }

        // Subsystem 3: persist order
        Order order = orderRepository.save(Order.builder()
            .userId(request.getUserId())
            .items(request.getItems())
            .paymentRef(payment.getTransactionId())
            .status(OrderStatus.CONFIRMED)
            .build());

        // Subsystem 4: send confirmation (async — don't block checkout)
        emailService.sendConfirmationAsync(order);

        log.info("Checkout complete orderId={} total={}", order.getId(), order.getTotal());
        return new CheckoutResult(order.getId(), payment.getTransactionId(), order.getTotal());
    }

    // Separate facade method for cancellation
    @Transactional
    public CancellationResult cancelOrder(Long orderId, String reason) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        paymentService.refund(order.getPaymentRef(), order.getTotal());
        inventoryService.restock(order.getItems());
        order.cancel(reason);
        orderRepository.save(order);
        emailService.sendCancellationNotice(order);
        return new CancellationResult(orderId, "CANCELLED");
    }
}

// ── REST controller: thin, delegates entirely to facade ───────────────────
@RestController @RequestMapping("/api/checkout")
public class CheckoutController {
    private final CheckoutFacade facade;

    @PostMapping public ResponseEntity<CheckoutResult> checkout(@RequestBody CheckoutRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(facade.checkout(req));
    }
    @DeleteMapping("/{orderId}") public ResponseEntity<CancellationResult> cancel(
            @PathVariable Long orderId, @RequestParam String reason) {
        return ResponseEntity.ok(facade.cancelOrder(orderId, reason));
    }
}
```

## Ứng Dụng Thực Tế

Thiết kế service class như facade: expose method use-case đơn giản (placeOrder, cancelOrder) ẩn đi sự điều phối repository và downstream service. REST controller nên gọi facade, không phải nhiều repository trực tiếp.

## Câu Hỏi Phỏng Vấn

1. Sự khác biệt giữa Facade và Adapter?
1. Facade có ngăn truy cập trực tiếp vào subsystem không?
1. Đặt tên một Facade trong Spring Framework.
