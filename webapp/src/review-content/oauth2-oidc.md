---
key: "oauth2-oidc"
title: "OAuth2 & OIDC"
crumb: "20. Security › Auth & Identity"
---

OAuth2 là authorization framework cho phép ứng dụng thứ ba truy cập tài nguyên người dùng có giới hạn mà không cần chia sẻ mật khẩu; OIDC bổ sung lớp identity lên trên OAuth2 để xác thực người dùng.

## Điểm Chính

- **OAuth2** giải quyết bài toán ủy quyền (authorization), không phải xác thực — 4 roles: Resource Owner (user), Client (app), Authorization Server (cấp token), Resource Server (API).
- **4 grant types**: Authorization Code (web app, bảo mật nhất), Client Credentials (machine-to-machine), Device Code (TV/CLI không có browser), Implicit (deprecated — không dùng).
- **PKCE** (Proof Key for Code Exchange): Public client (SPA, mobile app) dùng `code_verifier` + `code_challenge` để ngăn authorization code bị intercepted giữa chừng.
- **OIDC** (OpenID Connect): chạy trên OAuth2, thêm **ID Token** (JWT chứa thông tin user) và `/userinfo` endpoint — dùng để authentication.
- **3 loại token**: Access Token (short-lived, gọi API), Refresh Token (long-lived, đổi access token mới), ID Token (OIDC, chứng minh đã xác thực).
- **Token storage**: Access Token lưu in-memory (SPA) tránh XSS; Refresh Token lưu trong `httpOnly` cookie tránh bị JavaScript đọc.
- **Discovery endpoint** `/.well-known/openid-configuration`: tự động quảng bá các endpoint (authorization, token, userinfo, JWKS) và capabilities của Authorization Server.
- Validate ID Token: kiểm tra `iss`, `aud`, `exp`, `nonce` — không tin ID Token từ untrusted source dù signature hợp lệ.

## Ví Dụ Code

*Spring Security OAuth2 Resource Server: cấu hình JWT validation, scope-based authorization, và PKCE flow cho public client*

```java
// ---- 1. Resource Server Configuration ----
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/api/admin/**").hasAuthority("SCOPE_admin")
                .requestMatchers(HttpMethod.GET, "/api/orders/**").hasAuthority("SCOPE_orders:read")
                .requestMatchers(HttpMethod.POST, "/api/orders/**").hasAuthority("SCOPE_orders:write")
                .anyRequest().authenticated()
            )
            // OAuth2 Resource Server: validate JWT từ Authorization Server
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter()))
            );
        return http.build();
    }

    // Convert JWT claims thành Spring Security Authorities
    @Bean
    public JwtAuthenticationConverter jwtAuthConverter() {
        JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();
        scopeConverter.setAuthorityPrefix("SCOPE_");         // prefix SCOPE_ cho scope claims
        scopeConverter.setAuthoritiesClaimName("scope");

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(scopeConverter);
        converter.setPrincipalClaimName("sub");              // dùng "sub" làm username
        return converter;
    }
}

// ---- 2. application.yml: trỏ tới Authorization Server ----
// spring:
//   security:
//     oauth2:
//       resourceserver:
//         jwt:
//           issuer-uri: https://auth.example.com        # tự động fetch JWKS từ /.well-known
//           audiences: api://my-service                 # validate "aud" claim

// ---- 3. Sử dụng JWT claims trong business logic ----
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_orders:read')")
    public ResponseEntity<OrderDto> getOrder(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {             // inject JWT trực tiếp

        String userId = jwt.getSubject();                   // "sub" claim
        String email  = jwt.getClaimAsString("email");      // custom claim từ OIDC
        List<String> roles = jwt.getClaimAsStringList("roles");

        log.info("User {} (email={}) fetching order {}", userId, email, id);
        return ResponseEntity.ok(orderService.getOrder(id, userId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('SCOPE_orders:write')")
    public ResponseEntity<OrderDto> createOrder(
            @RequestBody CreateOrderRequest req,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderService.createOrder(req, jwt.getSubject()));
    }
}

// ---- 4. PKCE: Authorization Code Flow (SPA/mobile) ----
// Client-side (JavaScript):
// 1. Tạo code_verifier (random 43-128 chars)
// 2. code_challenge = BASE64URL(SHA256(code_verifier))
// 3. Redirect: /authorize?response_type=code&client_id=...
//    &code_challenge=<challenge>&code_challenge_method=S256
// 4. Nhận authorization code → gửi kèm code_verifier để đổi token
// Authorization Server verify: SHA256(code_verifier) == code_challenge
// → Kẻ tấn công intercept code nhưng không có code_verifier → vô dụng
```

## Ứng Dụng Thực Tế

Trong hệ thống microservices, Authorization Server (ví dụ Keycloak, Auth0, Cognito) phát hành Access Token chứa scope và roles; mỗi service hoạt động như Resource Server tự validate JWT bằng JWKS public key mà không cần gọi lại Authorization Server. OIDC được dùng khi cần biết thông tin người dùng (email, tên) ở bước login — ví dụ Single Sign-On (SSO) across multiple applications.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>OAuth2 và OIDC khác nhau như thế nào? Khi nào dùng cái nào?</strong></summary>

**A:** OAuth2 là authorization framework — trả lời câu hỏi "app X có được phép làm Y với dữ liệu của tôi không?" — không nói user là ai. OIDC là identity layer chạy trên OAuth2 — bổ sung ID Token (JWT) chứa thông tin user (sub, email, name) để xác thực danh tính. Dùng OAuth2 đơn thuần khi chỉ cần delegated access (ví dụ: app đọc Google Calendar của user). Dùng OIDC khi cần authentication — biết user là ai, cho phép SSO.

</details>

<details>
<summary><strong>Tại sao Authorization Code + PKCE tốt hơn Implicit grant?</strong></summary>

**A:** Implicit grant trả Access Token trực tiếp trong URL fragment — bị lộ trong browser history, server logs, và Referrer header. Authorization Code flow trả về một code ngắn hạn, code này chỉ có giá trị khi đổi lấy token ở back-channel (server-to-server hoặc client-to-server). PKCE bổ sung `code_challenge` để ngăn kẻ tấn công dùng code bị intercepted — vì không có `code_verifier` thì không đổi được token. Implicit đã bị RFC 9700 deprecated năm 2025.

</details>

<details>
<summary><strong>Access Token nên lưu ở đâu để an toàn nhất trong SPA?</strong></summary>

**A:** Lưu Access Token trong memory (JavaScript variable hoặc React state) — không persist qua page refresh nhưng không bị XSS đọc từ `localStorage`. Refresh Token lưu trong `httpOnly; Secure; SameSite=Strict` cookie — JavaScript không thể đọc cookie này, chỉ browser tự động gửi kèm request. Tuyệt đối không lưu token trong `localStorage` hay `sessionStorage` vì mọi script XSS đều có thể đọc được.

</details>
