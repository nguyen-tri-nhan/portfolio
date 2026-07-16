---
key: dotnet-di-middleware
title: "DI, Middleware & Configuration — .NET Patterns"
crumb: "16. .NET > DI & Patterns"
---

.NET có DI container built-in, middleware pipeline, và configuration system chuẩn — không cần third-party như Spring cần Spring Framework. Các pattern này mapping 1-1 với Java/Spring: service registration = @Bean, middleware = Filter, IOptions = @ConfigurationProperties.

## Điểm Chính

- **Service Lifetimes**: `Singleton` (app lifetime) / `Scoped` (per request) / `Transient` (per injection) — tương tự Spring `@Singleton / @RequestScope / @Prototype`
- **IOptions\<T\>**: Strongly-typed configuration binding — tương tự `@ConfigurationProperties` Spring Boot
- **IHostedService**: Background service — tương tự Spring `@Scheduled` hoặc background thread pool
- **Action Filters**: Cross-cutting concerns ở controller level — tương tự Spring `@Aspect` / `HandlerInterceptor`
- **Exception Middleware**: Global exception handling — tương tự Spring `@ControllerAdvice`
- **IHttpClientFactory**: Managed HttpClient với connection pooling — tương tự Spring `RestTemplate` / `WebClient`
- **ServiceCollection Extensions**: Convention để package DI registration — tương tự Spring Boot auto-configuration

## Ví Dụ Code

```csharp
// ============ SERVICE LIFETIMES ============

// Singleton — created once, shared across all requests
builder.Services.AddSingleton<ICacheService, RedisCacheService>();

// Scoped — created once per HTTP request
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<AppDbContext>();

// Transient — created every time injected
builder.Services.AddTransient<IEmailSender, SmtpEmailSender>();

// ❌ Captive dependency — Singleton inject Scoped → bug
// Singleton giữ reference đến Scoped service sau khi request kết thúc
public class BadSingleton {
    public BadSingleton(IUserService scoped) { }  // scoped bị "captured"
}

// ✅ Fix — Singleton inject IServiceScopeFactory
public class GoodSingleton {
    private readonly IServiceScopeFactory _scopeFactory;
    public GoodSingleton(IServiceScopeFactory factory) => _scopeFactory = factory;

    public async Task DoWorkAsync() {
        using var scope = _scopeFactory.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<IUserService>();
        await service.ProcessAsync();
    }
}

// ============ IHOSTEDSERVICE — BACKGROUND TASKS ============
// Tương tự Spring @Scheduled + ApplicationRunner

public class OrderCleanupService : BackgroundService {
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OrderCleanupService> _logger;

    public OrderCleanupService(IServiceScopeFactory factory, ILogger<OrderCleanupService> logger) {
        _scopeFactory = factory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
        // Loop cho đến khi app shutdown
        while (!stoppingToken.IsCancellationRequested) {
            await DoCleanupAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task DoCleanupAsync(CancellationToken ct) {
        using var scope = _scopeFactory.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow.AddDays(-30);
        var deleted = await ctx.Orders
            .Where(o => o.Status == "CANCELLED" && o.CreatedAt < cutoff)
            .ExecuteDeleteAsync(ct);

        _logger.LogInformation("Cleaned up {Count} old orders", deleted);
    }
}

// Register:
// builder.Services.AddHostedService<OrderCleanupService>();

// ============ IHTTP CLIENT FACTORY ============
// Tương tự Spring WebClient — tránh socket exhaustion

// Register named client
builder.Services.AddHttpClient("PaymentService", client => {
    client.BaseAddress = new Uri("https://payment.example.com");
    client.DefaultRequestHeaders.Add("X-Api-Key", "secret");
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Hoặc typed client (tốt hơn, type-safe)
builder.Services.AddHttpClient<PaymentServiceClient>(client => {
    client.BaseAddress = new Uri("https://payment.example.com");
});

public class PaymentServiceClient {
    private readonly HttpClient _client;
    public PaymentServiceClient(HttpClient client) => _client = client;

    public async Task<PaymentResult> ChargeAsync(ChargeRequest request, CancellationToken ct) {
        var response = await _client.PostAsJsonAsync("/charge", request, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<PaymentResult>(ct)
            ?? throw new InvalidOperationException("Empty response");
    }
}

// ============ GLOBAL EXCEPTION HANDLING ============
// Tương tự @ControllerAdvice Spring

public class GlobalExceptionHandler : IExceptionHandler {
    private readonly ILogger<GlobalExceptionHandler> _logger;
    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) => _logger = logger;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext ctx, Exception ex, CancellationToken ct) {

        _logger.LogError(ex, "Unhandled exception");

        var (statusCode, title) = ex switch {
            NotFoundException => (404, "Not Found"),
            ValidationException => (400, "Validation Error"),
            UnauthorizedException => (401, "Unauthorized"),
            _ => (500, "Internal Server Error")
        };

        ctx.Response.StatusCode = statusCode;
        await ctx.Response.WriteAsJsonAsync(new {
            Status = statusCode,
            Title = title,
            Detail = ex.Message,
            TraceId = Activity.Current?.Id ?? ctx.TraceIdentifier
        }, ct);

        return true;  // exception đã được handled
    }
}

// Register:
// builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
// app.UseExceptionHandler();

// ============ ACTION FILTERS ============
// Tương tự Spring AOP @Around cho controller actions

public class ValidateModelFilter : ActionFilterAttribute {
    public override void OnActionExecuting(ActionExecutingContext context) {
        if (!context.ModelState.IsValid) {
            var errors = context.ModelState
                .Where(e => e.Value?.Errors.Any() == true)
                .ToDictionary(
                    e => e.Key,
                    e => e.Value!.Errors.Select(err => err.ErrorMessage).ToArray()
                );
            context.Result = new BadRequestObjectResult(new { Errors = errors });
        }
    }
}

// Apply toàn bộ app:
// builder.Services.AddControllers(opt => opt.Filters.Add<ValidateModelFilter>());

// Apply một controller:
[ValidateModelFilter]
public class OrdersController : ControllerBase { }

// ============ IOPTIONST — TYPED CONFIGURATION ============

// appsettings.json:
// { "Payment": { "ApiKey": "abc", "Timeout": 30, "MaxRetries": 3 } }

public class PaymentOptions {
    public const string Section = "Payment";
    public string ApiKey { get; set; } = "";
    public int Timeout { get; set; } = 30;
    public int MaxRetries { get; set; } = 3;
}

// Register:
builder.Services.Configure<PaymentOptions>(
    builder.Configuration.GetSection(PaymentOptions.Section));

// Inject và dùng:
public class PaymentService {
    private readonly PaymentOptions _opts;
    public PaymentService(IOptions<PaymentOptions> options) {
        _opts = options.Value;
    }
}

// IOptionsMonitor — auto-reload khi file thay đổi (hot reload):
public class DynamicService {
    private readonly IOptionsMonitor<PaymentOptions> _monitor;
    public DynamicService(IOptionsMonitor<PaymentOptions> monitor) => _monitor = monitor;

    public string GetCurrentKey() => _monitor.CurrentValue.ApiKey;  // luôn mới nhất
}

// ============ EXTENSION METHODS — CLEAN DI REGISTRATION ============

// Tổ chức DI registration thành extension methods
public static class ServiceCollectionExtensions {
    public static IServiceCollection AddPaymentServices(
        this IServiceCollection services,
        IConfiguration config)
    {
        services.Configure<PaymentOptions>(config.GetSection(PaymentOptions.Section));
        services.AddHttpClient<PaymentServiceClient>();
        services.AddScoped<IPaymentService, PaymentService>();
        return services;
    }
}

// Program.cs gọn:
builder.Services.AddPaymentServices(builder.Configuration);
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Captive dependency là gì và tại sao nguy hiểm?</strong></summary>

**A:** Captive dependency xảy ra khi service có lifetime dài hơn (Singleton) inject service có lifetime ngắn hơn (Scoped/Transient). Singleton được tạo một lần và giữ reference đến Scoped service đó mãi — Scoped service không bao giờ bị dispose đúng lúc, data từ request trước có thể leak sang request sau (Scoped thường chứa DbContext với tracked entities). ASP.NET Core validate DI graph tại startup trong Development mode và throw `InvalidOperationException` khi phát hiện. Fix: Singleton dùng `IServiceScopeFactory` để tạo scope khi cần, lấy Scoped service từ scope đó.

</details>

<details>
<summary><strong>IHttpClientFactory giải quyết vấn đề gì?</strong></summary>

**A:** `new HttpClient()` trong loop gây **socket exhaustion** — HttpClient dispose không release socket ngay lập tức (TIME_WAIT state), hết socket → connection refused. `IHttpClientFactory` giải quyết bằng connection pooling: tái sử dụng `HttpMessageHandler` (thực sự giữ connection) giữa các requests trong khoảng 2 phút, sau đó rotate để tránh DNS stale. Tương tự Java: `RestTemplate` nên là singleton với `HttpComponentsClientHttpRequestFactory` pooling, không new mỗi lần. `HttpClientFactory` cũng support Polly policies (retry, circuit breaker) tích hợp — `AddHttpClient().AddTransientHttpErrorPolicy(...)`.

</details>

<details>
<summary><strong>BackgroundService khác IHostedService thế nào?</strong></summary>

**A:** `IHostedService` là interface với `StartAsync/StopAsync` — cần tự implement loop và handle cancellation. `BackgroundService` là abstract class implement `IHostedService`, expose `ExecuteAsync(CancellationToken stoppingToken)` — đơn giản hơn, chỉ cần override một method. Thực tế luôn dùng `BackgroundService` trừ khi cần control chi tiết lifecycle. Chú ý: `BackgroundService` chạy trong scope riêng (singleton), không inject được Scoped service trực tiếp — dùng `IServiceScopeFactory` tương tự captive dependency pattern.

</details>
