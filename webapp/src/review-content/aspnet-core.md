---
key: aspnet-core
title: "ASP.NET Core — Web Framework"
crumb: "16. .NET > ASP.NET Core"
---

ASP.NET Core là web framework cross-platform của Microsoft — tương đương Spring Boot trong Java ecosystem. Cùng pattern: DI container, middleware pipeline, controller-based routing, configuration system. Java dev adopt nhanh vì mental model gần như giống nhau, chỉ khác naming convention và tooling.

## Điểm Chính

- **Program.cs**: Entry point — tương tự Spring Boot `@SpringBootApplication` + `main()`, dùng builder pattern để config service và middleware
- **DI Container**: Built-in DI — `AddScoped/AddSingleton/AddTransient` tương tự Spring `@Bean` với `@RequestScope/@Singleton/@Prototype`
- **Middleware Pipeline**: `app.Use(...)` — tương tự Spring Filter/HandlerInterceptor, order của middleware quan trọng
- **Controllers**: `[ApiController]` + `[Route]` — tương tự `@RestController` + `@RequestMapping`
- **Minimal APIs**: Alternative không cần controller class — `app.MapGet("/", ...)` — phù hợp microservice nhỏ
- **Model Binding**: Request body tự động deserialize vào parameter — tương tự `@RequestBody` Spring
- **IConfiguration**: `appsettings.json` — tương tự `application.properties/yml`, hỗ trợ environment override
- **Health Checks**: Built-in `/health` endpoint — tương tự Spring Actuator `/health`
- **ILogger**: Structured logging built-in — tương tự SLF4J + Logback trong Java

## Ví Dụ Code

```csharp
// ============ PROGRAM.CS — ENTRY POINT ============
// Tương tự Spring Boot main() + @SpringBootApplication

var builder = WebApplication.CreateBuilder(args);

// ── Register Services (tương tự @Bean / @Configuration) ──
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// DI Registration — tương tự Spring bean scopes
builder.Services.AddScoped<IUserService, UserService>();      // @RequestScope
builder.Services.AddSingleton<ICacheService, CacheService>(); // @Singleton
builder.Services.AddTransient<IEmailService, EmailService>(); // @Prototype

// DbContext (tương tự Spring Data @Repository + EntityManager)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// Health checks (tương tự Spring Actuator)
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("Default")!);

var app = builder.Build();

// ── Middleware Pipeline (tương tự Spring Filter chain) ──
if (app.Environment.IsDevelopment()) {
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthentication();   // phải trước Authorization
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");
app.Run();

// ============ CONTROLLER ============
// Tương tự @RestController trong Spring

[ApiController]
[Route("api/[controller]")]  // [controller] = "users" (lowercase class name)
public class UsersController : ControllerBase {

    private readonly IUserService _userService;
    private readonly ILogger<UsersController> _logger;

    // Constructor injection — tương tự @Autowired (constructor)
    public UsersController(IUserService userService, ILogger<UsersController> logger) {
        _userService = userService;
        _logger = logger;
    }

    // GET /api/users
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetAll() {
        var users = await _userService.GetAllAsync();
        return Ok(users);
    }

    // GET /api/users/123
    [HttpGet("{id:int}")]
    public async Task<ActionResult<UserDto>> GetById(int id) {
        var user = await _userService.FindByIdAsync(id);
        return user is null ? NotFound() : Ok(user);
    }

    // POST /api/users  (tương tự @RequestBody)
    [HttpPost]
    public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserRequest request) {
        _logger.LogInformation("Creating user {Name}", request.Name);
        var user = await _userService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, user);
    }

    // PUT /api/users/123
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest request) {
        await _userService.UpdateAsync(id, request);
        return NoContent();
    }

    // DELETE /api/users/123
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id) {
        await _userService.DeleteAsync(id);
        return NoContent();
    }
}

// ============ REQUEST/RESPONSE MODELS ============
// Tương tự Java DTO + @Valid annotation

public record CreateUserRequest(
    [Required][MaxLength(100)] string Name,
    [EmailAddress] string Email,
    [Range(0, 150)] int Age
);

public record UserDto(int Id, string Name, string Email);

// ============ MIDDLEWARE ============
// Tương tự Spring Filter — xử lý cross-cutting concerns

public class RequestLoggingMiddleware {
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger) {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context) {
        var start = DateTime.UtcNow;

        // Before request (tương tự preHandle)
        _logger.LogInformation("{Method} {Path} started", 
            context.Request.Method, context.Request.Path);

        await _next(context);  // gọi middleware tiếp theo

        // After request (tương tự postHandle/afterCompletion)
        var duration = DateTime.UtcNow - start;
        _logger.LogInformation("{Method} {Path} completed in {Ms}ms",
            context.Request.Method, context.Request.Path, duration.TotalMilliseconds);
    }
}

// Register middleware:
// app.UseMiddleware<RequestLoggingMiddleware>();

// ============ MINIMAL APIs (alternative to Controllers) ============
// Phù hợp cho microservice nhỏ — không cần controller class

app.MapGet("/api/products", async (IProductService svc) =>
    await svc.GetAllAsync());

app.MapGet("/api/products/{id:int}", async (int id, IProductService svc) => {
    var product = await svc.FindByIdAsync(id);
    return product is null ? Results.NotFound() : Results.Ok(product);
});

app.MapPost("/api/products", async (CreateProductRequest req, IProductService svc) => {
    var product = await svc.CreateAsync(req);
    return Results.Created($"/api/products/{product.Id}", product);
});

// ============ CONFIGURATION ============
// appsettings.json — tương tự application.yml

/*
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=myapp;Username=app;Password=secret"
  },
  "App": {
    "MaxRetries": 3,
    "BaseUrl": "https://api.example.com"
  }
}
*/

// Đọc config — tương tự @Value("${app.base-url}")
var baseUrl = builder.Configuration["App:BaseUrl"];

// Strongly-typed config (tương tự @ConfigurationProperties)
public class AppSettings {
    public int MaxRetries { get; set; }
    public string BaseUrl { get; set; } = "";
}
builder.Services.Configure<AppSettings>(builder.Configuration.GetSection("App"));

// Inject vào service:
public class MyService(IOptions<AppSettings> options) {
    private readonly AppSettings _settings = options.Value;
}
```

## Ứng Dụng Thực Tế

ASP.NET Core phổ biến trong Microsoft ecosystem (Azure Functions, Azure App Service), enterprise Windows, và cross-platform Linux containers. Performance benchmark thường top 3 trong TechEmpower. Java Spring Boot dev sẽ thấy familiar với DI, middleware, configuration system — nhưng cần chú ý khác biệt: C# `async/await` natural hơn, `CancellationToken` cho cancel in-flight request, và `IOptions<T>` cho strongly-typed config.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>DI trong ASP.NET Core khác Spring DI thế nào?</strong></summary>

**A:** Cả hai đều IoC container với constructor injection. Điểm khác: (1) **Registration** — ASP.NET dùng `AddScoped/AddSingleton/AddTransient` explicit; Spring dùng `@Component/@Service/@Repository` annotation scanning. (2) **Scope** — ASP.NET `Scoped` = per HTTP request (tương tự Spring `@RequestScope`); Spring default `@Autowired` bean là singleton. (3) **Validation** — ASP.NET không detect circular dependency tại startup (throw tại runtime); Spring bắt circular dependency tại startup với `@Lazy` option. (4) **Extension** — ASP.NET có Microsoft.Extensions.DependencyInjection là interface, có thể swap sang Autofac/Ninject; Spring container không dễ swap. Cả hai đều support named registration và factory pattern.

</details>

<details>
<summary><strong>Middleware pipeline ASP.NET Core hoạt động thế nào?</strong></summary>

**A:** Middleware trong ASP.NET Core tạo thành pipeline — mỗi middleware gọi `_next(context)` để chuyển tiếp request xuống pipeline, sau đó xử lý response khi `_next` return. **Order quan trọng**: `UseAuthentication` phải trước `UseAuthorization` vì Authorization cần identity đã được authenticate. Khác Spring: (1) Spring Filter là servlet-level (bao bọc DispatcherServlet) và HandlerInterceptor là MVC-level (trong DispatcherServlet); ASP.NET Middleware là một pipeline nhất quán không có hai layer. (2) `app.Use()` vs `app.Run()` — `Run()` là terminal middleware (không gọi `_next`), `Use()` có thể pass xuống hoặc short-circuit. (3) Exception handling middleware nên đặt đầu pipeline để catch tất cả exception.

</details>

<details>
<summary><strong>Controller vs Minimal APIs — khi nào dùng cái nào?</strong></summary>

**A:** **Controller**: phù hợp API lớn, nhiều endpoint, cần tổ chức theo class, cần feature đầy đủ (action filter, model binding phức tạp, versioning). **Minimal APIs**: phù hợp microservice nhỏ, lambda function, demo, performance-sensitive (ít overhead hơn controller pipeline). Minimal APIs từ .NET 6 đã có đầy đủ tính năng (DI injection, route groups, middleware), performance tốt hơn controller vì ít reflection overhead. Thực tế: project vừa-lớn dùng Controller; microservice đơn giản, internal service, hoặc BFF (Backend For Frontend) dùng Minimal APIs.

</details>
