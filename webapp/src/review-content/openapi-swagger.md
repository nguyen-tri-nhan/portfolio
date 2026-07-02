---
key: openapi-swagger
title: OpenAPI & Swagger
crumb: 18. API & Communication > REST & HTTP
---

OpenAPI Specification là contract chuẩn hóa cho REST API, cho phép generate documentation, mock server, và client SDK tự động — giảm mismatch giữa spec và implementation.

## Điểm Chính

- **OpenAPI 3.x structure**: `info` (metadata), `servers` (base URLs), `paths` (endpoints), `components` (reusable schemas, responses, parameters, securitySchemes).
- **Contract-first**: design spec trước → generate server stubs và client SDKs → implement business logic; đảm bảo API contract được đồng ý trước khi code.
- **Code-first**: annotate code với Spring annotations → generate spec tự động; nhanh hơn nhưng spec có thể drift nếu annotation không đầy đủ.
- **Key Spring annotations**: `@Operation` (endpoint description), `@ApiResponse` (response codes), `@Schema` (model documentation), `@Parameter` (query/path params), `@SecurityRequirement` (auth scheme).
- **Tools ecosystem**: Swagger UI (interactive docs), ReDoc (read-only, cleaner UI), OpenAPI Generator (codegen cho 50+ languages), Spectral (spec linting/validation).
- **Spec-driven benefits**: mock server từ spec cho frontend/client phát triển song song, contract testing, SDK generation cho partner integration.
- **Validation**: validate actual request/response against spec ở test time để phát hiện drift sớm; `openapi-diff` tool detect breaking changes giữa spec versions.

## Ví Dụ Code

*Complete OpenAPI 3.0 YAML cho User API với schemas và error responses*

```yaml
# ✅ openapi.yaml — contract-first spec cho User API
openapi: "3.0.3"
info:
  title: User API
  version: "1.0.0"
  description: API for managing user accounts

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging

paths:
  /users/{id}:
    get:
      operationId: getUserById
      summary: Get a user by ID
      tags: [Users]
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
            format: int64
            minimum: 1
      responses:
        "200":
          description: User found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

  /users:
    post:
      operationId: createUser
      summary: Create a new user
      tags: [Users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateUserRequest"
            example:
              name: "Nguyen Van A"
              email: "nguyenvana@example.com"
      responses:
        "201":
          description: User created
          headers:
            Location:
              description: URL of the created resource
              schema:
                type: string
                format: uri
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserResponse"
        "400":
          $ref: "#/components/responses/BadRequest"
        "409":
          description: Email already exists
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"

components:
  schemas:
    UserResponse:
      type: object
      required: [id, name, email, createdAt]
      properties:
        id:
          type: integer
          format: int64
          example: 42
        name:
          type: string
          maxLength: 100
          example: "Nguyen Van A"
        email:
          type: string
          format: email
          example: "nguyenvana@example.com"
        createdAt:
          type: string
          format: date-time

    CreateUserRequest:
      type: object
      required: [name, email]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email

    ErrorResponse:
      type: object
      required: [errorCode, message, traceId]
      properties:
        errorCode:
          type: string
          example: "USER_NOT_FOUND"
        message:
          type: string
        details:
          type: array
          items:
            type: object
            properties:
              field: { type: string }
              message: { type: string }
        traceId:
          type: string
          format: uuid

  responses:
    Unauthorized:
      description: Missing or invalid authentication token
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
    BadRequest:
      description: Validation failed
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

## Ứng Dụng Thực Tế

Trong team lớn, contract-first development cho phép frontend và backend làm song song: frontend dùng mock server generate từ spec, backend implement theo spec — hai team không block nhau. OpenAPI Generator tạo type-safe client SDK cho partner integration, giảm lỗi tích hợp và thời gian onboarding.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Contract-first vs code-first — trade-offs và khi nào chọn mỗi approach?</strong></summary>

**A:** Contract-first (spec → code): API contract được đồng ý trước khi implementation bắt đầu — frontend, mobile, và backend team có thể làm song song dựa trên spec. Spec là authoritative source of truth, ít nguy cơ drift. Phù hợp cho public API, partner integration, hoặc team lớn cần coordination sớm. Nhược điểm: cần thêm bước viết YAML/JSON spec trước, và spec language (OpenAPI) có learning curve. Code-first (code → spec): nhanh hơn cho prototype và internal API; Spring annotations tự generate spec. Nguy cơ: annotation có thể thiếu, spec không phản ánh đúng behavior thực tế, và spec trở thành afterthought. Khuyến nghị thực tế: dùng contract-first cho external/public API và public-facing microservice boundaries; code-first cho internal API với strict annotation review và spec validation trong CI pipeline.

</details>

<details>
<summary><strong>Làm thế nào đảm bảo API spec không bị out-of-sync với implementation?</strong></summary>

**A:** Có ba lớp bảo vệ: (1) CI validation — dùng `openapi-diff` so sánh spec của PR với main branch, fail build nếu có breaking change không được version; Spectral lint spec để enforce naming conventions và best practices. (2) Contract testing — `spring-cloud-contract` hoặc `dredd` test actual API responses against spec; chạy trong CI để catch implementation drift ngay khi merge. (3) Code generation — thay vì manually annotate, generate controller interfaces từ spec (`openapi-generator-maven-plugin`); implement generated interface, nếu spec thay đổi thì code không compile → drift impossible. Ngoài ra, review spec change như review code change — spec YAML vào version control, PR review bắt buộc cho API contract changes. Approach toàn diện nhất là (3) vì compiler enforce contract, không phải chỉ test.

</details>

<details>
<summary><strong>OpenAPI Generator dùng thế nào để generate client SDK và có những lưu ý gì?</strong></summary>

**A:** OpenAPI Generator nhận `openapi.yaml` và generate code cho 50+ ngôn ngữ/framework: `openapi-generator-cli generate -i openapi.yaml -g java -o ./sdk --additional-properties=groupId=com.example`. Trong Maven plugin: `openapi-generator-maven-plugin` trong `pom.xml` → tự generate trước `compile` phase. Lưu ý quan trọng: (1) Generated code không nên edit tay — regenerate khi spec thay đổi; (2) Customize qua `--additional-properties` (package name, date library, nullable handling) hoặc Mustache templates; (3) Test generated SDK bằng contract tests — generator có thể có bugs với edge cases; (4) Versioning: khi break API, tạo spec v2, generate SDK v2 riêng và publish song song với v1; (5) Cho server-side generation (`-g spring`), generated code thường cần review — business logic không được generate, chỉ interface/model boilerplate.

</details>
