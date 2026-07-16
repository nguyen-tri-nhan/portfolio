---
key: ruby-internals
title: "Ruby Internals — Object Model, Method Lookup & GC"
crumb: "21. Ruby > Ruby Internals"
---

Ruby object model là nền tảng để hiểu mọi thứ trong Ruby: tại sao `include` thêm method, tại sao `extend` khác nhau, cách method lookup đi qua ancestor chain. MRI Ruby GC là mark-and-sweep với generational collection từ Ruby 2.1. Hiểu internals giúp debug performance, memory, và metaprogramming behavior.

## Điểm Chính

- **Everything is an object**: Kể cả class là object của `Class`, method là object của `Method`/`UnboundMethod`
- **Singleton class (Eigenclass)**: Mỗi object có hidden class chứa singleton methods — nơi `def self.method` được lưu
- **Ancestor chain**: Method lookup đi qua: object's class → included modules (reversed) → superclass → Kernel → BasicObject
- **Method lookup order**: `prepend` → class → `include` modules (reverse order) → parent class
- **Garbage Collection**: MRI dùng generational mark-and-sweep (Ruby 2.1+) — Major GC (full), Minor GC (young gen)
- **Symbol GC**: Ruby 2.2+ collect dynamic symbols — không phải tất cả symbol là permanent
- **Object Shapes** (Ruby 3.2+): JIT-friendly optimization — same instance variable layout = same shape, faster access
- **YJIT** (Ruby 3.1+): Yet Another JIT — native code generation, significant speedup cho CPU-bound code

## Ví Dụ Code

```ruby
# ============ OBJECT MODEL ============

# Mọi thứ là object — kể cả class
puts 42.class           # => Integer
puts Integer.class      # => Class
puts Class.class        # => Class (class is instance of itself!)
puts Class.superclass   # => Module
puts Module.superclass  # => Object
puts Object.superclass  # => BasicObject
puts BasicObject.superclass  # => nil (root)

# Method là object
m = 42.method(:+)
puts m.class            # => Method
puts m.call(8)          # => 50 (gọi method object)

# Unbound method
um = Integer.instance_method(:to_s)
puts um.class           # => UnboundMethod
bound = um.bind(42)
puts bound.call         # => "42"

# ============ SINGLETON CLASS / EIGENCLASS ============

class Dog
  def bark
    "Woof!"
  end

  def self.species   # class method = singleton method của Dog object
    "Canis lupus"
  end
end

fido = Dog.new

# Singleton method cho specific object
def fido.roll_over
  "#{name} is rolling over!"
end

puts fido.roll_over           # ok
# Dog.new.roll_over           # NoMethodError — chỉ fido có

# Truy cập singleton class
fido_singleton_class = fido.singleton_class
puts fido_singleton_class     # => #<Class:#<Dog:0x...>>
puts fido_singleton_class.instance_methods(false)  # => [:roll_over]

# Singleton class hierarchy:
# fido → fido_singleton_class → Dog → Object → Kernel → BasicObject
puts fido.singleton_class.superclass    # => Dog
puts Dog.singleton_class.superclass     # => Class (Dog's singleton)

# ============ ANCESTOR CHAIN & METHOD LOOKUP ============

module Greetable
  def greet
    "Hello from Greetable"
  end
end

module Farewell
  def say_bye
    "Bye from Farewell"
  end
end

module Hookable
  def greet
    "[Hook] " + super  # super đi lên ancestor chain
  end
end

class Person
  include Greetable   # add sau superclass
  include Farewell
  prepend Hookable    # prepend ĐI TRƯỚC class trong lookup

  def greet
    "Hello from Person"
  end
end

# Ancestor chain
puts Person.ancestors.inspect
# => [Hookable, Person, Farewell, Greetable, Object, Kernel, BasicObject]
# Lưu ý: Hookable (prepend) đứng TRƯỚC Person
# Farewell và Greetable sau Person, reverse include order

p = Person.new
puts p.greet
# => "[Hook] Hello from Person"
# Hookable#greet → Person#greet

# ============ INCLUDE vs EXTEND vs PREPEND ============

module Logging
  def log(msg)
    puts "[LOG] #{msg}"
  end
end

class ServiceA
  include Logging   # log trở thành INSTANCE method
end

class ServiceB
  extend Logging    # log trở thành CLASS method
end

module Audited
  def save
    audit_record
    super   # gọi original save — prepend cho phép điều này
  end
  
  def audit_record
    puts "Auditing..."
  end
end

class OrderA
  prepend Audited   # Audited#save chạy TRƯỚC OrderA#save trong lookup
  
  def save
    puts "Saving..."
  end
end

a = ServiceA.new
a.log("hello")        # instance method: ok
ServiceB.log("hello") # class method: ok
# ServiceA.log("hello")  # NoMethodError
# ServiceB.new.log("hello")  # NoMethodError

# ============ OBJECT_ID & MEMORY ============

# Integers sử dụng immediate values — không allocate heap object
puts 1.object_id     # => 3  (2n+1 formula)
puts 2.object_id     # => 5
puts 1.object_id == 1.object_id   # => true (same immediate value)

# nil, true, false — special values
puts nil.object_id   # => 8
puts true.object_id  # => 2
puts false.object_id # => 0

# Symbol — unique per name
puts :hello.object_id == :hello.object_id  # => true (same object)

# String — mỗi lần new object (trừ frozen string literal)
puts "hello".object_id == "hello".object_id  # => false

# Frozen string — immutable, may be shared
str1 = "hello".freeze
str2 = "hello".freeze
# Ruby có thể reuse frozen strings

# ============ GARBAGE COLLECTION ============

# GC.stat — thông tin GC
stats = GC.stat
puts stats[:count]          # total GC runs
puts stats[:heap_live_slots] # live objects trên heap
puts stats[:heap_free_slots] # free slots
puts stats[:major_gc_count] # major GC count (expensive)
puts stats[:minor_gc_count] # minor GC count (cheap)

# ObjectSpace — enumerate all live objects
require 'objspace'

ObjectSpace.count_objects.tap do |counts|
  puts "Total T_OBJECT: #{counts[:T_OBJECT]}"
  puts "Total T_STRING: #{counts[:T_STRING]}"
  puts "Total T_ARRAY:  #{counts[:T_ARRAY]}"
end

# Memory profiling
require 'memory_profiler'

report = MemoryProfiler.report do
  # Code để profile
  1000.times { "hello" + " world" }
end

report.pretty_print(to_file: "memory_profile.txt")

# ObjectSpace.memsize_of — size của object trong bytes
require 'objspace'
puts ObjectSpace.memsize_of("hello")      # => 40 bytes (MRI overhead)
puts ObjectSpace.memsize_of([1,2,3])      # => 40 bytes (+ element pointers)
puts ObjectSpace.memsize_of({a: 1})       # => 192 bytes

# GC.compact (Ruby 2.7+) — compact heap, giảm fragmentation
GC.compact

# ============ FROZEN STRING LITERAL ============

# frozen_string_literal: true — tất cả string literal là frozen
# Giảm allocation đáng kể khi string không cần mutate

# Benchmark
require 'benchmark'
n = 1_000_000

Benchmark.bm do |x|
  x.report("regular:") { n.times { "hello world" } }
  x.report("frozen:")  { n.times { "hello world".freeze } }
  x.report("symbol:")  { n.times { :"hello" } }
end
# frozen và symbol thường nhanh hơn 2-3x vì không allocate

# ============ OBJECT SHAPES (RUBY 3.2+) ============

# Objects với cùng instance variable layout = same "shape" = faster property access
class Point
  def initialize(x, y)
    @x = x   # luôn set x trước, y sau
    @y = y   # consistent → same shape cho tất cả Point instances
  end
end

# ❌ Different shapes — JIT không optimize được
class BadPoint
  def initialize(x, y, label = nil)
    @x = x
    @label = label if label  # conditional → khác shape nếu label nil vs not
    @y = y
  end
end

# ============ METHOD CACHE ============

# Ruby cache method lookup result
# Bất kỳ thay đổi nào (define method, include module, monkey patch)
# đều invalidate global method cache

class MyClass
  def greet = "hello"
end

obj = MyClass.new
obj.greet  # => cache method location

# Monkey patch → invalidate cache
class MyClass
  def greet = "hi"  # redefine → cache cleared
end

obj.greet  # => "hi" (re-lookup)

# Benchmark — đo cache impact
require 'benchmark'
n = 5_000_000
obj = MyClass.new
Benchmark.bm do |x|
  x.report("cached:") { n.times { obj.greet } }
  # sau đó reopen class
  x.report("after monkey patch:") {
    class MyClass; def greet = "bye"; end
    n.times { obj.greet }  # chậm hơn lần đầu vì re-cache
  }
end
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Method lookup trong Ruby đi qua những bước nào?</strong></summary>

**A:** Ruby method lookup đi qua **ancestor chain** theo thứ tự: (1) Singleton class của object (singleton methods). (2) `prepend`ed modules của class (theo reverse order của prepend). (3) Class chính. (4) `include`d modules (reverse order — last included first). (5) Superclass. (6) Lặp lại 2-5 cho superclass. Kết thúc tại `BasicObject`. Nếu không tìm thấy → gọi `method_missing`. `super` tiếp tục tìm từ vị trí hiện tại trở lên. Ví dụ: `[Prepended, MyClass, LastIncluded, FirstIncluded, ParentClass, ..., Kernel, BasicObject]`. `prepend` quan trọng: nó insert module TRƯỚC class trong chain — cho phép module override class method và gọi `super` vào method gốc (AOP pattern).

</details>

<details>
<summary><strong>Ruby GC hoạt động thế nào? Có tuneable không?</strong></summary>

**A:** MRI Ruby GC (Ruby 2.1+) là **generational mark-and-sweep**: Minor GC (thường, nhanh) collect young generation (newly allocated objects — Eden heap). Major GC (ít, chậm) collect toàn bộ heap. Từ Ruby 2.2+: Incremental GC giảm pause time. Ruby 3.1+: YJIT + GC improvements. **Tuneable**: `RUBY_GC_HEAP_GROWTH_FACTOR` (default 1.8 — heap grow 80% khi đầy); `RUBY_GC_MALLOC_LIMIT` (trigger GC sau N malloc bytes); `RUBY_GC_OLDMALLOC_LIMIT` (cho old gen). Sidekiq tuning phổ biến: tăng `MALLOC_LIMIT` để giảm tần suất GC, giảm response time variance. Công cụ: `GC.stat`, `memory_profiler` gem, `ObjectSpace.allocation_sourcefile`. Benchmark: `GC.disable` trong tight loop (chỉ benchmark), so sánh với GC enabled.

</details>
