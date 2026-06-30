---
key: "Spring MVC"
title: "Spring MVC"
crumb: "3. Spring Ecosystem"
---

Spring MVC là web framework implement pattern Model-View-Controller, nơi DispatcherServlet định tuyến HTTP request qua handler mapping đến controller và render response.

## Điểm Chính

- <code>DispatcherServlet</code> là front controller; nhận tất cả request.
- Handler mapping: tìm method <code>@Controller</code> đúng dựa trên URL + HTTP method.
- Handler adapter: gọi controller, giải quyết method argument (<code>@PathVariable</code>, <code>@RequestBody</code>).
- View resolution: giải quyết tên view logic thành template (Thymeleaf, JSP) hoặc trả về body trực tiếp (<code>@RestController</code>).
- Filter chain: xử lý trước DispatcherServlet (security, CORS, logging).
- Interceptor: xử lý xung quanh handler execution (pre/post/afterCompletion).

## Ví Dụ Code

*@RestController: GET/POST/PATCH/DELETE với ResponseEntity, pagination, @Valid Bean Validation, Location header*

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import jakarta.validation.Valid;
import java.net.URI;

// ---- @RestController: combines @Controller + @ResponseBody ----
// Every method returns data serialized to JSON (via Jackson), not a view name
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orderService;

    // Constructor injection — no @Autowired needed in Spring Boot
    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    // GET /api/v1/orders/{id}
    // ResponseEntity gives full control over status code + headers + body
    @GetMapping("/{id}")
    public ResponseEntity<OrderDto> getOrder(@PathVariable Long id) {
        return orderService.findById(id)
            .map(order -> ResponseEntity.ok(OrderDto.from(order)))     // 200 OK with body
            .orElse(ResponseEntity.notFound().build());                  // 404 No Body
    }

    // GET /api/v1/orders?status=PENDING&page=0&size=20
    @GetMapping
    public ResponseEntity<Page<OrderDto>> listOrders(
            @RequestParam(defaultValue = "PENDING") String status,
            @RequestParam(defaultValue = "0")       int page,
            @RequestParam(defaultValue = "20")      int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<OrderDto> orders = orderService.findByStatus(status, pageable)
                                            .map(OrderDto::from);
        return ResponseEntity.ok(orders);
    }

    // POST /api/v1/orders
    // @Valid triggers Bean Validation on the request body
    // @RequestBody deserializes JSON → CreateOrderRequest via Jackson
    @PostMapping
    public ResponseEntity<OrderDto> createOrder(@RequestBody @Valid CreateOrderRequest request) {
        Order order = orderService.placeOrder(request);
        // 201 Created with Location header pointing to the new resource
        URI location = URI.create("/api/v1/orders/" + order.getId());
        return ResponseEntity.created(location).body(OrderDto.from(order));
    }

    // PATCH /api/v1/orders/{id}/cancel
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<OrderDto> cancelOrder(@PathVariable Long id,
                                                 @RequestBody @Valid CancelOrderRequest request) {
        Order cancelled = orderService.cancelOrder(id, request.getReason());
        return ResponseEntity.ok(OrderDto.from(cancelled));
    }

    // DELETE /api/v1/orders/{id}
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)    // 204 — fixed status, no ResponseEntity needed
    public void deleteOrder(@PathVariable Long id) {
        orderService.delete(id);
    }
}

// ---- DTO with Bean Validation annotations ----
public record CreateOrderRequest(
    @NotBlank                    String userId,
    @NotEmpty @Size(max = 50)    List<@Valid OrderItemRequest> items,
    @NotNull                     PaymentMethodDto paymentMethod
) {}

public record OrderItemRequest(
    @NotBlank  String productId,
    @Min(1)    int    quantity
) {}
```

## Ứng Dụng Thực Tế

Dùng <code>ResponseEntity</code> khi cần kiểm soát header hoặc status code động. Dùng <code>@ResponseStatus</code> cho status code cố định. Luôn validate request body với <code>@Valid</code> và xử lý <code>MethodArgumentNotValidException</code> trong <code>@ControllerAdvice</code>.

## Câu Hỏi Phỏng Vấn

1. Giải thích vòng đời xử lý request Spring MVC.
1. Sự khác biệt giữa @Controller và @RestController là gì?
1. Spring MVC giải quyết method argument như @RequestBody thế nào?
