---
key: "Auto Configuration"
title: "Auto Configuration"
crumb: "3. Spring Ecosystem › Spring Boot"
---

Auto-configuration kiểm tra classpath, bean hiện có và properties để tự động đăng ký bean default hợp lý — giảm đáng kể cấu hình thủ công.

## Điểm Chính

- Dựa trên annotation <code>@ConditionalOnClass</code>, <code>@ConditionalOnMissingBean</code>, <code>@ConditionalOnProperty</code>.
- Đăng ký qua <code>META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports</code> (Boot 3) hoặc <code>spring.factories</code> (Boot 2).
- Auto-config class được xử lý sau user-defined bean — bean của bạn được ưu tiên.
- Kiểm tra: chạy với <code>--debug</code> hoặc xem <code>/actuator/conditions</code>.
- Loại trừ: <code>@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)</code>.

## Ví Dụ Code

*Auto-config internals: @ConditionalOnClass/MissingBean/Property + custom auto-config + override + exclusion + debug*

```java
import org.springframework.boot.autoconfigure.*;
import org.springframework.boot.autoconfigure.condition.*;
import org.springframework.boot.context.properties.*;
import org.springframework.context.annotation.*;

// ---- How Spring Boot auto-configuration works internally ----
// Spring Boot reads META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
// Each class listed there is a candidate auto-configuration

@AutoConfiguration                                      // marks this as auto-config (processed after user beans)
@ConditionalOnClass(DataSource.class)                  // only if HikariCP / JDBC driver on classpath
@ConditionalOnMissingBean(DataSource.class)            // only if YOU have NOT defined your own DataSource bean
@EnableConfigurationProperties(DataSourceProperties.class)
public class DataSourceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public DataSource dataSource(DataSourceProperties props) {
        // Builds HikariDataSource from spring.datasource.* properties automatically
        return props.initializeDataSourceBuilder().build();
    }
}

// ---- Writing your own auto-configuration ----
// (e.g., for an internal library used across microservices)
@AutoConfiguration
@ConditionalOnClass(OrderAuditClient.class)             // library JAR must be on classpath
@ConditionalOnProperty(
    prefix = "order.audit",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = false                              // disabled by default; opt-in
)
@EnableConfigurationProperties(OrderAuditProperties.class)
public class OrderAuditAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(OrderAuditClient.class)  // user can override by defining own bean
    public OrderAuditClient orderAuditClient(OrderAuditProperties props) {
        return new OrderAuditClient(
            props.getEndpoint(),
            props.getApiKey(),
            Duration.ofSeconds(props.getTimeoutSeconds())
        );
    }
}

// ---- Overriding auto-configuration with your own bean ----
@Configuration
public class CustomDataSourceConfig {
    // Your @Bean takes precedence — auto-config's @ConditionalOnMissingBean skips its bean
    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:postgresql://prod-db:5432/orders");
        ds.setMaximumPoolSize(20);    // custom pool size — overrides auto-config default
        ds.setLeakDetectionThreshold(5000);
        return ds;
    }
}

// ---- Excluding auto-configuration you don't need ----
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class,    // no DB — maybe this is a message consumer only
    SecurityAutoConfiguration.class       // custom security setup, not the default
})
public class OrderConsumerApp {
    public static void main(String[] args) { SpringApplication.run(OrderConsumerApp.class, args); }
}

// ---- Debugging auto-config decisions ----
// Run with: java -jar app.jar --debug
// Or: GET /actuator/conditions  (shows which auto-configs matched and why)
// Output example:
//   DataSourceAutoConfiguration MATCHED:
//     - @ConditionalOnClass DataSource found
//     - @ConditionalOnMissingBean DataSource not found — registering default
```

## Ứng Dụng Thực Tế

Khi debug "tại sao Bean X không được tạo?", hãy xem condition. Dùng <code>@ConditionalOnProperty</code> trong auto-configuration của bạn để feature có thể bật/tắt qua properties.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Spring Boot auto-configuration hoạt động thế nào?</strong></summary>

**A:** Spring Boot scan `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (Spring Boot 3) hoặc `spring.factories` (Boot 2) trong mỗi jar — liệt kê các AutoConfiguration class. Mỗi AutoConfiguration dùng `@Conditional` annotations để quyết định có activate không: `@ConditionalOnClass` (class có trong classpath?), `@ConditionalOnMissingBean` (bean chưa tồn tại?), `@ConditionalOnProperty` (property có set?). Ví dụ: `DataSourceAutoConfiguration` chỉ active khi H2/MySQL driver trong classpath và DataSource bean chưa có.

</details>

<details>
<summary><strong>Disable một auto-configuration cụ thể thế nào?</strong></summary>

**A:** (1) Annotation: `@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})`. (2) Property: `spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration`. (3) Override bean: tạo `@Bean DataSource` của riêng mình — `@ConditionalOnMissingBean` trên auto-config sẽ skip. Cách 3 là idiomatic nhất — bạn cần DataSource nhưng muốn customize, không phải disable hoàn toàn. Debug auto-configuration: thêm `--debug` flag, Spring Boot print "CONDITIONS EVALUATION REPORT".

</details>
