---
key: "Spring Security"
title: "Spring Security"
crumb: "3. Spring Ecosystem"
---

Spring Security cung cấp authentication (bạn là ai?) và authorization (bạn được làm gì?) qua filter chain chặn mọi HTTP request trước khi đến controller.

## Điểm Chính

- Security filter chain: chuỗi filter có thứ tự. Filter chính: <code>UsernamePasswordAuthenticationFilter</code>, <code>JwtAuthenticationFilter</code>.
- <code>SecurityContext</code>: giữ đối tượng <code>Authentication</code> đã xác thực mỗi thread (qua ThreadLocal).
- <code>UserDetailsService</code>: Spring gọi để tải user theo username trong quá trình login.
- Method security: <code>@PreAuthorize("hasRole('ADMIN')")</code> trên method.
- <code>PasswordEncoder</code>: luôn encode password với BCrypt, đừng bao giờ lưu plaintext.

## Ví Dụ Code

*SecurityConfig: STATELESS, JWT filter, URL rules, 401/403 JSON handlers, BCryptPasswordEncoder, UserDetailsService*

```java
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.*;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

// ---- Spring Security filter chain configuration for a stateless REST API ----
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)   // enables @PreAuthorize on service methods
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            // ---- Session management: STATELESS = no HTTP session, no JSESSIONID cookie ----
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // ---- CSRF: disabled for REST API (tokens replace cookie-based auth) ----
            .csrf(csrf -> csrf.disable())

            // ---- URL-based authorization rules ----
            .authorizeHttpRequests(auth -> auth
                // Public endpoints — no token required
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()

                // Admin-only endpoints
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")

                // Order endpoints require CUSTOMER or ADMIN role
                .requestMatchers(HttpMethod.POST, "/api/v1/orders").hasAnyRole("CUSTOMER", "ADMIN")
                .requestMatchers(HttpMethod.GET,  "/api/v1/orders/**").authenticated()

                // All other requests require authentication
                .anyRequest().authenticated()
            )

            // ---- Add JWT filter BEFORE Spring's built-in UsernamePasswordAuthenticationFilter ----
            // Our filter validates the Bearer token and populates SecurityContext
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)

            // ---- Custom 401/403 handlers for clean JSON error responses ----
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, e) -> {
                    // 401: request had no token or invalid token
                    response.setContentType("application/json");
                    response.setStatus(401);
                    response.getWriter().write("""
                        {"code":"UNAUTHORIZED","message":"Authentication required"}""");
                })
                .accessDeniedHandler((request, response, e) -> {
                    // 403: valid token but insufficient role
                    response.setContentType("application/json");
                    response.setStatus(403);
                    response.getWriter().write("""
                        {"code":"FORBIDDEN","message":"Insufficient permissions"}""");
                })
            )
            .build();
    }

    // ---- BCrypt password encoder — NEVER store plaintext passwords ----
    // Cost factor 12: ~250ms per hash (makes brute-force impractical)
    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    // ---- AuthenticationManager: wires UserDetailsService + PasswordEncoder ----
    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}

// ---- UserDetailsService: how Spring loads a user during authentication ----
@Service
public class OrderUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public OrderUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        return org.springframework.security.core.userdetails.User.builder()
            .username(user.getEmail())
            .password(user.getPasswordHash())   // already BCrypt-encoded from registration
            .roles(user.getRoles().toArray(new String[0]))   // e.g. "CUSTOMER", "ADMIN"
            .accountExpired(!user.isActive())
            .credentialsExpired(user.isPasswordExpired())
            .build();
    }
}
```

## Ứng Dụng Thực Tế

Với REST API stateless, tắt session, dùng JWT hoặc OAuth2 token và thêm custom filter trước <code>UsernamePasswordAuthenticationFilter</code>. Với app stateful (form), giữ CSRF protection.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Spring Security filter chain hoạt động thế nào?</strong></summary>

**A:** Spring Security là `Filter` chain đặt trước DispatcherServlet. Mỗi request đi qua các filter theo thứ tự: `SecurityContextPersistenceFilter` (load SecurityContext) → `UsernamePasswordAuthenticationFilter` (nếu login request) → `BasicAuthenticationFilter` (Basic Auth) → `BearerTokenAuthenticationFilter` (JWT) → `ExceptionTranslationFilter` → `AuthorizationFilter`. Mỗi filter có thể: authenticate, authorize, modify request, hoặc short-circuit (return 401/403). Custom filter: `addFilterBefore`/`addFilterAfter` trong `SecurityFilterChain` config.

</details>

<details>
<summary><strong>JWT authentication trong Spring Security thế nào?</strong></summary>

**A:** Flow: (1) Login request → `/auth/login` → verify credentials → generate JWT (HMAC hoặc RSA signed). (2) Client gửi `Authorization: Bearer <token>` trong header. (3) Custom filter (`OncePerRequestFilter`) intercept → extract token → validate signature + expiry → set `SecurityContextHolder`. Implement: `JwtAuthenticationFilter extends OncePerRequestFilter`, trong `doFilterInternal`: parse JWT với `jjwt` library → `UsernamePasswordAuthenticationToken` → `SecurityContextHolder.getContext().setAuthentication(auth)`. Config: `http.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)`.

</details>

<details>
<summary><strong>@PreAuthorize và @Secured khác nhau thế nào?</strong></summary>

**A:** **`@Secured({"ROLE_ADMIN"})`**: đơn giản, chỉ check role — không support SpEL expression. **`@PreAuthorize("hasRole('ADMIN') and #user.id == authentication.principal.id")`**: SpEL expression — flexible, có thể check method params (`#param`), authentication, custom security expressions. `@PostAuthorize`: check sau khi method return — dùng `returnObject` trong expression. Enable: `@EnableMethodSecurity` (Spring Security 6) hoặc `@EnableGlobalMethodSecurity` (deprecated). Best practice: dùng `@PreAuthorize` vì expressive hơn và support parameter-level security.

</details>
