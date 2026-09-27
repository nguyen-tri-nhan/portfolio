---
key: "Spring Boot 4 Migration"
title: "Nâng Cấp Spring Boot 3 → 4"
crumb: "7. Spring Ecosystem › Spring Boot"
---

Spring Boot 4.0 (phát hành 11/2025) dựa trên **Spring Framework 7** và **Jakarta EE 11**. Không có cú sốc lớn như 2 → 3 (đổi `javax.*` → `jakarta.*`), nhưng có nhiều thay đổi làm build hoặc test hỏng: code được chia thành module nhỏ, đổi tên starter, Jackson 3, bỏ `@MockBean`, và các annotation test đổi package. Mọi điểm dưới đây lấy từ *Spring Boot 4.0 Migration Guide* chính thức.

## Điểm Chính

- **Chuẩn bị**: nâng lên **bản 3.5.x mới nhất** trước, xử lý hết cảnh báo deprecation, rồi mới lên 4.0.
- **Baseline**:
  - Java 17+ (vẫn giữ mức tối thiểu như Boot 3).
  - Kotlin 2.2+.
  - GraalVM 25+ nếu build native image.
  - Jakarta EE 11 / Servlet 6.1.
- **Code được chia module**: auto-configuration tách theo từng công nghệ, mỗi công nghệ có starter riêng.
  - Nếu chưa muốn đổi dependency ngay: dùng tạm `spring-boot-starter-classic` (và `spring-boot-starter-test-classic`).
- **Đổi tên starter**:
  - `spring-boot-starter-web` → `spring-boot-starter-webmvc`
  - `spring-boot-starter-web-services` → `spring-boot-starter-webservices`
  - Các starter OAuth thêm tiền tố `security-`.
  - Mỗi công nghệ có starter test riêng (ví dụ `spring-boot-starter-security-test`).
- **Flyway / Liquibase**: phải dùng `spring-boot-starter-flyway` / `spring-boot-starter-liquibase`. Chỉ thêm `flyway-core` như trước thì migration **không chạy**.
- **Jackson 3**:
  - Group ID và package đổi từ `com.fasterxml.jackson` sang `tools.jackson`; riêng `jackson-annotations` (`@JsonProperty`, `@JsonIgnore`...) **giữ nguyên** package cũ.
  - `ObjectMapper` bất biến — cấu hình qua `JsonMapper.builder()`.
  - Exception thành unchecked: `JsonProcessingException` → `JacksonException`.
  - Phía Boot: `Jackson2ObjectMapperBuilderCustomizer` → `JsonMapperBuilderCustomizer`, `@JsonComponent` → `@JacksonComponent`; property chuyển vào `spring.jackson.json.read.*` / `spring.jackson.json.write.*`.
  - Module `spring-boot-jackson2` (đã deprecated) hỗ trợ giai đoạn chuyển tiếp.
- **Test**:
  - `@MockBean` / `@SpyBean` (deprecated từ 3.4.0) **bị xóa** → dùng `@MockitoBean` / `@MockitoSpyBean` của Spring Framework. Chỉ dùng được trên field của test class, không dùng trong class `@Configuration`.
  - Migration Guide: *"Using the `@SpringBootTest` annotation will no longer provide any MockMVC support"* → khai báo `@AutoConfigureMockMvc`, nay nằm ở package `org.springframework.boot.webmvc.test.autoconfigure` (module `spring-boot-webmvc-test`).
  - `TestRestTemplate` cũng không còn tự có → `@AutoConfigureTestRestTemplate` + dependency `spring-boot-resttestclient`, hoặc chuyển sang `RestTestClient` (`@AutoConfigureRestTestClient`).
- **Bị gỡ bỏ**:
  - Undertow — không tương thích Servlet 6.1; còn Tomcat và Jetty.
  - Embedded launch script (jar "fully executable").
  - Tích hợp Spock (Spock chưa hỗ trợ Groovy 5).
- **JSpecify**: Boot 4 dùng annotation nullability của JSpecify; code Kotlin hoặc code dùng công cụ kiểm tra null có thể gặp lỗi compile mới.
- **Property đổi tên**: thêm tạm `spring-boot-properties-migrator` (runtime) để nó in ra property nào đã đổi và tự ánh xạ tạm thời; xóa sau khi sửa xong.

## Ví Dụ Code

*Maven: dependency trước và sau*

```xml
<!-- Spring Boot 3.x -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>

<!-- Spring Boot 4.0 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webmvc</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-flyway</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>

<!-- Tạm thời trong lúc nâng cấp: tự in cảnh báo và ánh xạ property cũ -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-properties-migrator</artifactId>
    <scope>runtime</scope>
</dependency>
```

*Test: @MockBean → @MockitoBean, @AutoConfigureMockMvc đổi package*

```java
// Spring Boot 3.x
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;

@SpringBootTest
@AutoConfigureMockMvc
class OrderApiTest {
    @Autowired MockMvc mockMvc;
    @MockBean PaymentGateway gateway;
}

// Spring Boot 4.0
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;   // module spring-boot-webmvc-test
import org.springframework.test.context.bean.override.mockito.MockitoBean;         // của Spring Framework

@SpringBootTest
@AutoConfigureMockMvc              // bắt buộc để có MockMvc (và MockMvcTester nếu có AssertJ)
class OrderApiTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean PaymentGateway gateway;   // chỉ trên field của test class
}
```

*Jackson 3*

```java
// Jackson 2 (Boot 3)
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;

ObjectMapper mapper = new ObjectMapper();
mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);   // setter trên mapper
try {
    Order o = mapper.readValue(json, Order.class);
} catch (JsonProcessingException e) { ... }                                    // checked

// Jackson 3 (Boot 4)
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.core.JacksonException;
import com.fasterxml.jackson.annotation.JsonProperty;   // annotations: package KHÔNG đổi

JsonMapper mapper = JsonMapper.builder()
        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        .build();                                         // bất biến sau khi build
Order o = mapper.readValue(json, Order.class);           // JacksonException là unchecked

// Tùy biến mapper của Spring Boot
@Bean
JsonMapperBuilderCustomizer jsonCustomizer() {            // Boot 3: Jackson2ObjectMapperBuilderCustomizer
    return builder -> builder.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
}
```

*Tự động hóa phần lặp lại bằng OpenRewrite*

```bash
# Recipe org.openrewrite.java.spring.boot4.UpgradeSpringBoot_4_0 (artifact rewrite-spring).
# Lưu ý: docs.openrewrite.org ghi recipe này theo "Moderne Source Available License" —
# kiểm tra điều kiện license trước khi dùng trong công ty.
./mvnw -U org.openrewrite.maven:rewrite-maven-plugin:run \
  -Drewrite.recipeArtifactCoordinates=org.openrewrite.recipe:rewrite-spring:RELEASE \
  -Drewrite.activeRecipes=org.openrewrite.java.spring.boot4.UpgradeSpringBoot_4_0
```

## Ứng Dụng Thực Tế

**Thứ tự nâng cấp an toàn**:
1. Lên 3.5.x mới nhất; build sạch cảnh báo deprecation (`-Xlint:deprecation`).
2. Nâng thư viện bên thứ ba lên bản hỗ trợ Spring Framework 7 / Jakarta EE 11 (Hibernate, Springdoc, MapStruct, Testcontainers...).
3. Đổi version Boot; nếu lỗi quá nhiều, tạm dùng `spring-boot-starter-classic` để app chạy trước.
4. Sửa import/starter theo module mới.
5. Chuyển test: `@MockitoBean`, `@AutoConfigureMockMvc`, `TestRestTemplate`.
6. Chuyển Jackson 3 (hoặc tạm dùng `spring-boot-jackson2`).
7. Thêm `spring-boot-properties-migrator`, chạy app, sửa property theo log, rồi gỡ nó ra.
8. Chạy toàn bộ integration test và kiểm tra JSON response (định dạng ngày giờ, null, thứ tự field) so với client hiện có.

**Rủi ro dễ bỏ sót**:
- Migration Flyway âm thầm không chạy vì thiếu starter → app khởi động với schema cũ; nếu `ddl-auto=validate` thì fail sớm, còn không thì lỗi lúc runtime.
- Khác biệt serialize của Jackson 3 làm đổi JSON trả về mà test đơn vị không bắt được — nên có contract test.
- Deploy bằng jar "fully executable" làm service init script (`/etc/init.d`) → phải chuyển sang systemd gọi `java -jar`.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Những thay đổi chính khi nâng cấp từ Spring Boot 3 lên 4 là gì?</strong></summary>

**A:** Nền tảng: Spring Framework 7, Jakarta EE 11 (Servlet 6.1), Java 17+, Kotlin 2.2+. Cấu trúc: auto-configuration chia nhỏ theo module, starter đổi tên (`starter-web` → `starter-webmvc`), Flyway/Liquibase cần starter riêng. Jackson 3 với package `tools.jackson`, mapper bất biến, exception unchecked. Test: bỏ `@MockBean`/`@SpyBean` (dùng `@MockitoBean`/`@MockitoSpyBean`), `@SpringBootTest` không tự cấu hình `MockMvc`/`TestRestTemplate`, annotation test đổi package theo module. Gỡ Undertow, embedded launch script, tích hợp Spock. Thêm annotation nullability JSpecify. Lộ trình: lên 3.5.x mới nhất trước, dùng properties migrator và starter classic để chuyển từng bước.

</details>

<details>
<summary><strong>@MockBean và @MockitoBean khác nhau thế nào?</strong></summary>

**A:** `@MockBean` là tính năng của Spring Boot (package `org.springframework.boot.test.mock.mockito`), deprecated từ 3.4.0 và bị xóa ở 4.0. `@MockitoBean` là cơ chế *bean override* của Spring Framework 6.2+ (package `org.springframework.test.context.bean.override.mockito`) — hoạt động với mọi test dùng Spring TestContext chứ không riêng Boot. Cách dùng tương tự: thay bean trong context bằng mock Mockito. Khác biệt cần chú ý: `@MockitoBean` khai báo trên field của test class, không đặt được trong class `@Configuration` như `@MockBean` từng cho phép. Mỗi tổ hợp mock khác nhau vẫn tạo ra một context riêng, nên dùng nhất quán để tận dụng context cache.

</details>

<details>
<summary><strong>Tại sao migration Flyway có thể ngừng chạy sau khi nâng cấp lên Boot 4?</strong></summary>

**A:** Ở Boot 3, chỉ cần `flyway-core` trên classpath là auto-configuration kích hoạt. Boot 4 chia auto-configuration thành module; auto-configuration của Flyway nằm trong module mà `spring-boot-starter-flyway` kéo vào. Chỉ có `flyway-core` thì không có module đó → không có bean Flyway → migration không chạy và không báo lỗi. Cách phòng: dùng starter, để `spring.jpa.hibernate.ddl-auto=validate` để app fail ngay khi schema lệch, và có integration test với database thật (Testcontainers).

</details>

<details>
<summary><strong>Có thể nâng cấp Boot 4 mà chưa chuyển sang Jackson 3 không?</strong></summary>

**A:** Có, trong giai đoạn chuyển tiếp. Boot 4 mặc định dùng Jackson 3, nhưng cung cấp module `spring-boot-jackson2` (đã deprecated) để tiếp tục dùng Jackson 2. Đây là biện pháp tạm; nên lên kế hoạch chuyển hẳn vì module này sẽ bị bỏ. Khi chuyển: đổi import `com.fasterxml.jackson.databind/core` → `tools.jackson...` (annotation giữ nguyên), thay cấu hình setter bằng `JsonMapper.builder()`, bỏ `catch` cho `JsonProcessingException` cũ, đổi customizer và property `spring.jackson.*`, rồi kiểm tra JSON đầu ra với contract test.

</details>
