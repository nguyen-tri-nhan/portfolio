---
key: "Spring Boot"
title: "Spring Boot"
crumb: "3. Spring Ecosystem"
---

Spring Boot loại bỏ boilerplate bằng cách cung cấp auto-configuration theo quan điểm, embedded server và starter dependency — cho phép chạy app production-ready từ method main() thông thường.

## Điểm Chính

- <code>@SpringBootApplication</code> = <code>@Configuration</code> + <code>@EnableAutoConfiguration</code> + <code>@ComponentScan</code>.
- Auto-configuration: Spring Boot phát hiện dependency classpath và cấu hình bean tự động.
- Starter POM: <code>spring-boot-starter-web</code>, <code>spring-boot-starter-data-jpa</code>, v.v. — tập dependency được tuyển chọn.
- Embedded server: Tomcat/Netty được đóng gói trong JAR; không cần deploy WAR.
- <code>application.properties</code> / <code>application.yml</code>: externalize configuration.

## Ví Dụ Code

*Spring Boot: @SpringBootApplication, starter POMs, application.yml best practices, @ConfigurationProperties*

```java
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.*;
import org.springframework.boot.context.properties.*;
import org.springframework.context.annotation.*;

// ---- @SpringBootApplication: the entry point of every Spring Boot app ----
// Expands to: @Configuration + @EnableAutoConfiguration + @ComponentScan
@SpringBootApplication
public class OrderServiceApp {

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(OrderServiceApp.class);

        // Customize startup (optional)
        app.setBannerMode(Banner.Mode.OFF);           // suppress Spring banner
        app.setDefaultProperties(Map.of(
            "server.port", "8080",                    // fallback if not in properties file
            "spring.profiles.default", "dev"
        ));

        ConfigurableApplicationContext ctx = app.run(args);

        // App is now running; all beans wired, server accepting requests
        System.out.println("OrderService started on port " +
            ctx.getEnvironment().getProperty("server.port"));
    }
}

// ---- Starter POM brings in all required dependencies ----
// pom.xml (auto-configures what's on classpath):
//   spring-boot-starter-web        → Tomcat + Spring MVC + Jackson
//   spring-boot-starter-data-jpa   → Hibernate + DataSource + TransactionManager
//   spring-boot-starter-security   → Spring Security filter chain
//   spring-boot-starter-actuator   → /actuator/health, /actuator/metrics

// ---- application.yml: externalize ALL environment-specific config ----
// (No hardcoded values in code — follows 12-factor app principles)
/*
server:
  port: ${PORT:8080}               # PORT env var or default 8080
  shutdown: graceful                 # drain requests before shutdown

spring:
  datasource:
    url: ${DATABASE_URL}            # mandatory — must be set in environment
    username: ${DB_USER}
    password: ${DB_PASS}
    hikari:
      maximum-pool-size: 10
      connection-timeout: 3000

  jpa:
    hibernate:
      ddl-auto: validate            # prod: validate schema, never auto-create
    show-sql: false                 # prod: false (performance)
    open-in-view: false             # best practice: disable for REST APIs

logging:
  level:
    com.example.order: INFO
    org.springframework.security: WARN
*/

// ---- @ConfigurationProperties: bind YAML to a typed config class ----
@ConfigurationProperties(prefix = "order")
@Component
public class OrderServiceProperties {
    private int maxItemsPerOrder = 50;            // default value
    private Duration paymentTimeout = Duration.ofSeconds(30);
    private String defaultCurrency = "USD";

    // getters + setters (or Lombok @Data)
    public int getMaxItemsPerOrder()          { return maxItemsPerOrder; }
    public Duration getPaymentTimeout()       { return paymentTimeout; }
    public String getDefaultCurrency()        { return defaultCurrency; }
    public void setMaxItemsPerOrder(int v)    { this.maxItemsPerOrder = v; }
    public void setPaymentTimeout(Duration d) { this.paymentTimeout = d; }
    public void setDefaultCurrency(String c)  { this.defaultCurrency = c; }
}
// application.yml:
// order.max-items-per-order: 100
// order.payment-timeout: 45s
// order.default-currency: EUR
```

## Ứng Dụng Thực Tế

Hiểu auto-configuration đang đăng ký gì. Dùng flag <code>--debug</code> hoặc <code>ConditionEvaluationReport</code> để xem auto-config nào được áp dụng và tại sao. Override các phần cụ thể bằng định nghĩa <code>@Bean</code> của bạn trong <code>@Configuration</code> class.

## Câu Hỏi Phỏng Vấn

1. @SpringBootApplication làm gì?
1. Spring Boot auto-configuration hoạt động nội bộ thế nào?
1. Làm thế nào để loại trừ một class auto-configuration cụ thể?
