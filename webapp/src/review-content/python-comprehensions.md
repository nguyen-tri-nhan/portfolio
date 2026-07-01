---
key: python-comprehensions
title: Python Comprehensions & Generator Expressions
crumb: 14. Python > Python Cơ Bản
---

Comprehension là cú pháp ngắn gọn để tạo list/dict/set từ iterable — thay thế vòng lặp for truyền thống bằng một biểu thức duy nhất, dễ đọc và thường nhanh hơn.

## Điểm Chính

- **List comprehension**: `[expr for item in iterable if condition]` — tạo list mới
- **Dict comprehension**: `{k: v for k, v in items}` — tạo dict từ iterable
- **Set comprehension**: `{expr for item in iterable}` — tạo set (tự deduplicate)
- **Generator expression**: `(expr for item in iterable)` — lazy, không tạo list trong memory
- **Conditional comprehension**: `value_if_true if condition else value_if_false` — ternary trong comprehension
- **Nested comprehension**: `[expr for row in matrix for col in row]` — flatten hoặc transform 2D data
- **Comprehension vs map/filter**: comprehension rõ ràng hơn, Pythonic hơn; `map`/`filter` trả về iterator (lazy)
- **Generator expression vs list comprehension**: generator dùng `()`, lazy evaluation, tiết kiệm memory cho large dataset

## Ví Dụ Code

*List, dict, set comprehension và generator expression với các pattern thực tế*

```python
# ── List Comprehension ──────────────────────────────────────
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

# Basic: bình phương số chẵn
squares = [x ** 2 for x in numbers if x % 2 == 0]
# [4, 16, 36, 64, 100]

# Ternary trong comprehension
labels = ["even" if x % 2 == 0 else "odd" for x in numbers]
# ["odd", "even", "odd", ...]

# ── Dict Comprehension ──────────────────────────────────────
users = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]

# Build lookup dict từ list — pattern cực phổ biến
user_map: dict[int, str] = {u["id"]: u["name"] for u in users}
# {1: "Alice", 2: "Bob"}

# Swap key-value
original = {"a": 1, "b": 2, "c": 3}
inverted = {v: k for k, v in original.items()}
# {1: "a", 2: "b", 3: "c"}

# ── Set Comprehension ───────────────────────────────────────
words = ["hello", "world", "hello", "python", "world"]
unique_lengths: set[int] = {len(w) for w in words}
# {5, 6}  — tự deduplicate

# ── Nested Comprehension ────────────────────────────────────
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

# Flatten 2D list
flat = [cell for row in matrix for cell in row]
# [1, 2, 3, 4, 5, 6, 7, 8, 9]

# Transpose matrix
transposed = [[row[i] for row in matrix] for i in range(3)]
# [[1, 4, 7], [2, 5, 8], [3, 6, 9]]

# ── Generator Expression ────────────────────────────────────
# Chỉ khác list comprehension ở chỗ dùng () thay vì []
# Lazy — chỉ compute khi cần, không tạo list trong memory

# Tổng bình phương 1 triệu số — generator không load tất cả vào RAM
total = sum(x ** 2 for x in range(1_000_000))

# Tìm phần tử đầu tiên thỏa điều kiện — short-circuit với generator
first_even = next((x for x in numbers if x % 2 == 0), None)
# 2

# ── Comprehension vs map/filter ─────────────────────────────
# map/filter trả về iterator (lazy) — ít Pythonic hơn
squares_map = list(map(lambda x: x ** 2, filter(lambda x: x % 2 == 0, numbers)))
# Equivalent nhưng kém đọc hơn so với list comprehension

# Comprehension: rõ ràng, dễ debug, dễ thêm điều kiện
squares_comp = [x ** 2 for x in numbers if x % 2 == 0]
```

## Ứng Dụng Thực Tế

Trong backend API, dict comprehension thường dùng để build lookup map từ DB query result (tránh N+1 query). Generator expression dùng khi xử lý file CSV lớn hoặc streaming data — không load toàn bộ vào memory. List comprehension thay thế các vòng for đơn giản trong data transformation pipeline.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Comprehension và map/filter khác nhau thế nào? Khi nào dùng cái nào?</strong></summary>

**A:** Cả hai đều tạo ra sequence mới từ iterable, nhưng comprehension rõ ràng và Pythonic hơn — PEP 8 khuyến khích dùng comprehension. `map` và `filter` trả về lazy iterator (không tính ngay), hữu ích khi chain nhiều bước mà không cần kết quả trung gian. Trong practice, list comprehension được ưu tiên vì dễ đọc hơn, đặc biệt khi có condition. `map` với lambda thì verbose hơn `[f(x) for x in items]`. Một ngoại lệ: `map` với named function (không phải lambda) đôi khi nhanh hơn một chút vì ít bytecode overhead.

</details>

<details>
<summary><strong>Generator expression khác list comprehension thế nào? Khi nào dùng generator?</strong></summary>

**A:** List comprehension `[...]` tính toán ngay và lưu toàn bộ kết quả vào memory. Generator expression `(...)` là lazy — chỉ tính từng phần tử khi được yêu cầu (qua `next()` hoặc vòng for). Dùng generator khi: (1) dataset rất lớn và không cần tất cả cùng lúc, (2) chỉ cần iterate một lần, (3) short-circuit với `next()`. Ví dụ `sum(x**2 for x in range(10**8))` chạy được với generator, còn `sum([x**2 for x in range(10**8)])` có thể OOM. Nếu cần truy cập nhiều lần hoặc index, dùng list comprehension.

</details>

<details>
<summary><strong>Nested comprehension hoạt động thế nào? Có vấn đề gì về readability không?</strong></summary>

**A:** Nested comprehension có thứ tự đọc từ trái sang phải theo thứ tự vòng lặp ngoài → trong: `[f(x) for row in matrix for x in row]` tương đương `for row in matrix: for x in row: f(x)`. Vấn đề readability: khi có nhiều hơn 2 tầng lồng nhau, comprehension trở nên khó đọc. PEP 8 khuyến cáo: nếu comprehension dài hơn một dòng hoặc có hơn 2 tầng lồng, hãy viết thành vòng for thông thường hoặc tách thành helper function. Ưu tiên clarity hơn brevity trong production code.

</details>
