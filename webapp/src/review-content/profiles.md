---
key: "Profiles"
title: "Spring Profiles"
crumb: "3. Spring Ecosystem › Spring Boot"
---

Profile cho phép các bean và cấu hình khác nhau hoạt động trong các môi trường khác nhau (dev, staging, prod), được kiểm soát qua <code>spring.profiles.active</code>.

## Điểm Chính

- <code>@Profile("dev")</code> trên bean: chỉ đăng ký khi profile "dev" đang hoạt động.
- <code>application-dev.yml</code>: properties đặc thù profile được tải thêm vào base <code>application.yml</code>.
- Kích hoạt: env var <code>SPRING_PROFILES_ACTIVE=prod</code> hoặc JVM arg <code>-Dspring.profiles.active=prod</code>.
- Nhiều profile hoạt động cùng lúc: <code>spring.profiles.active=prod,featureX</code>.
- <code>@ActiveProfiles("test")</code> trong test class cho bean đặc thù test.

## Ví Dụ Code

*Profile YAML: base + dev (H2) + staging + prod — với externalized secrets và profile-specific pool/logging config*

```bash
# ---- application.yml: base config shared across ALL profiles ----
server:
  port: ${PORT:8080}
  shutdown: graceful

spring:
  application:
    name: order-service
  datasource:
    driver-class-name: org.postgresql.Driver
    hikari:
      connection-timeout: 3000
      maximum-pool-size: 10
  jpa:
    open-in-view: false           # best practice for REST APIs

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics

---
# ---- application-dev.yml: local development overrides ----
spring:
  config:
    activate:
      on-profile: dev
  datasource:
    url: jdbc:h2:mem:orderdb;DB_CLOSE_DELAY=-1   # H2 in-memory — no Postgres needed
    driver-class-name: org.h2.Driver
    username: sa
    password: ""
  h2:
    console:
      enabled: true              # access at /h2-console for DB inspection
  jpa:
    show-sql: true               # log SQL queries in dev
    hibernate:
      ddl-auto: create-drop      # recreate schema on each start

logging:
  level:
    com.example.order: DEBUG     # verbose logging in dev
    org.springframework.security: DEBUG

---
# ---- application-staging.yml: staging environment ----
spring:
  config:
    activate:
      on-profile: staging
  datasource:
    url: ${STAGING_DB_URL}       # from CI/CD environment secrets
    username: ${STAGING_DB_USER}
    password: ${STAGING_DB_PASS}
  jpa:
    hibernate:
      ddl-auto: validate

---
# ---- application-prod.yml: production environment ----
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: ${DATABASE_URL}         # from AWS Secrets Manager / K8s secret
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    hikari:
      maximum-pool-size: 30      # higher pool for prod load
      minimum-idle: 5
  jpa:
    show-sql: false              # NEVER log SQL in prod (performance + security)
    hibernate:
      ddl-auto: validate         # validate schema — never auto-modify prod DB

logging:
  level:
    root: WARN
    com.example.order: INFO      # only business-relevant logs
```

## Ứng Dụng Thực Tế

Dùng profile để: hoán đổi H2 in-memory sang Postgres prod trong dev, bật debug logging chỉ trong dev, trỏ đến RabbitMQ cluster khác nhau mỗi môi trường. Đừng bao giờ hardcode URL đặc thù môi trường trong base config.

## Câu Hỏi Phỏng Vấn

1. Làm thế nào để kích hoạt nhiều Spring profile?
1. Sự khác biệt giữa @Profile và @ConditionalOnProperty là gì?
1. File YAML đặc thù Spring profile được tải như thế nào?
