---
key: "Filters vs Interceptors"
title: "Filter vs Interceptor"
crumb: "3. Spring Ecosystem › Spring MVC"
---

Filter là Servlet-level (trước/sau toàn bộ Spring context); Interceptor là Spring MVC-level (xung quanh handler execution), có quyền truy cập handler và model.

## Điểm Chính

- <strong>Filter</strong>: thuộc Servlet API, chạy trước DispatcherServlet. Không có Spring context trong filter trừ khi dùng DelegatingFilterProxy.
- <strong>Interceptor</strong>: đặc thù Spring MVC, chạy trong DispatcherServlet, có quyền truy cập <code>HandlerMethod</code> và model.
- Filter: authentication, biến đổi request/response, GZIP compression, CORS preflight.
- Interceptor: logging với request-context, role-based access đến handler metadata, performance monitoring.
- Interceptor KHÔNG chạy cho request không khớp handler nào (ví dụ: 404). Filter luôn chạy.

## Ví Dụ Code

*Filter vs Interceptor: CorrelationIdFilter (MDC, OncePerRequestFilter), RequestAuditFilter, AdminAccessInterceptor (handler annotation check)*

```java
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.slf4j.MDC;
import org.springframework.core.annotation.*;
import org.springframework.stereotype.*;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;

// ========== FILTER (Servlet API level) ==========
// Runs BEFORE DispatcherServlet — no access to Spring MVC concepts (handler, model)
// Use for: CORS, auth token extraction, request/response transformation, correlation ID

// @Order controls filter execution order (lower = earlier)
@Component
@Order(1)
public class CorrelationIdFilter extends OncePerRequestFilter {
    // OncePerRequestFilter ensures doFilterInternal() is called exactly once per request
    // (prevents duplicate execution in async dispatch)

    private static final String HEADER = "X-Correlation-Id";
    private static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // Extract from header or generate a new one
        String correlationId = Optional.ofNullable(request.getHeader(HEADER))
                                       .filter(h -> !h.isBlank())
                                       .orElse(UUID.randomUUID().toString());
        try {
            // Put in MDC so ALL log statements in this request include it automatically
            MDC.put(MDC_KEY, correlationId);
            // Echo correlation ID back in the response so clients can trace their request
            response.setHeader(HEADER, correlationId);
            filterChain.doFilter(request, response); // continue chain
        } finally {
            MDC.remove(MDC_KEY); // ALWAYS clean up MDC — prevents leaking into next request
        }
    }
}

// Second filter: log raw request body size BEFORE Spring parses it
@Component
@Order(2)
public class RequestAuditFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        int contentLength = request.getContentLength();
        if (contentLength > 10 * 1024 * 1024) { // 10 MB limit
            response.sendError(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE,
                "Request body exceeds 10 MB limit");
            return; // stop chain — DO NOT call filterChain.doFilter()
        }
        filterChain.doFilter(request, response);
    }
}

// ========== INTERCEPTOR (Spring MVC level) ==========
// Runs INSIDE DispatcherServlet — has access to handler method + annotations
// Use for: role-based access on specific controller methods, per-handler logging

@Component
public class AdminAccessInterceptor implements HandlerInterceptor {

    private final SecurityContextService securityContextService;

    public AdminAccessInterceptor(SecurityContextService securityContextService) {
        this.securityContextService = securityContextService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {
        if (handler instanceof HandlerMethod handlerMethod) {
            // Access method-level annotation — IMPOSSIBLE in a filter
            RequiresAdminAccess annotation = handlerMethod.getMethodAnnotation(RequiresAdminAccess.class);
            if (annotation != null) {
                if (!securityContextService.currentUserIsAdmin()) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN,
                        "Admin access required for: " + handlerMethod.getMethod().getName());
                    return false; // abort — controller method is NOT called
                }
            }
        }
        return true;
    }
}

// Custom annotation used by the interceptor
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiresAdminAccess {}

// Usage in controller:
// @GetMapping("/admin/orders")
// @RequiresAdminAccess
// public List<Order> getAllOrders() { ... }
```

## Ứng Dụng Thực Tế

Dùng Filter cho Spring Security (phải chạy trước khi request đến bất kỳ Spring bean nào). Dùng Interceptor cho logic per-handler như kiểm tra annotation @RequireRole trên controller method. Interceptor có thể short-circuit bằng cách trả về false từ preHandle().

## Câu Hỏi Phỏng Vấn

1. Bạn có thể inject Spring bean vào Filter không? Bằng cách nào?
1. Điều gì xảy ra với interceptor nếu filter ném exception?
1. Làm thế nào để đăng ký Filter vs Interceptor?
