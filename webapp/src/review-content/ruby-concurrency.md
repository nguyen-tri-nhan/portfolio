---
key: ruby-concurrency
title: "Ruby Concurrency — Threads, GIL & Fibers"
crumb: "21. Ruby > Concurrency"
---

Ruby concurrency bị ảnh hưởng lớn bởi GIL (Global Interpreter Lock) trong MRI — chỉ 1 thread chạy Ruby code tại một thời điểm. IO-bound: thread vẫn hiệu quả (GIL release khi IO wait). CPU-bound: phải dùng processes. Fibers là lightweight coroutine — cooperative multitasking không cần OS thread. Ractors (Ruby 3+) là actor-based parallelism không có GIL.

## Điểm Chính

- **GIL (Global Interpreter Lock)**: MRI chỉ cho 1 thread execute Ruby code cùng lúc — CPU-bound threads không parallel; IO-bound vẫn concurrent
- **Thread**: `Thread.new { }` — OS thread, nhưng GIL limit CPU parallelism; dùng cho IO-bound work
- **Mutex**: Mutual exclusion — `Mutex.new`, `mutex.synchronize { }` — tương tự Java synchronized
- **Fiber**: Lightweight coroutine — cooperative, không preemptive; `Fiber.yield` suspend, `fiber.resume` resume
- **Enumerator as Fiber**: Ruby `Enumerator` là external iterator dùng Fiber — `lazy` chains
- **Ractors** (Ruby 3+): Actor model không có GIL — true parallelism, nhưng không share mutable state
- **concurrent-ruby gem**: Thread-safe data structures, atomic references, thread pools — tương tự Java `java.util.concurrent`
- **Sidekiq**: Multi-thread background job processor (IO-bound) — phổ biến nhất cho Ruby job processing

## Ví Dụ Code

```ruby
# ============ THREAD BASICS ============

# Thread.new — OS thread
thread = Thread.new do
  puts "Running in thread #{Thread.current.object_id}"
  sleep 1
  "result"
end

# Thread với value
threads = (1..5).map do |i|
  Thread.new { i * i }
end

results = threads.map(&:value)  # chờ tất cả thread, lấy return value
# => [1, 4, 9, 16, 25]

# IO-bound — threads vẫn effective dù có GIL
# GIL tự release khi thread chờ IO (network, disk)
require 'net/http'

urls = ["https://api1.com", "https://api2.com", "https://api3.com"]
threads = urls.map do |url|
  Thread.new { Net::HTTP.get(URI(url)) }  # concurrent IO
end
responses = threads.map(&:value)

# CPU-bound — threads không benefit từ multi-core vì GIL
# ❌ Không song song được
results = (1..4).map do |i|
  Thread.new { heavy_computation(i) }  # chạy lần lượt vì GIL
end

# ✅ CPU-bound → dùng processes
require 'parallel'
results = Parallel.map(1..4, in_processes: 4) { |i| heavy_computation(i) }

# ============ MUTEX ============

counter = 0
mutex = Mutex.new

threads = 100.times.map do
  Thread.new do
    mutex.synchronize do  # tương tự Java synchronized block
      counter += 1
    end
  end
end

threads.each(&:join)
puts counter  # => 100 (thread-safe)

# Mutex với timeout
mutex = Mutex.new
if mutex.try_lock  # non-blocking
  begin
    # critical section
  ensure
    mutex.unlock
  end
end

# Conditional variable — tương tự Java Object.wait/notify
mutex   = Mutex.new
cond    = ConditionVariable.new
data    = nil
ready   = false

producer = Thread.new do
  sleep 1
  mutex.synchronize do
    data = "Hello!"
    ready = true
    cond.signal  # tương tự notify()
  end
end

consumer = Thread.new do
  mutex.synchronize do
    cond.wait(mutex) until ready  # tương tự wait()
    puts "Received: #{data}"
  end
end

[producer, consumer].each(&:join)

# ============ FIBER — COOPERATIVE COROUTINE ============

# Fiber.yield suspend fiber, resume tiếp tục
fiber = Fiber.new do
  puts "Step 1"
  Fiber.yield           # suspend fiber, trả control về caller
  puts "Step 2"
  Fiber.yield
  puts "Step 3"
  "final value"
end

fiber.resume   # => "Step 1"
fiber.resume   # => "Step 2"
result = fiber.resume   # => "Step 3", result = "final value"

# Fiber với value passing
accumulator = Fiber.new do
  sum = 0
  loop do
    value = Fiber.yield(sum)  # yield trả sum ra, nhận value vào
    break if value.nil?
    sum += value
  end
  sum
end

accumulator.resume       # start fiber, returns 0 (initial yield)
accumulator.resume(10)   # send 10, returns 10
accumulator.resume(20)   # send 20, returns 30
result = accumulator.resume(nil)  # terminate, returns 30

# Fiber as generator — lazy sequence
def fibonacci
  Fiber.new do
    a, b = 0, 1
    loop do
      Fiber.yield(a)
      a, b = b, a + b
    end
  end
end

fib = fibonacci
10.times { print "#{fib.resume} " }
# => 0 1 1 2 3 5 8 13 21 34

# ============ ENUMERATOR — LAZY EVALUATION ============
# Enumerator dùng Fiber bên dưới

# Lazy enumerator — không compute until needed
lazy_result = (1..Float::INFINITY)
  .lazy
  .select { |n| n.odd? }
  .map { |n| n ** 2 }
  .first(5)
# => [1, 9, 25, 49, 81]  (compute chỉ 5 phần tử)

# Custom Enumerator
def infinite_counter(start = 0)
  Enumerator.new do |yielder|
    n = start
    loop do
      yielder.yield(n)  # Fiber.yield bên dưới
      n += 1
    end
  end
end

counter = infinite_counter(100)
counter.first(3)  # => [100, 101, 102]
counter.take(5)   # => [100, 101, 102, 103, 104]

# ============ RACTORS — TRUE PARALLELISM (RUBY 3+) ============
# Actor model — không share mutable state, no GIL

# Ractor không share object với thread khác — immutable hoặc moved
r = Ractor.new do
  puts "Running in Ractor — true parallel"
  42
end

result = r.take  # chờ Ractor finish, lấy result

# Pipeline
workers = 4.times.map do |i|
  Ractor.new(i) do |id|
    loop do
      job = Ractor.receive  # nhận từ main
      Ractor.yield(id: id, result: process(job))
    end
  end
end

# Gửi jobs
items.each { |item| workers.sample.send(item) }

# ⚠️ Ractors không share mutable object:
shared_array = [1, 2, 3]
r = Ractor.new(shared_array) do |arr|
  # arr là COPY hoặc MOVED — không phải cùng object
  arr.push(4)
end

# ============ CONCURRENT-RUBY GEM ============
# Thread-safe utilities (tương tự java.util.concurrent)

require 'concurrent'

# Atomic reference — tương tự Java AtomicReference
counter = Concurrent::AtomicFixnum.new(0)
threads = 100.times.map { Thread.new { counter.increment } }
threads.each(&:join)
puts counter.value  # => 100

# Thread-safe map — tương tự Java ConcurrentHashMap
map = Concurrent::Map.new
map.put_if_absent("key", "value")  # atomic
map.compute_if_absent("key") { expensive_computation }

# Promises — tương tự JavaScript Promise
promise = Concurrent::Promise.execute { compute_something }
  .then { |result| transform(result) }
  .rescue { |error| handle_error(error) }

result = promise.value  # blocking wait

# Future — tương tự Java Future
future = Concurrent::Future.execute { fetch_from_api }
result = future.value(5)  # timeout 5 seconds

# Thread pool
pool = Concurrent::FixedThreadPool.new(10)
pool.post { do_work }
pool.shutdown
pool.wait_for_termination(30)
```

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>GIL trong MRI Ruby — tại sao tồn tại và ảnh hưởng thực tế?</strong></summary>

**A:** GIL tồn tại vì MRI (C Ruby) memory model và GC không thread-safe — GIL là cách đơn giản nhất để bảo vệ. **Ảnh hưởng thực tế**: (1) CPU-bound multi-thread không benefit từ multi-core — `Parallel.map` với processes thay vì threads; (2) IO-bound vẫn concurrent — GIL release khi thread chờ IO (network, disk, DB), cho phép other threads chạy; (3) Sidekiq dùng multi-thread vẫn hiệu quả vì phần lớn là IO-bound (HTTP, DB, cache). **Alternatives**: JRuby (JVM, không có GIL, true threads); Ractors (Ruby 3+, actor model, limited API); Processes (Puma multi-worker, `parallel` gem). Thực tế production: Puma web server dùng multi-thread (IO-bound requests) + multi-worker processes (bypass GIL cho CPU work).

</details>

<details>
<summary><strong>Fiber khác Thread thế nào? Khi nào dùng Fiber?</strong></summary>

**A:** **Thread**: preemptive, OS-managed, có thể run parallel (dù GIL limit); context switch do OS quyết định; dùng cho concurrent IO operations. **Fiber**: cooperative, user-space, single-threaded; context switch chỉ khi code gọi `Fiber.yield` hoặc `fiber.resume`; zero OS overhead; không dùng được parallel. Dùng Fiber khi: (1) **Generators** — lazy sequence generation (`fibonacci`, `infinite_counter`); (2) **State machines** — pause/resume workflow logic; (3) **Async IO** (Async gem dùng Fiber as coroutine, tương tự Python asyncio); (4) **Enumerator** — Ruby dùng Fiber bên dưới cho external iteration. Không dùng Fiber cho concurrent network IO — dùng Thread hoặc Async gem.

</details>
