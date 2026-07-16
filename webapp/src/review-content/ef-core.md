---
key: ef-core
title: "Entity Framework Core — ORM"
crumb: "16. .NET > Entity Framework Core"
---

Entity Framework Core là ORM chính thức của .NET — tương đương Hibernate/JPA trong Java. Code-first approach phổ biến hơn database-first: define C# class → EF Core tạo migration → apply lên DB. Java dev sẽ thấy nhiều concept quen: entity mapping, lazy loading, transaction, N+1 problem.

## Điểm Chính

- **DbContext**: Tương đương `EntityManager` trong JPA — unit of work, manage entities, run queries
- **DbSet\<T\>**: Tương đương JPA `Repository` — collection đại diện cho DB table
- **Code-first migrations**: Tương đương Flyway + JPA schema generation — EF Core generate SQL migration từ code change
- **LINQ to SQL**: Query bằng LINQ, EF Core translate sang SQL — tương đương JPQL/Criteria API
- **Include()**: Eager loading — tương đương `@EntityGraph` hoặc `JOIN FETCH` trong JPA
- **AsNoTracking()**: Tắt change tracking cho read-only query — tương đương JPA detached entity
- **Migrations**: `dotnet ef migrations add` → generate SQL → `dotnet ef database update`
- **Transactions**: `using var tx = await context.Database.BeginTransactionAsync()` — hoặc dùng `SaveChangesAsync()` automatic transaction

## Ví Dụ Code

```csharp
// ============ ENTITY DEFINITION ============
// Tương tự @Entity @Table trong JPA

public class Order {
    public int Id { get; set; }                    // PK — auto-detected by convention
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public decimal TotalAmount { get; set; }

    // Foreign key
    public int UserId { get; set; }
    public User User { get; set; } = null!;        // Navigation property (tương tự @ManyToOne)

    // Collection navigation (tương tự @OneToMany)
    public List<OrderItem> Items { get; set; } = [];
}

public class OrderItem {
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }

    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
}

// ============ DBCONTEXT ============
// Tương tự EntityManager + @Repository

public class AppDbContext : DbContext {
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) {
        // Fluent API configuration (tương tự JPA @Column, @Index annotations)
        modelBuilder.Entity<User>(entity => {
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Name).HasMaxLength(100).IsRequired();
            entity.Property(u => u.Email).HasMaxLength(200).IsRequired();
        });

        modelBuilder.Entity<Order>(entity => {
            entity.HasOne(o => o.User)
                  .WithMany(u => u.Orders)
                  .HasForeignKey(o => o.UserId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(o => o.TotalAmount).HasPrecision(18, 2);
        });
    }
}

// Register trong Program.cs:
// builder.Services.AddDbContext<AppDbContext>(opt =>
//     opt.UseNpgsql(connectionString));

// ============ BASIC CRUD ============

public class OrderRepository {
    private readonly AppDbContext _ctx;
    public OrderRepository(AppDbContext ctx) => _ctx = ctx;

    // CREATE
    public async Task<Order> CreateAsync(Order order) {
        _ctx.Orders.Add(order);
        await _ctx.SaveChangesAsync();   // auto transaction, commit
        return order;
    }

    // READ — tương tự JPA findById
    public async Task<Order?> FindByIdAsync(int id)
        => await _ctx.Orders.FindAsync(id);

    // READ with Include (tương tự JOIN FETCH / @EntityGraph)
    public async Task<Order?> FindWithItemsAsync(int id)
        => await _ctx.Orders
            .Include(o => o.User)
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);

    // READ-ONLY — AsNoTracking tương tự JPA detached
    public async Task<List<Order>> GetAllReadOnlyAsync()
        => await _ctx.Orders
            .AsNoTracking()
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

    // UPDATE
    public async Task UpdateStatusAsync(int id, string status) {
        var order = await _ctx.Orders.FindAsync(id)
            ?? throw new NotFoundException($"Order {id} not found");
        order.Status = status;            // change tracking tự detect
        await _ctx.SaveChangesAsync();    // UPDATE SQL chỉ cho changed fields
    }

    // DELETE
    public async Task DeleteAsync(int id) {
        var order = await _ctx.Orders.FindAsync(id)
            ?? throw new NotFoundException($"Order {id} not found");
        _ctx.Orders.Remove(order);
        await _ctx.SaveChangesAsync();
    }
}

// ============ LINQ QUERIES ============
// Tương tự JPQL/Criteria API — translate sang SQL

public async Task<List<OrderDto>> GetUserOrdersAsync(int userId, string? status) {
    var query = _ctx.Orders
        .AsNoTracking()
        .Where(o => o.UserId == userId);

    if (status is not null)
        query = query.Where(o => o.Status == status);

    return await query
        .Include(o => o.Items)
        .OrderByDescending(o => o.CreatedAt)
        .Select(o => new OrderDto(o.Id, o.Status, o.TotalAmount, o.Items.Count))
        .ToListAsync();
}

// Raw SQL khi LINQ không đủ (tương tự @NativeQuery JPA)
var orders = await _ctx.Orders
    .FromSqlRaw("SELECT * FROM orders WHERE status = {0}", status)
    .ToListAsync();

// ============ TRANSACTIONS ============

public async Task TransferAsync(int fromUserId, int toUserId, decimal amount) {
    // Explicit transaction
    await using var tx = await _ctx.Database.BeginTransactionAsync();
    try {
        var from = await _ctx.Users.FindAsync(fromUserId);
        var to   = await _ctx.Users.FindAsync(toUserId);

        from!.Balance -= amount;
        to!.Balance   += amount;

        await _ctx.SaveChangesAsync();
        await tx.CommitAsync();
    } catch {
        await tx.RollbackAsync();
        throw;
    }
}

// ============ MIGRATIONS ============

/*
# Tương tự Flyway migration nhưng code-first

# 1. Tạo migration sau khi thay đổi entity
dotnet ef migrations add AddOrderStatusIndex

# 2. Xem SQL sẽ chạy
dotnet ef migrations script

# 3. Apply lên DB
dotnet ef database update

# Generated migration file:
public partial class AddOrderStatusIndex : Migration {
    protected override void Up(MigrationBuilder migrationBuilder) {
        migrationBuilder.CreateIndex(
            name: "IX_orders_status",
            table: "orders",
            column: "status");
    }
    protected override void Down(MigrationBuilder migrationBuilder) {
        migrationBuilder.DropIndex(name: "IX_orders_status", table: "orders");
    }
}
*/

// ============ N+1 PROBLEM ============
// Giống JPA N+1 — fix bằng Include()

// ❌ N+1: 1 query lấy orders + N query lấy user của mỗi order
var orders = await _ctx.Orders.ToListAsync();
foreach (var order in orders) {
    Console.WriteLine(order.User.Name); // lazy load từng cái → N queries
}

// ✅ Fix: eager load
var orders2 = await _ctx.Orders
    .Include(o => o.User)
    .ToListAsync();  // 1 JOIN query
```

## Ứng Dụng Thực Tế

EF Core phổ biến nhất trong .NET ecosystem, hỗ trợ PostgreSQL (Npgsql), MySQL, SQL Server, SQLite. Migrate từ JPA/Hibernate sang EF Core: concept giống nhau (entity, relationship, lazy/eager loading, N+1), nhưng EF Core dùng LINQ thay JPQL, `Include()` thay `JOIN FETCH`, migrations built-in thay Flyway. Performance-sensitive code thường dùng Dapper (micro-ORM) song song EF Core — tương tự Java dùng MyBatis cho query phức tạp cạnh JPA.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>DbContext có nên Singleton hay Scoped?</strong></summary>

**A:** **Scoped** — tạo mới mỗi HTTP request, dispose sau khi request kết thúc. Lý do: DbContext không thread-safe, nếu Singleton thì multiple concurrent requests share cùng context → race condition. Scoped đảm bảo mỗi request có DbContext riêng, sau request context bị dispose và tất cả tracked entities bị clear. Nếu cần dùng DbContext trong background service (Singleton), inject `IDbContextFactory<T>` và tự tạo context: `using var ctx = factory.CreateDbContext()`.

</details>

<details>
<summary><strong>AsNoTracking() ảnh hưởng performance thế nào?</strong></summary>

**A:** EF Core mặc định track tất cả entity được load (change tracking) để detect thay đổi khi `SaveChanges()` được gọi. `AsNoTracking()` tắt tracking này: (1) **Nhanh hơn** — không cần snapshot entity, không cần compare khi SaveChanges; benchmark thường 20-30% nhanh hơn cho read-only. (2) **Ít memory hơn** — không giữ entity trong IdentityMap của context. (3) **Giới hạn**: không thể update/delete entity từ `AsNoTracking()` query trực tiếp — phải Attach lại hoặc query lại với tracking. Rule: **read-only → AsNoTracking, write-intent → tracking**.

</details>

<details>
<summary><strong>EF Core migrations vs Flyway — khác nhau gì?</strong></summary>

**A:** **EF Core migrations** là code-first: define entity → EF generate SQL migration từ diff với previous state → apply. Migration file là C# code, có thể custom. Nhược điểm: migrations có thể conflict trong team khi nhiều người cùng thêm migration. **Flyway** là script-based: dev tự viết SQL file, Flyway chỉ track version và apply — không generate gì. Ưu: explicit control SQL, dễ review, portable. Thực tế .NET: EF Core migrations cho project nhỏ/medium; Flyway/DbUp cho enterprise có DBA, cần review SQL trước deploy. Cả hai đều có `--dry-run` option để preview.

</details>
