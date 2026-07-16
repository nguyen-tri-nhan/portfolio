---
key: ruby-oop
title: "Ruby OOP — Classes, Modules & Mixins"
crumb: "21. Ruby > OOP & Modules"
---

Ruby OOP giống Java ở class-based inheritance, nhưng khác ở chỗ không có interface — thay bằng Modules (mixins). Module trong Ruby giải quyết multiple inheritance mà Java dùng interface: `include` module vào class để "mixin" behavior. Duck typing thay polymorphism qua interface.

## Điểm Chính

- **attr_accessor**: Auto-generate getter + setter — tương tự Lombok `@Data`, không cần tự viết
- **initialize**: Constructor — tương tự Java constructor, gọi khi `ClassName.new(...)`
- **Modules as Mixins**: `include ModuleName` — đưa module methods vào class; giải quyết multiple inheritance
- **Comparable module**: `include Comparable` + define `<=>` → tự có `<, >, <=, >=, between?`
- **Enumerable module**: `include Enumerable` + define `each` → tự có `map, select, reduce, sort, min, max`
- **Duck typing**: Không check type, check behavior — `respond_to?(:method_name)` thay `instanceof`
- **Open classes**: Có thể reopen class đã define (kể cả built-in) và thêm method — "monkey patching"
- **Method visibility**: `public` (default), `protected` (trong hierarchy), `private` (chỉ trong class)
- **Class methods**: `def self.method_name` — tương tự Java `static` method

## Ví Dụ Code

```ruby
# ============ CLASS BASICS ============

class User
  # attr_accessor = getter + setter tự động (tương tự Lombok @Data)
  attr_accessor :name, :email
  attr_reader :id          # getter only (tương tự @Getter)
  attr_writer :password    # setter only (tương tự @Setter)

  # Class variable (tương tự Java static field — shared across instances)
  @@count = 0

  # initialize = constructor
  def initialize(id, name, email)
    @id    = id      # instance variable với @
    @name  = name
    @email = email
    @@count += 1
  end

  # Class method (tương tự Java static method)
  def self.count
    @@count
  end

  def self.create(name, email)
    new(SecureRandom.uuid, name, email)
  end

  # Instance method
  def to_s
    "User(#{@id}, #{@name}, #{@email})"
  end

  # Private method
  private

  def validate_email
    @email.include?("@")
  end
end

# Usage
user = User.new("1", "Alice", "alice@example.com")
puts user.name         # => "Alice" (attr_reader)
user.name = "Bob"      # attr_writer qua attr_accessor
puts User.count        # => 1 (class method)

user2 = User.create("Charlie", "charlie@example.com")

# ============ INHERITANCE ============

class AdminUser < User     # < = extends trong Java
  attr_accessor :role

  def initialize(id, name, email, role)
    super(id, name, email)   # gọi parent constructor
    @role = role
  end

  def to_s
    "Admin(#{@name}, role: #{@role})"
  end

  def can_delete?
    @role == :super_admin
  end
end

admin = AdminUser.new("2", "Dave", "dave@example.com", :super_admin)
puts admin.can_delete?   # => true
puts admin.to_s          # => "Admin(Dave, role: super_admin)"
puts admin.is_a?(User)   # => true (inheritance check)

# ============ MODULES AS MIXINS ============
# Thay cho interface trong Java — cho phép "multiple inheritance"

module Timestampable
  def created_at
    @created_at ||= Time.now
  end

  def updated_at
    @updated_at
  end

  def touch!
    @updated_at = Time.now
  end
end

module Auditable
  def audit_log
    @audit_log ||= []
  end

  def log_action(action, user)
    @audit_log << { action: action, user: user, at: Time.now }
  end
end

# include nhiều modules (không thể extends nhiều class trong Java)
class Order
  include Timestampable
  include Auditable

  attr_accessor :status

  def initialize
    @status = :pending
  end

  def approve!(approver)
    @status = :approved
    touch!
    log_action("approved", approver)
  end
end

order = Order.new
order.approve!("Alice")
puts order.status           # => approved
puts order.audit_log.first  # => {action: "approved", user: "Alice", ...}

# ============ COMPARABLE MODULE ============
# Include để có <, >, <=, >=, between?, sort

class Product
  include Comparable   # chỉ cần define <=> operator

  attr_accessor :name, :price

  def initialize(name, price)
    @name  = name
    @price = price
  end

  def <=>(other)    # "spaceship" operator
    @price <=> other.price
  end
end

products = [
  Product.new("C", 30),
  Product.new("A", 10),
  Product.new("B", 20)
]

puts products.min.name    # => "A"
puts products.max.name    # => "C"
puts products.sort.map(&:name).inspect  # => ["A", "B", "C"]
puts products[0].between?(products[1], products[2])  # works!

# ============ ENUMERABLE MODULE ============
# Include để có map, select, reduce, sort, min, max, flat_map...

class NumberCollection
  include Enumerable   # chỉ cần define each

  def initialize(*nums)
    @nums = nums
  end

  def each(&block)
    @nums.each(&block)
  end
end

coll = NumberCollection.new(3, 1, 4, 1, 5, 9)
puts coll.select { |n| n > 3 }.inspect  # [4, 5, 9]
puts coll.map { |n| n * 2 }.inspect     # [6, 2, 8, 2, 10, 18]
puts coll.min    # 1
puts coll.max    # 9
puts coll.sum    # 23
puts coll.sort.inspect  # [1, 1, 3, 4, 5, 9]

# ============ DUCK TYPING ============
# "If it walks like a duck and quacks like a duck, it's a duck"
# Không cần implement interface — chỉ cần có method đúng tên

class Dog
  def speak
    "Woof!"
  end
end

class Cat
  def speak
    "Meow!"
  end
end

class Robot
  def speak
    "Beep boop"
  end
end

def make_speak(creature)
  # Không check type — chỉ gọi method
  # Nếu object không có speak → NoMethodError (runtime)
  puts creature.speak
end

[Dog.new, Cat.new, Robot.new].each { |c| make_speak(c) }

# Safe duck typing check
def make_speak_safe(creature)
  if creature.respond_to?(:speak)
    puts creature.speak
  else
    puts "#{creature.class} can't speak"
  end
end

# ============ OPEN CLASSES — MONKEY PATCHING ============
# Reopen class đã exist và thêm method (kể cả built-in class)

# Thêm method vào Integer
class Integer
  def factorial
    return 1 if self <= 1
    self * (self - 1).factorial
  end

  def minutes
    self * 60
  end
end

puts 5.factorial    # => 120
puts 5.minutes      # => 300 (seconds)
sleep 5.minutes     # đọc như English!

# Thêm method vào String
class String
  def palindrome?
    self == self.reverse
  end

  def word_count
    split.length
  end
end

puts "racecar".palindrome?              # => true
puts "hello world".word_count          # => 2

# ⚠️ Cẩn thận với monkey patching — có thể conflict với gems khác
# Prefer: refinements (scoped monkey patching, Ruby 2+)

# ============ STRUCT ============
# Lightweight value object — tương tự Kotlin data class nhưng đơn giản hơn

Point = Struct.new(:x, :y) do
  def distance_to(other)
    Math.sqrt((x - other.x) ** 2 + (y - other.y) ** 2)
  end

  def to_s
    "(#{x}, #{y})"
  end
end

p1 = Point.new(0, 0)
p2 = Point.new(3, 4)
puts p1.distance_to(p2)  # => 5.0
puts p1 == Point.new(0, 0)  # => true (value equality)
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Module và Class khác nhau thế nào? Khi nào dùng cái nào?</strong></summary>

**A:** **Class**: instantiatable (có thể `.new`), có inheritance chain, có state (instance variables). **Module**: không instantiatable, dùng như namespace hoặc mixin — `include` để thêm instance methods vào class, `extend` để thêm class methods. Khi nào dùng: (1) **Module as mixin**: behavior chia sẻ không liên quan đến hierarchy (Timestampable, Auditable, Serializable) — Java thay bằng interface với default methods. (2) **Module as namespace**: group related classes (`module Authentication; class JWT...; end`). (3) **Class**: khi cần instantiate, có state riêng, có inheritance. Rule: Module khi hành vi không cần state riêng; Class khi cần object với identity và state.

</details>

<details>
<summary><strong>Monkey patching có vấn đề gì? Có cách nào an toàn hơn không?</strong></summary>

**A:** Monkey patching (reopen class) có vấn đề: (1) **Global scope** — thay đổi ảnh hưởng toàn bộ codebase kể cả gems; (2) **Conflict** — hai gem cùng thêm method tên giống nhau → hành vi không đoán được; (3) **Upgrade risk** — Ruby version mới có thể thêm method cùng tên với implementation khác. **Refinements** (Ruby 2.0+) là giải pháp an toàn hơn: monkey patch chỉ có effect trong file/module activate nó — không leak ra ngoài:

```ruby
module StringExtensions
  refine String do
    def palindrome? = self == reverse
  end
end

class MyClass
  using StringExtensions  # chỉ có effect trong MyClass
  def check = "racecar".palindrome?  # true
end

"racecar".palindrome?  # NoMethodError — refinement không leak!
```

</details>
