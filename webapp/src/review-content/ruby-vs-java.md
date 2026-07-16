---
key: ruby-vs-java
title: "Ruby vs Java — So Sánh Cho Java Dev"
crumb: "21. Ruby > Ruby vs Java"
---

Ruby và Java đều OOP nhưng ở hai thái cực: Java — static typing, verbose, compile-time safety; Ruby — dynamic typing, concise, runtime flexibility. Java dev thường bị "sốc văn hóa" khi sang Ruby: không có type, không có compiler error, nhưng code ngắn hơn 3-5x và iterative development nhanh hơn nhiều.

## Điểm Chính

- **Static vs Dynamic typing**: Java compiler bắt type error trước runtime; Ruby phát hiện type error tại runtime — `NoMethodError` thay `NullPointerException`
- **Compiled vs Interpreted**: Java compile → bytecode → JVM; Ruby interpret trực tiếp — startup nhanh hơn, nhưng JIT của JVM mature hơn
- **Performance**: JVM (JIT + GC tuning) nhanh hơn MRI Ruby đáng kể; Ruby 3.x có YJIT (native code gen) cải thiện nhiều nhưng vẫn chậm hơn Java
- **GIL**: MRI Ruby có Global Interpreter Lock — chỉ 1 thread Ruby chạy cùng lúc dù multi-core; Java JVM không có GIL — true parallelism
- **Concurrency**: Ruby GIL → dùng processes thay threads (Puma multi-process); Java dùng threads tự nhiên
- **Ecosystem**: Java có Maven Central khổng lồ; Ruby có RubyGems (đủ nhưng nhỏ hơn)
- **Tooling**: Java có IntelliJ/Eclipse với full type inference; Ruby IDE support yếu hơn vì dynamic typing
- **Testing**: RSpec là DSL test đẹp nhất trong web dev — ảnh hưởng rất nhiều test framework khác

## Bảng So Sánh

| | Java | Ruby |
|---|---|---|
| Typing | Static (compile-time) | Dynamic (runtime) |
| Execution | JVM bytecode + JIT | Interpreted (MRI/YJIT) |
| Null safety | NPE at runtime | nil, NoMethodError |
| Concurrency | True threads | GIL → multi-process |
| Verbosity | Cao | Thấp (~3-5x ngắn hơn) |
| Performance | Cao (JIT mature) | Trung bình (YJIT improving) |
| Error detection | Compile time | Runtime |
| Web framework | Spring Boot | Ruby on Rails |
| ORM | JPA/Hibernate | ActiveRecord |
| Test framework | JUnit/Mockito | RSpec/Minitest |
| Package manager | Maven/Gradle | Bundler/RubyGems |

## Ví Dụ Code — Cùng Tác Vụ

```ruby
# ============ NULL HANDLING ============

# Java
# String city = user.getAddress().getCity();  // NPE nếu address null
# String city = Optional.ofNullable(user)
#   .map(User::getAddress)
#   .map(Address::getCity)
#   .orElse("Unknown");

# Ruby — nil safe với &. operator
city = user&.address&.city || "Unknown"
# &. (safe navigation operator) = Kotlin ?. = Java Optional.map()

# ============ COLLECTIONS ============

# Java
# List<String> names = users.stream()
#   .filter(u -> u.getAge() >= 18)
#   .map(User::getName)
#   .sorted()
#   .collect(Collectors.toList());

# Ruby
names = users
  .select { |u| u.age >= 18 }
  .map(&:name)
  .sort

# ============ HTTP ENDPOINT ============

# Java Spring Boot
# @GetMapping("/users/{id}")
# public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
#     return userService.findById(id)
#         .map(ResponseEntity::ok)
#         .orElse(ResponseEntity.notFound().build());
# }

# Ruby on Rails
# def show
#   user = User.find_by(id: params[:id])
#   user ? render(json: user) : head(:not_found)
# end

# ============ DEPENDENCY INJECTION ============

# Java Spring
# @Service
# public class OrderService {
#     @Autowired private UserRepository userRepo;
#     @Autowired private EmailService emailService;
# }

# Ruby — không có built-in DI, dùng constructor injection thủ công
# hoặc dùng gem (dry-container, dry-auto_inject)
class OrderService
  def initialize(user_repo: UserRepository.new, email_service: EmailService.new)
    @user_repo     = user_repo
    @email_service = email_service
  end
end

# Hoặc Rails style — direct instantiate (ít testable hơn)
class OrderService
  def initialize
    @user_repo     = UserRepository.new
    @email_service = EmailService.new
  end
end

# ============ EXCEPTION HANDLING ============

# Java
# try {
#     order = orderService.create(request);
# } catch (InsufficientStockException e) {
#     return ResponseEntity.badRequest().body(e.getMessage());
# } catch (Exception e) {
#     return ResponseEntity.internalServerError().build();
# }

# Ruby
begin
  order = OrderService.new.create(order_params)
  render json: order, status: :created
rescue InsufficientStockError => e
  render json: { error: e.message }, status: :bad_request
rescue => e   # catch all StandardError
  logger.error e
  render json: { error: "Internal error" }, status: :internal_server_error
end

# ============ CONCURRENCY ============

# Java — true threads
# ExecutorService pool = Executors.newFixedThreadPool(10);
# Future<Result> f = pool.submit(() -> heavyComputation());

# Ruby — GIL: threads chia sẻ không đồng thời cho CPU-bound
# IO-bound: threads vẫn hiệu quả (GIL release khi IO wait)

# IO-bound — thread ok
threads = urls.map do |url|
  Thread.new { fetch_url(url) }
end
results = threads.map(&:value)

# CPU-bound — cần processes
require 'parallel'
results = Parallel.map(items, in_processes: 4) { |item| heavy_compute(item) }

# ============ METAPROGRAMMING ============
# Ruby có metaprogramming mạnh — không có equivalent trong Java thường

# define_method — tạo method động
class Report
  %w[pdf csv excel].each do |format|
    define_method("export_#{format}") do
      export_to(format)
    end
  end
end

# report = Report.new
# report.export_pdf   ← method được tạo động
# report.export_csv

# method_missing — intercept method không tồn tại
class DynamicProxy
  def initialize(target)
    @target = target
  end

  def method_missing(method_name, *args, &block)
    if @target.respond_to?(method_name)
      puts "Calling #{method_name} on target"
      @target.send(method_name, *args, &block)
    else
      super
    end
  end

  def respond_to_missing?(method_name, include_private = false)
    @target.respond_to?(method_name) || super
  end
end

# ============ TESTING — RSPEC ============
# RSpec là best-in-class test DSL — ảnh hưởng nhiều framework khác

RSpec.describe OrderService do
  subject(:service) { described_class.new(user_repo:, email_service:) }

  let(:user_repo)     { instance_double(UserRepository) }
  let(:email_service) { instance_double(EmailService) }
  let(:user)          { build(:user, balance: 100) }

  describe "#create" do
    context "when user has sufficient balance" do
      before do
        allow(user_repo).to receive(:find).with(user.id).and_return(user)
        allow(email_service).to receive(:send_confirmation)
      end

      it "creates an order and sends confirmation" do
        order = service.create(user_id: user.id, amount: 50)

        expect(order).to be_persisted
        expect(order.status).to eq(:pending)
        expect(email_service).to have_received(:send_confirmation).once
      end
    end

    context "when user has insufficient balance" do
      it "raises InsufficientFundsError" do
        allow(user_repo).to receive(:find).and_return(build(:user, balance: 0))

        expect { service.create(user_id: user.id, amount: 100) }
          .to raise_error(InsufficientFundsError)
      end
    end
  end
end
```

## Ứng Dụng Thực Tế

Chọn Ruby khi: team nhỏ cần ship nhanh, CRUD-heavy web app, startup MVP — Rails convention giảm thời gian bootstrap đáng kể. Chọn Java khi: cần performance, type safety trong team lớn, distributed systems, microservices ở scale lớn. Nhiều công ty mix: backend service phức tạp dùng Java/Go, internal tool/dashboard dùng Rails.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>GIL trong Ruby là gì và tại sao không có trong Java?</strong></summary>

**A:** GIL (Global Interpreter Lock) là mutex trong MRI Ruby runtime ngăn nhiều thread execute Ruby code cùng lúc — tại một thời điểm chỉ 1 thread chạy, dù có nhiều CPU core. Lý do tồn tại: MRI memory model và garbage collector không thread-safe, GIL là cách đơn giản để bảo vệ. **Hệ quả**: CPU-bound multi-thread Ruby không benefit từ multi-core; IO-bound vẫn ok vì GIL release khi thread wait IO. Java JVM không có GIL — JVM memory model và GC được design cho true concurrency từ đầu (happens-before, volatile, synchronized). Ruby alternatives: JRuby (JVM-based, không có GIL, true threads), Ractors (Ruby 3+, experimental isolation model).

</details>

<details>
<summary><strong>Java dev nên expect gì khi làm việc với Ruby codebase?</strong></summary>

**A:** Khác biệt lớn nhất: (1) **Không có compile-time error** — type bug chỉ phát hiện khi chạy, cần test coverage cao để bù. (2) **Magic từ metaprogramming** — `has_many`, `validates`, `before_action` là method call, không phải annotation; behavior generated dynamically. (3) **Duck typing** — không có interface contract tường minh, cần đọc code + tests để hiểu expected behavior. (4) **Mutable everything** — string, hash có thể thay đổi unexpected, cần cẩn thận khi pass vào method. (5) **Convention rất quan trọng** — Rails expects naming đúng (Model → table, Controller → routes); sai convention → silent failure. Lời khuyên: đọc Rails Guide từ đầu, viết test trước, dùng RuboCop (linter), trust convention thay vì fight nó.

</details>
