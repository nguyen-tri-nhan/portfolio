---
key: ruby-metaprogramming
title: "Ruby Metaprogramming — Code that writes Code"
crumb: "21. Ruby > Metaprogramming"
---

Ruby metaprogramming là khả năng viết code thao tác với code khác tại runtime — define method động, intercept missing method call, eval code trong context của object. Đây là nền tảng của Rails magic: `has_many`, `validates`, `attr_accessor`, `scope` đều là metaprogramming. Java không có equivalent native — annotation processor gần nhất nhưng ở compile time.

## Điểm Chính

- **define_method**: Tạo method động tại runtime — dùng trong loop để generate nhiều method tương tự
- **method_missing**: Intercept call đến method không tồn tại — foundation của dynamic proxy, DSL
- **respond_to_missing?**: Pair với `method_missing` — đảm bảo `respond_to?` và introspection đúng
- **class_eval / module_eval**: Eval code trong context của class — thêm method, attribute tại runtime
- **instance_eval**: Eval code trong context của object — DSL builder pattern
- **send**: Gọi method bằng tên (string/symbol) — dynamic dispatch
- **const_get / const_set**: Lấy/set constant (class, module) bằng tên string
- **Hooks**: `included`, `extended`, `prepended`, `inherited`, `method_added` — callbacks khi module/class modified
- **Binding**: Capture execution context — dùng trong `eval` và template engine

## Ví Dụ Code

```ruby
# ============ DEFINE_METHOD ============

class Report
  # Generate methods động từ list
  FORMATS = %w[pdf csv excel json].freeze

  FORMATS.each do |format|
    define_method("export_#{format}") do
      export_to(format)
    end

    define_method("#{format}_available?") do
      @available_formats.include?(format)
    end
  end
end

# report = Report.new
# report.export_pdf       ← generated dynamically
# report.pdf_available?   ← generated dynamically

# define_method với closure — capture variable
class ApiClient
  ENDPOINTS = {
    users:    "/api/users",
    orders:   "/api/orders",
    products: "/api/products"
  }.freeze

  ENDPOINTS.each do |name, path|
    define_method("get_#{name}") do |id = nil|
      url = id ? "#{path}/#{id}" : path
      get(url)
    end
  end
end

# client.get_users
# client.get_orders(42)

# ============ METHOD_MISSING ============

class DynamicFinder
  def initialize(records)
    @records = records
  end

  # Rails-style dynamic finders: find_by_name, find_by_email_and_status
  def method_missing(method_name, *args)
    if method_name.to_s.start_with?("find_by_")
      attribute = method_name.to_s.sub("find_by_", "")
      value     = args.first
      @records.find { |r| r.send(attribute) == value }
    else
      super  # IMPORTANT: delegate lên để không swallow other errors
    end
  end

  def respond_to_missing?(method_name, include_private = false)
    method_name.to_s.start_with?("find_by_") || super
  end
end

finder = DynamicFinder.new(users)
finder.find_by_email("alice@example.com")
finder.find_by_name("Bob")
finder.respond_to?(:find_by_email)  # => true (vì respond_to_missing?)

# ============ CLASS_EVAL — ADD METHOD TO EXISTING CLASS ============

# Thêm method vào class tại runtime
String.class_eval do
  def palindrome?
    self == self.reverse
  end

  def word_count
    split.length
  end
end

"racecar".palindrome?   # => true
"hello world".word_count # => 2

# Dùng trong gem/plugin để extend class
module Searchable
  def self.included(base)
    base.class_eval do
      # Tương đương viết trực tiếp vào class
      def self.search(query)
        where("name LIKE ?", "%#{query}%")
      end

      scope :recent, -> { order(created_at: :desc).limit(10) }
    end
  end
end

# ============ INSTANCE_EVAL — DSL BUILDER ============

class Config
  attr_reader :host, :port, :timeout

  def initialize(&block)
    @timeout = 30
    instance_eval(&block) if block_given?  # run block in context of self
  end

  def host(value = nil)
    value ? @host = value : @host
  end

  def port(value = nil)
    value ? @port = value : @port
  end

  def timeout(value = nil)
    value ? @timeout = value : @timeout
  end
end

# Clean DSL syntax
config = Config.new do
  host    "api.example.com"
  port    443
  timeout 60
end

# Rails-style DSL (ActiveRecord):
# has_many :orders, dependent: :destroy
# validates :email, presence: true, uniqueness: true

# ============ SEND — DYNAMIC METHOD DISPATCH ============

class User
  def name    = @name
  def email   = @email
  private
  def secret  = "hidden"
end

user = User.new
user.send(:name)   # gọi public method bằng symbol
user.send(:secret) # send có thể gọi private method

# public_send — không gọi được private
user.public_send(:name)    # ok
user.public_send(:secret)  # NoMethodError

# Dynamic dispatch — thay if/else dài
HANDLERS = { create: :handle_create, update: :handle_update, delete: :handle_delete }

def process(action, payload)
  handler = HANDLERS[action]
  send(handler, payload) if handler  # dynamic dispatch
end

# ============ HOOKS ============

module Trackable
  def self.included(base)
    puts "Trackable included in #{base}"
    base.extend(ClassMethods)
    base.instance_variable_set(:@tracked_attrs, [])
  end

  module ClassMethods
    def track(*attrs)
      @tracked_attrs.concat(attrs)
      puts "Tracking: #{attrs.join(', ')} in #{self}"
    end

    def tracked_attrs
      @tracked_attrs
    end
  end

  def self.extended(base)
    puts "Trackable extended by #{base}"
  end
end

class User
  include Trackable
  track :name, :email, :role  # calls ClassMethods#track
end

# method_added hook — gọi khi method được định nghĩa
module Logging
  def self.included(base)
    base.extend(ClassMethods)
  end

  module ClassMethods
    def method_added(method_name)
      return if @_adding_method  # guard: tránh infinite loop
      return if method_name.to_s.start_with?("logged_")

      original = instance_method(method_name)
      @_adding_method = true
      define_method(method_name) do |*args, &block|
        puts "Calling #{method_name} with #{args.inspect}"
        result = original.bind(self).call(*args, &block)
        puts "#{method_name} returned #{result.inspect}"
        result
      end
      @_adding_method = false
    end
  end
end

# ============ CONST_GET — DYNAMIC CLASS REFERENCE ============

# Khởi tạo class từ string name
class_name = "UserService"
klass = Object.const_get(class_name)   # tương tự Java Class.forName()
instance = klass.new

# Factory pattern
def create_handler(type)
  klass_name = "#{type.to_s.camelize}Handler"
  Object.const_get(klass_name).new
rescue NameError
  raise "Unknown handler type: #{type}"
end

# ============ ATTR_ACCESSOR — HOW IT WORKS ============

# attr_accessor là metaprogramming built-in
# Equivalent thủ công:
class MyClass
  def self.my_attr(*names)
    names.each do |name|
      define_method(name)        { instance_variable_get("@#{name}") }
      define_method("#{name}=")  { |val| instance_variable_set("@#{name}", val) }
    end
  end

  my_attr :name, :email, :age
end

# user = MyClass.new
# user.name = "Alice"
# user.name  # => "Alice"
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>method_missing có vấn đề gì? Luôn phải làm gì khi dùng?</strong></summary>

**A:** Vấn đề của `method_missing`: (1) **Performance** — method lookup phải đi qua toàn bộ ancestor chain trước khi hit `method_missing`, chậm hơn method thật; (2) **Debug khó** — stack trace không rõ ràng; (3) **respond_to? sai** — object không `respond_to?` method dynamically handled mặc dù nó handle được. Luôn phải: (1) **`super` khi không handle** — nếu không, method_missing swallow mọi NoMethodError; (2) **Override `respond_to_missing?`** — đảm bảo `respond_to?(:dynamic_method)` trả về true; (3) **Cân nhắc `define_method` thay** — nếu dynamic methods là finite set, define upfront sẽ nhanh hơn và debuggable hơn.

</details>

<details>
<summary><strong>instance_eval vs class_eval — khác nhau thế nào?</strong></summary>

**A:** **`instance_eval`**: block chạy với `self` là object đó — dùng cho singleton method, DSL builder, open specific object. Method defined trong `instance_eval` là singleton method (chỉ object đó có). **`class_eval` / `module_eval`**: block chạy với `self` là class/module — dùng để thêm instance method vào class, tương đương viết trực tiếp trong class body. Method defined trong `class_eval` là instance method (tất cả instances đều có). Rule: `instance_eval` cho 1 object cụ thể; `class_eval` cho toàn bộ instances của class. Ví dụ: `Config.new { host "..." }` dùng `instance_eval` — DSL chạy trong context của config object đó; `String.class_eval { def palindrome? ... }` thêm method cho tất cả String.

</details>
