---
key: ruby-basics
title: "Ruby — Syntax & Core Concepts"
crumb: "21. Ruby > Ruby Cơ Bản"
---

Ruby là dynamic, interpreted language với triết lý "developer happiness" — mọi thứ đều là object, syntax đọc gần tiếng Anh, và ngôn ngữ có nhiều cách làm cùng một việc (TIMTOWTDI). Java dev sẽ thấy Ruby ít ceremony hơn rất nhiều — không cần khai báo type, không cần getter/setter, không cần `public static void main`.

## Điểm Chính

- **Everything is an object**: `1.class` → `Integer`, `nil.class` → `NilClass`, kể cả `true/false` là object
- **Dynamic typing**: Không khai báo type — interpreter detect tại runtime; duck typing thay inheritance
- **Blocks**: Anonymous code chunks truyền vào method — foundation của Ruby syntax đặc trưng (`each`, `map`, `select`)
- **Symbols vs String**: `:name` là lightweight immutable identifier — dùng làm key hash, method name; `:name == :name` luôn same object
- **Nil thay null**: `nil` là object của `NilClass`, `nil.nil?` → true; không có `NullPointerException` — thay thế là `NoMethodError`
- **Truthy/Falsy**: Chỉ `false` và `nil` là falsy — `0`, `""`, `[]` đều truthy (khác Java!)
- **String interpolation**: `"Hello #{name}"` — tương tự Kotlin/C#
- **Multiple return values**: Method có thể return array, destructure: `a, b = method_call`
- **Mutable strings**: String trong Ruby mutable (khác Java immutable String) — dùng `freeze` để immutable

## Ví Dụ Code

```ruby
# ============ BASICS — NO CEREMONY ============

# Không cần type declaration, không cần semicolon
name = "Alice"
age  = 30
pi   = 3.14159

# String interpolation
puts "Hello #{name}, you are #{age} years old"
puts "Next year: #{age + 1}"

# Multiple assignment
x, y, z = 1, 2, 3
a, *rest = [1, 2, 3, 4, 5]  # splat operator
# a = 1, rest = [2, 3, 4, 5]

# ============ EVERYTHING IS OBJECT ============

1.class          # => Integer
1.0.class        # => Float
"hello".class    # => String
nil.class        # => NilClass
true.class       # => TrueClass
[].class         # => Array

# Method chaining trên primitives
-5.abs           # => 5  (không cần Math.abs(-5) như Java)
"hello".upcase   # => "HELLO"
3.times { puts "hi" }  # in "hi" 3 lần

# ============ TRUTHY/FALSY — KHÁC JAVA! ============

# Chỉ false và nil là falsy
if 0         # truthy! (khác Java)
  puts "0 is truthy"
end

if ""        # truthy! (khác Java)
  puts "empty string is truthy"
end

if []        # truthy!
  puts "empty array is truthy"
end

if nil       # falsy
  puts "này không chạy"
end

# Safe check
value = nil
puts value.nil?      # true
puts value.is_a?(String)  # false (không throw NPE)

# ============ SYMBOLS ============

# Symbol — immutable, lightweight, thường dùng làm hash key
status = :active
puts status       # => active
puts status.class # => Symbol

# Symbol vs String
":name".object_id != ":name".object_id  # String mới mỗi lần
:name.object_id == :name.object_id      # Symbol luôn same object — efficient

# Hash với symbol key (phổ biến nhất trong Ruby)
user = { name: "Alice", age: 30, status: :active }
puts user[:name]    # => "Alice"
puts user[:status]  # => active

# ============ BLOCKS — ĐẶC TRƯNG RUBY ============
# Block = anonymous function truyền vào method
# {} cho single line, do...end cho multi-line

# each — tương tự Java forEach
[1, 2, 3, 4, 5].each { |n| puts n }

[1, 2, 3].each do |n|
  puts "Number: #{n}"
  puts "Squared: #{n ** 2}"
end

# map — tương tự Java Stream.map() / Kotlin .map()
squares = [1, 2, 3, 4].map { |n| n ** 2 }
# => [1, 4, 9, 16]

names = ["alice", "bob", "charlie"].map(&:upcase)
# => ["ALICE", "BOB", "CHARLIE"]
# &:upcase là shorthand cho { |s| s.upcase }

# select — tương tự filter
evens = [1, 2, 3, 4, 5, 6].select { |n| n.even? }
# => [2, 4, 6]

# reject — inverse của select
odds = [1, 2, 3, 4, 5].reject { |n| n.even? }
# => [1, 3, 5]

# reduce/inject — tương tự Java Stream.reduce()
sum = [1, 2, 3, 4, 5].reduce(0) { |acc, n| acc + n }
# => 15
sum2 = [1, 2, 3, 4, 5].sum  # shorthand

# Chaining
result = [1, 2, 3, 4, 5, 6]
  .select { |n| n.even? }
  .map { |n| n * 10 }
  .reject { |n| n > 40 }
# => [20, 40]

# ============ METHODS ============

def greet(name, greeting: "Hello")  # keyword argument với default
  "#{greeting}, #{name}!"
end

puts greet("Alice")              # => "Hello, Alice!"
puts greet("Bob", greeting: "Hi") # => "Hi, Bob!"

# Implicit return — last expression là return value (không cần `return`)
def square(n)
  n * n  # auto return
end

# Multiple return values (thực ra là Array destructuring)
def min_max(array)
  [array.min, array.max]
end

min, max = min_max([3, 1, 4, 1, 5, 9])
# min = 1, max = 9

# ============ CONDITIONAL EXPRESSIONS ============

# If as expression
status = if age >= 18 then "adult" else "minor" end

# Ternary (giống Java)
label = age >= 18 ? "adult" : "minor"

# Unless (inverse of if)
unless user.nil?
  puts user[:name]
end

# Inline condition (suffix if/unless)
puts "Welcome!" if logged_in
puts "Please login" unless logged_in

# Case/when — tương tự Java switch nhưng mạnh hơn
result = case status
when :active   then "User is active"
when :inactive then "User is inactive"
when :banned   then "User is banned"
else                "Unknown status"
end

# Case với ranges
grade = case score
when 90..100 then "A"
when 80..89  then "B"
when 70..79  then "C"
else              "F"
end

# ============ RANGES ============
(1..5).to_a     # => [1, 2, 3, 4, 5] (inclusive)
(1...5).to_a    # => [1, 2, 3, 4]    (exclusive end)

(1..10).select(&:even?)  # => [2, 4, 6, 8, 10]
('a'..'e').to_a          # => ["a", "b", "c", "d", "e"]

# ============ STRING METHODS ============
str = "Hello, World!"
str.length          # 13
str.upcase          # "HELLO, WORLD!"
str.downcase        # "hello, world!"
str.reverse         # "!dlroW ,olleH"
str.include?("World")  # true
str.start_with?("Hello") # true
str.split(", ")     # ["Hello", "World!"]
str.strip           # remove whitespace
str.gsub("o", "0") # "Hell0, W0rld!" (global substitution)
str.sub("o", "0")  # "Hell0, World!" (first only)

# Heredoc — multiline string
text = <<~HEREDOC
  Line 1
  Line 2
  Line 3
HEREDOC
```

## Ứng Dụng Thực Tế

Ruby syntax đặc biệt quen thuộc với backend dev có Kotlin background — cả hai đều functional style, extension functions/methods, concise. Block syntax là pattern quan trọng nhất: `File.open("file.txt") { |f| f.read }` tự động close file sau block — tương tự Java try-with-resources nhưng ngắn hơn nhiều.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Symbol khác String thế nào trong Ruby?</strong></summary>

**A:** Symbol (`:name`) là immutable, frozen object — cùng symbol có cùng `object_id` trong toàn bộ process, không allocate memory mới mỗi lần. String (`"name"`) là mutable, mỗi lần tạo là object mới trên heap. Symbol phù hợp làm hash key (performance hơn String key), method name, status/flag values. String phù hợp khi cần manipulate text, concatenate, pass đến user. Ruby 3.x: String literal cũng được frozen theo default với `# frozen_string_literal: true`, giảm allocation cho String constant.

</details>

<details>
<summary><strong>Block, Proc, và Lambda khác nhau thế nào?</strong></summary>

**A:** **Block**: anonymous code truyền vào method với `{}` hoặc `do...end` — không phải object, không thể lưu vào variable. **Proc**: Block được object hóa — `my_proc = Proc.new { |x| x * 2 }` — có thể lưu, truyền, reuse. **Lambda**: Proc đặc biệt với arity checking và `return` behavior riêng — `my_lambda = lambda { |x| x * 2 }` hoặc `-> (x) { x * 2 }`. Khác nhau chính: (1) Arity — Lambda throw `ArgumentError` nếu sai số argument; Proc không. (2) `return` — Lambda return khỏi lambda; Proc return khỏi method chứa nó. Lambda behavior predictable hơn → prefer Lambda khi cần reusable callable.

</details>
