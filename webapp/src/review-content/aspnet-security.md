---
key: aspnet-security
title: "ASP.NET Core Security — JWT, Auth & Authorization"
crumb: "16. .NET > Security"
---

ASP.NET Core Security: Authentication (ai bạn là) và Authorization (bạn được làm gì) tách biệt rõ ràng. JWT + Bearer token là pattern phổ biến nhất cho API. Policy-based authorization linh hoạt hơn role-based đơn thuần. Tương tự Spring Security: `UseAuthentication` ↔ Spring Security filter chain, `[Authorize]` ↔ `@PreAuthorize`.

## Điểm Chính

- **Authentication Middleware**: `UseAuthentication()` xác định identity từ request (JWT, cookie, API key)
- **Authorization Middleware**: `UseAuthorization()` kiểm tra permission dựa trên identity đã authenticate
- **JWT Bearer**: Phổ biến nhất cho REST API — validate signature, expiry, claims
- **Claims**: `ClaimsPrincipal` — tập hợp key-value về user (id, email, role, custom) trong token
- **Policy-based**: `[Authorize(Policy = "RequireAdmin")]` — flexible hơn `[Authorize(Roles = "Admin")]`
- **Resource-based**: Authorization dựa trên resource cụ thể (user A chỉ xóa order của mình)
- **Data Protection**: Built-in encryption cho cookie, anti-forgery token
- **CORS**: Cross-origin configuration — tương tự Spring `@CrossOrigin` + `WebMvcConfigurer`

## Ví Dụ Code

```csharp
// ============ JWT AUTHENTICATION SETUP ============

// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!)),
            ClockSkew                = TimeSpan.FromMinutes(1)  // tolerance
        };

        // Custom events
        options.Events = new JwtBearerEvents {
            OnTokenValidated = ctx => {
                // Custom validation sau khi token hợp lệ
                return Task.CompletedTask;
            },
            OnAuthenticationFailed = ctx => {
                ctx.Response.Headers["Token-Error"] = ctx.Exception.Message;
                return Task.CompletedTask;
            }
        };
    });

// Authorization policies
builder.Services.AddAuthorization(options => {
    // Simple role policy
    options.AddPolicy("RequireAdmin", policy =>
        policy.RequireRole("Admin"));

    // Claim-based policy
    options.AddPolicy("PremiumUser", policy =>
        policy.RequireClaim("subscription", "premium", "enterprise"));

    // Age policy
    options.AddPolicy("AdultOnly", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim(c => c.Type == "age" && int.Parse(c.Value) >= 18)));

    // Combined policy
    options.AddPolicy("SeniorAdmin", policy =>
        policy.RequireRole("Admin")
              .RequireClaim("department", "Engineering")
              .RequireAuthenticatedUser());

    // Default policy — tất cả endpoint cần authenticate (opt-out thay opt-in)
    options.DefaultPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
    options.FallbackPolicy = options.DefaultPolicy;  // áp dụng khi không có [Authorize]
});

// Register custom handlers
builder.Services.AddScoped<IAuthorizationHandler, ResourceOwnerHandler>();

// ============ JWT TOKEN GENERATION ============

public class TokenService {
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config) => _config = config;

    public string GenerateToken(User user) {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:Secret"]!));

        var claims = new List<Claim> {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email,          user.Email),
            new(ClaimTypes.Name,           user.Name),
            new(ClaimTypes.Role,           user.Role),
            new("subscription",            user.SubscriptionTier),
            new("department",              user.Department),
        };

        var token = new JwtSecurityToken(
            issuer:   _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims:   claims,
            notBefore: DateTime.UtcNow,
            expires:  DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken() {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }
}

// ============ CONTROLLER — AUTHENTICATION & AUTHORIZATION ============

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase {
    [HttpPost("login")]
    [AllowAnonymous]  // override FallbackPolicy
    public async Task<IActionResult> Login([FromBody] LoginRequest request) {
        var user = await _userService.ValidateAsync(request.Email, request.Password);
        if (user is null) return Unauthorized();

        var accessToken  = _tokenService.GenerateToken(user);
        var refreshToken = _tokenService.GenerateRefreshToken();

        await _userService.SaveRefreshTokenAsync(user.Id, refreshToken);

        return Ok(new {
            AccessToken  = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn    = 3600
        });
    }
}

[ApiController]
[Route("api/orders")]
[Authorize]  // require authentication
public class OrdersController : ControllerBase {
    // GET /api/orders — authenticated users
    [HttpGet]
    public async Task<IActionResult> GetMyOrders() {
        // ClaimsPrincipal — tương tự Spring SecurityContextHolder
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var orders = await _orderService.GetByUserAsync(userId, HttpContext.RequestAborted);
        return Ok(orders);
    }

    // DELETE /api/orders/{id} — admin only
    [HttpDelete("{id}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<IActionResult> Delete(int id) {
        await _orderService.DeleteAsync(id, HttpContext.RequestAborted);
        return NoContent();
    }

    // PUT /api/orders/{id} — resource owner OR admin
    [HttpPut("{id}")]
    [Authorize(Policy = "OrderOwnerOrAdmin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateOrderRequest request) {
        await _orderService.UpdateAsync(id, request, HttpContext.RequestAborted);
        return NoContent();
    }
}

// ============ RESOURCE-BASED AUTHORIZATION ============

// Requirement
public class OrderOwnerRequirement : IAuthorizationRequirement { }

// Handler — check resource ownership
public class ResourceOwnerHandler : AuthorizationHandler<OrderOwnerRequirement, Order> {
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        OrderOwnerRequirement requirement,
        Order order)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (order.UserId.ToString() == userId || context.User.IsInRole("Admin")) {
            context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}

// Controller usage
public class OrdersController : ControllerBase {
    private readonly IAuthorizationService _authService;

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id) {
        var order = await _orderService.FindByIdAsync(id);
        if (order is null) return NotFound();

        var authResult = await _authService.AuthorizeAsync(
            User, order, new OrderOwnerRequirement());

        if (!authResult.Succeeded) return Forbid();

        await _orderService.DeleteAsync(id);
        return NoContent();
    }
}

// ============ CORS ============

builder.Services.AddCors(options => {
    options.AddPolicy("AllowFrontend", policy => {
        policy.WithOrigins(
                "https://app.example.com",
                "https://admin.example.com")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()   // cần cho cookie auth
              .SetPreflightMaxAge(TimeSpan.FromMinutes(10));
    });

    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()     // development only
              .AllowAnyMethod()
              .AllowAnyHeader());
});

// Áp dụng middleware
app.UseCors("AllowFrontend");

// Áp dụng trên controller
[EnableCors("AllowFrontend")]
public class UsersController : ControllerBase { }

// ============ READING CLAIMS ============

// Trong controller
string? userId  = User.FindFirstValue(ClaimTypes.NameIdentifier);
string? email   = User.FindFirstValue(ClaimTypes.Email);
bool    isAdmin = User.IsInRole("Admin");
var     roles   = User.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value);

// Inject current user via service
public interface ICurrentUser {
    int    Id    { get; }
    string Email { get; }
    bool   IsAdmin { get; }
}

public class CurrentUserService : ICurrentUser {
    private readonly IHttpContextAccessor _accessor;

    public CurrentUserService(IHttpContextAccessor accessor) => _accessor = accessor;

    public int    Id      => int.Parse(_accessor.HttpContext!.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public string Email   => _accessor.HttpContext!.User.FindFirstValue(ClaimTypes.Email)!;
    public bool   IsAdmin => _accessor.HttpContext!.User.IsInRole("Admin");
}

// Register
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUserService>();
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Authentication vs Authorization trong ASP.NET Core — khác nhau thế nào?</strong></summary>

**A:** **Authentication** (UseAuthentication): xác định **ai** đang request — đọc JWT token, validate signature, extract claims, set `HttpContext.User`. Xảy ra trước Authorization. **Authorization** (UseAuthorization): xác định **được phép làm gì** — check `[Authorize]` attribute, evaluate policies, check roles/claims. Nếu Authentication fail → 401 Unauthorized. Nếu Authorization fail → 403 Forbidden. Order middleware: `UseAuthentication()` phải trước `UseAuthorization()` — Authorization cần User identity đã được set. Tương tự Spring Security: FilterChain xử lý `UsernamePasswordAuthenticationFilter` (authentication) trước `ExceptionTranslationFilter` và `FilterSecurityInterceptor` (authorization).

</details>

<details>
<summary><strong>Policy-based authorization mạnh hơn role-based thế nào?</strong></summary>

**A:** **Role-based** `[Authorize(Roles = "Admin")]`: chỉ check role name — inflexible khi requirements phức tạp. **Policy-based**: compose multiple requirements — role + claim + custom logic. Ví dụ `SeniorAdmin` policy: `RequireRole("Admin") && RequireClaim("department", "Eng") && age >= 30`. Policy có thể inject service (check DB), policy handler có thể async. **Resource-based**: policy evaluate trên resource cụ thể (chỉ owner mới delete). Tương tự Spring `@PreAuthorize("hasRole('ADMIN') and #userId == authentication.principal.id")` nhưng type-safe và testable hơn. Best practice: model permissions như policies, không hard-code role check trong business logic.

</details>
