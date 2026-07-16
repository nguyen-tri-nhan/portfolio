---
key: dotnet-testing
title: ".NET Testing — xUnit, Moq & Integration Testing"
crumb: "16. .NET > Testing"
---

.NET testing ecosystem: xUnit (preferred, mặc định trong ASP.NET Core templates), NUnit, MSTest. Mocking: Moq (phổ biến nhất) hoặc NSubstitute. Assertion: FluentAssertions cho readable test. Integration testing: `WebApplicationFactory<T>` built-in — tương tự Spring `@SpringBootTest` + MockMvc.

## Điểm Chính

- **xUnit**: `[Fact]` = test method, `[Theory]` + `[InlineData]` = parameterized test — tương tự JUnit 5 `@Test` + `@ParameterizedTest`
- **Moq**: `Mock<T>`, `Setup()`, `Verify()` — tương tự Mockito `mock()`, `when()`, `verify()`
- **FluentAssertions**: `.Should().Be()`, `.Should().Throw<>()` — readable assertion thay `Assert.Equal`
- **WebApplicationFactory**: In-memory test server — tương tự `@SpringBootTest(webEnvironment = RANDOM_PORT)`
- **TestContainers**: Spin up Docker container trong test — tương tự Testcontainers Java
- **IClassFixture**: Share expensive setup across tests trong class — tương tự JUnit 5 `@TestInstance(PER_CLASS)` + `@BeforeAll`
- **AutoFixture**: Auto-generate test data — tương tự Java Instancio/EasyRandom

## Ví Dụ Code

```csharp
// ============ XUNIT BASICS ============

public class OrderServiceTests {
    private readonly Mock<IOrderRepository> _repoMock;
    private readonly Mock<IEmailService>    _emailMock;
    private readonly OrderService           _sut;  // System Under Test

    public OrderServiceTests() {
        _repoMock  = new Mock<IOrderRepository>();
        _emailMock = new Mock<IEmailService>();
        _sut       = new OrderService(_repoMock.Object, _emailMock.Object);
    }

    // [Fact] — tương tự JUnit @Test
    [Fact]
    public async Task CreateOrder_ValidRequest_ReturnsCreatedOrder() {
        // Arrange
        var request = new CreateOrderRequest(UserId: 1, Amount: 100m);
        var expected = new Order { Id = 42, Status = OrderStatus.Pending };
        
        _repoMock
            .Setup(r => r.CreateAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        // Act
        var result = await _sut.CreateAsync(request, CancellationToken.None);

        // Assert — FluentAssertions
        result.Should().NotBeNull();
        result.Id.Should().Be(42);
        result.Status.Should().Be(OrderStatus.Pending);
    }

    // [Theory] + [InlineData] — parameterized test
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-100)]
    public async Task CreateOrder_InvalidAmount_ThrowsValidationException(decimal amount) {
        var request = new CreateOrderRequest(UserId: 1, Amount: amount);
        
        // Assert exception thrown
        await _sut.Invoking(s => s.CreateAsync(request, CancellationToken.None))
                  .Should().ThrowAsync<ValidationException>()
                  .WithMessage("*amount*");
    }

    // [MemberData] — test data từ static property
    public static IEnumerable<object[]> InvalidRequests => [
        [new CreateOrderRequest(UserId: 0, Amount: 100m)],   // invalid user
        [new CreateOrderRequest(UserId: 1, Amount: 0m)],     // invalid amount
        [new CreateOrderRequest(UserId: -1, Amount: -1m)],   // both invalid
    ];

    [Theory]
    [MemberData(nameof(InvalidRequests))]
    public async Task CreateOrder_InvalidRequest_ThrowsException(CreateOrderRequest request) {
        await _sut.Invoking(s => s.CreateAsync(request, CancellationToken.None))
                  .Should().ThrowAsync<ValidationException>();
    }
}

// ============ MOQ — MOCKING ============

// Setup return value
_repoMock
    .Setup(r => r.FindByIdAsync(42, It.IsAny<CancellationToken>()))
    .ReturnsAsync(new Order { Id = 42 });

// Setup throw exception
_repoMock
    .Setup(r => r.FindByIdAsync(999, It.IsAny<CancellationToken>()))
    .ThrowsAsync(new NotFoundException("Order 999 not found"));

// Setup based on argument condition
_repoMock
    .Setup(r => r.FindByIdAsync(It.Is<int>(id => id > 0), It.IsAny<CancellationToken>()))
    .ReturnsAsync((int id, CancellationToken _) => new Order { Id = id });

// Verify interaction — tương tự Mockito verify()
_emailMock.Verify(
    e => e.SendAsync(It.Is<string>(email => email.Contains("@")), It.IsAny<CancellationToken>()),
    Times.Once
);

_repoMock.Verify(r => r.SaveAsync(It.IsAny<CancellationToken>()), Times.Never);

// Capture argument — tương tự Mockito ArgumentCaptor
Order? capturedOrder = null;
_repoMock
    .Setup(r => r.CreateAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
    .Callback<Order, CancellationToken>((order, _) => capturedOrder = order)
    .ReturnsAsync(new Order { Id = 1 });

await _sut.CreateAsync(request, CancellationToken.None);

capturedOrder.Should().NotBeNull();
capturedOrder!.UserId.Should().Be(request.UserId);

// Mock sequence — different returns per call
var sequence = new MockSequence();
_repoMock.InSequence(sequence).Setup(r => r.FindByIdAsync(1, It.IsAny<CancellationToken>()))
    .ReturnsAsync(null as Order);
_repoMock.InSequence(sequence).Setup(r => r.FindByIdAsync(1, It.IsAny<CancellationToken>()))
    .ReturnsAsync(new Order { Id = 1 });

// ============ SHARED FIXTURE — ICLASSFIXTURE ============
// Share expensive setup (DB, server) across all tests in class

public class DatabaseFixture : IAsyncLifetime {
    public AppDbContext DbContext { get; private set; } = null!;
    private readonly string _connectionString = "...";

    public async Task InitializeAsync() {
        // Run once before all tests in class
        DbContext = new AppDbContext(/* options */);
        await DbContext.Database.MigrateAsync();
        await SeedTestDataAsync(DbContext);
    }

    public async Task DisposeAsync() {
        await DbContext.Database.EnsureDeletedAsync();
        await DbContext.DisposeAsync();
    }
}

public class UserRepositoryTests : IClassFixture<DatabaseFixture> {
    private readonly DatabaseFixture _fixture;

    public UserRepositoryTests(DatabaseFixture fixture) {
        _fixture = fixture;
    }

    [Fact]
    public async Task FindById_ExistingUser_ReturnsUser() {
        var repo = new UserRepository(_fixture.DbContext);
        var user = await repo.FindByIdAsync(1, CancellationToken.None);
        user.Should().NotBeNull();
    }
}

// ============ WEBAPPLICATIONFACTORY — INTEGRATION TEST ============
// Tương tự Spring @SpringBootTest + MockMvc

public class UserApiTests : IClassFixture<WebApplicationFactory<Program>> {
    private readonly HttpClient _client;

    public UserApiTests(WebApplicationFactory<Program> factory) {
        _client = factory
            .WithWebHostBuilder(builder => {
                builder.ConfigureServices(services => {
                    // Override services for testing
                    services.AddSingleton<IEmailService, FakeEmailService>();
                    
                    // Replace DbContext with in-memory
                    var descriptor = services.FirstOrDefault(d => d.ServiceType == typeof(AppDbContext));
                    if (descriptor != null) services.Remove(descriptor);
                    services.AddDbContext<AppDbContext>(opt => opt.UseInMemoryDatabase("TestDb"));
                });
            })
            .CreateClient();
    }

    [Fact]
    public async Task GetUser_ExistingUser_Returns200() {
        // Act
        var response = await _client.GetAsync("/api/users/1");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var user = await response.Content.ReadFromJsonAsync<UserDto>();
        user.Should().NotBeNull();
        user!.Id.Should().Be(1);
    }

    [Fact]
    public async Task CreateUser_ValidRequest_Returns201() {
        var request = new CreateUserRequest("Alice", "alice@example.com", 30);
        
        var response = await _client.PostAsJsonAsync("/api/users", request);
        
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<UserDto>();
        created!.Name.Should().Be("Alice");
    }
}

// ============ TESTCONTAINERS ============
// Real database trong tests

public class PostgresIntegrationTests : IAsyncLifetime {
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16")
        .WithDatabase("testdb")
        .WithUsername("testuser")
        .WithPassword("testpass")
        .Build();

    public async Task InitializeAsync() {
        await _postgres.StartAsync();
        
        // Run migrations
        var ctx = CreateDbContext();
        await ctx.Database.MigrateAsync();
    }

    public Task DisposeAsync() => _postgres.DisposeAsync().AsTask();

    private AppDbContext CreateDbContext() {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task CreateUser_PersistsToDatabase() {
        var ctx = CreateDbContext();
        ctx.Users.Add(new User { Name = "Test", Email = "test@example.com" });
        await ctx.SaveChangesAsync();

        var saved = await ctx.Users.FirstAsync(u => u.Email == "test@example.com");
        saved.Name.Should().Be("Test");
    }
}

// ============ FLUENT ASSERTIONS EXAMPLES ============

// Collections
list.Should().HaveCount(3);
list.Should().Contain(x => x.Id > 0);
list.Should().BeInAscendingOrder(x => x.Name);
list.Should().NotContainNulls();
list.Should().AllSatisfy(x => x.Status.Should().Be(Status.Active));

// Exceptions
action.Should().Throw<ArgumentException>()
    .WithMessage("*userId*")
    .And.ParamName.Should().Be("userId");

// Async exceptions
await asyncAction.Should().ThrowAsync<ValidationException>();

// Object equality
actual.Should().BeEquivalentTo(expected, options => 
    options.Excluding(x => x.CreatedAt));  // ignore timestamp
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>IClassFixture vs Constructor setup trong xUnit — khác nhau thế nào?</strong></summary>

**A:** **Constructor**: chạy trước MỖI test method — tạo mới object cho mỗi test, isolation tốt nhất. **IClassFixture\<T\>**: T được tạo 1 lần cho cả class, inject vào constructor — dùng cho resource tốn kém như DB connection, Docker container, test server. xUnit không có `[SetUp]`/`[TearDown]` như NUnit — dùng constructor (setup) và `IDisposable.Dispose()` (teardown). `IAsyncLifetime` cho async setup/teardown. Tương tự JUnit 5: constructor ≈ `@BeforeEach`; `IClassFixture` ≈ `@TestInstance(PER_CLASS)` + `@BeforeAll`; `IAsyncLifetime` ≈ `BeforeAllCallback` extension.

</details>

<details>
<summary><strong>Mock<T> vs Stub vs Fake — khi nào dùng cái nào?</strong></summary>

**A:** **Stub**: return predefined value, không verify interaction — `_repo.Setup(r => r.Find(1)).Returns(user)`. **Mock**: stub + verify interaction — `_email.Verify(e => e.Send(...), Times.Once)`. **Fake**: implementation đơn giản hóa nhưng functional — InMemoryDatabase là fake, không phải mock. **Spy**: wrap real object, intercept một số call. Rule: (1) Dùng stub/mock cho external dependencies (email, SMS, payment). (2) Dùng fake cho infrastructure (InMemory DB, in-memory cache). (3) Verify chỉ khi behavior quan trọng — tránh over-verify sẽ làm test fragile. Moq `Verify(Times.Once)` là mock; `Returns(value)` là stub — cùng object `Mock<T>` làm được cả hai.

</details>
