---
key: "Spring Core"
title: "Spring Core"
crumb: "3. Spring Ecosystem"
---

Spring Core cung cấp IoC container quản lý vòng đời bean và dependency injection, tách rời các component và cho phép testability trên toàn bộ framework.

## Điểm Chính

- IoC (Inversion of Control): object khai báo dependency; container tạo và wiring chúng.
- ApplicationContext là container trung tâm; tải cấu hình và quản lý bean.
- Cấu hình bean: <code>@Component</code>/<code>@Service</code>/<code>@Repository</code> + component scan, hoặc method <code>@Bean</code> trong <code>@Configuration</code>.
- Vòng đời bean: khởi tạo → populate properties → <code>@PostConstruct</code> → sử dụng → <code>@PreDestroy</code>.

## Ví Dụ Code

*@Configuration + @Bean factory methods + constructor injection — full wiring example*

```java
import org.springframework.context.annotation.*;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import com.zaxxer.hikari.HikariDataSource;

// ---- @Configuration: Java-based container configuration ----
@Configuration
@EnableConfigurationProperties(OrderServiceProperties.class)
public class AppConfig {

    // @Bean method: Spring calls this, manages the returned object as a bean
    // Dependencies (DataSourceProperties) are injected via method parameters
    @Bean
    public HikariDataSource dataSource(OrderServiceProperties props) {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(props.getDatasourceUrl());
        ds.setUsername(props.getDatasourceUsername());
        ds.setPassword(props.getDatasourcePassword());
        ds.setMaximumPoolSize(10);       // connection pool — tune per workload
        ds.setConnectionTimeout(3000);   // fail fast: 3s timeout
        return ds;
    }

    @Bean
    public OrderRepository orderRepository(HikariDataSource dataSource) {
        // Spring resolves dataSource bean and injects here automatically
        return new JdbcOrderRepository(dataSource);
    }

    @Bean
    public PaymentGateway paymentGateway() {
        // Third-party client — registered as Spring bean for testability
        return new StripePaymentGateway(System.getenv("STRIPE_API_KEY"));
    }
}

// ---- @Service: business logic component, managed by IoC container ----
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentGateway  paymentGateway;

    // Constructor injection — dependencies explicit, immutable, testable without Spring
    public OrderService(OrderRepository orderRepository, PaymentGateway paymentGateway) {
        this.orderRepository = Objects.requireNonNull(orderRepository);
        this.paymentGateway  = Objects.requireNonNull(paymentGateway);
    }

    public Order placeOrder(CreateOrderRequest request) {
        Order order = Order.create(request.getUserId(), request.getItems());
        orderRepository.save(order);
        paymentGateway.charge(order.getPaymentMethod(), order.totalAmount());
        return order;
    }
}

// Unit test — NO Spring context needed, just inject mocks via constructor:
// new OrderService(mockOrderRepo, mockPaymentGateway)
```

## Ứng Dụng Thực Tế

Luôn ưu tiên constructor injection thay vì field injection (<code>@Autowired</code> trên field). Constructor injection làm dependency rõ ràng, cho phép immutability và đơn giản hóa unit test mà không cần Spring context.

## Câu Hỏi Phỏng Vấn

1. Inversion of Control là gì và Spring implement nó thế nào?
1. Sự khác biệt giữa BeanFactory và ApplicationContext là gì?
1. Spring Boot auto-configuration khác manual @Configuration thế nào?
