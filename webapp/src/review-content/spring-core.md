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

<details>
<summary><strong>IoC container là gì và tại sao quan trọng?</strong></summary>

**A:** **IoC (Inversion of Control) container** quản lý lifecycle và wiring của beans. Thay vì object tự tạo dependencies (`new ServiceB()`), container inject vào — "control" được invert từ object sang container. Lợi ích: (1) Loose coupling — code against interface, không concrete class. (2) Testability — inject mock dễ dàng. (3) Reusability — bean được share. (4) Lifecycle management — container handle initialization, destruction. Spring cung cấp `BeanFactory` (lazy) và `ApplicationContext` (eager, đầy đủ feature hơn). `@Autowired`, `@Inject`, constructor injection đều là cơ chế DI.

</details>

<details>
<summary><strong>Spring Bean lifecycle từ creation đến destruction là gì?</strong></summary>

**A:** (1) Instantiate — constructor. (2) Populate properties — `@Autowired` field injection. (3) BeanNameAware, BeanFactoryAware — nếu implement. (4) BeanPostProcessor.postProcessBeforeInitialization. (5) **`@PostConstruct`** / InitializingBean.afterPropertiesSet(). (6) Custom init-method. (7) BeanPostProcessor.postProcessAfterInitialization. (8) Bean ready — vào scope. (9) **`@PreDestroy`** / DisposableBean.destroy() — khi context close. Dùng `@PostConstruct` để init sau inject (không phải constructor — vì constructor chưa inject). `@PreDestroy` để cleanup (close connection, flush).

</details>

<details>
<summary><strong>ApplicationContext và BeanFactory khác nhau thế nào?</strong></summary>

**A:** `BeanFactory`: basic IoC container — lazy initialization, không có advanced features. `ApplicationContext`: extends BeanFactory, thêm: (1) Eager singleton initialization (fail-fast). (2) MessageSource (i18n). (3) ApplicationEventPublisher (event system). (4) ResourceLoader. (5) AOP integration. (6) Environment abstraction. Thực tế: luôn dùng `ApplicationContext`. Implementations: `ClassPathXmlApplicationContext`, `AnnotationConfigApplicationContext`, `SpringApplication` (Boot). `WebApplicationContext`: extends AC, thêm ServletContext — Spring MVC dùng.

</details>
