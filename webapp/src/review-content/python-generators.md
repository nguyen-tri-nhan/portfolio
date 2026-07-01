---
key: python-generators
title: Python Generators & yield
crumb: 14. Python > Advanced Python
---

Generator là hàm dùng `yield` để trả về giá trị từng phần, lazy — không tính toàn bộ kết quả ngay, tiết kiệm memory đáng kể khi xử lý large dataset hoặc infinite sequence.

## Điểm Chính

- **yield**: tạm dừng function, trả về giá trị, giữ nguyên state — lần gọi `next()` tiếp theo tiếp tục từ chỗ dừng
- **Generator function vs regular function**: generator function trả về generator object; mỗi lần gọi `next()` chạy đến `yield` tiếp theo
- **Generator expression**: `(expr for x in iterable)` — lazy version của list comprehension, tương tự `Stream` trong Java
- **send()**: truyền giá trị vào generator đang chạy — biến generator thành coroutine đơn giản
- **throw() / close()**: inject exception hoặc dừng generator — dùng trong cleanup
- **yield from**: ủy quyền cho sub-generator (PEP 380) — tương tự `flatMap` hoặc delegation trong Java Stream
- **Memory efficiency**: generator không load toàn bộ data vào RAM — critical khi xử lý file GB hoặc DB query hàng triệu rows
- **Generator as coroutine**: nền tảng của asyncio — `async/await` được implement trên generator protocol

## Ví Dụ Code

*Generator function, generator expression, send/yield from, và use case thực tế*

```python
from typing import Generator, Iterator
import time

# ── Basic Generator Function ────────────────────────────────
def countdown(n: int) -> Generator[int, None, None]:
    """Generator[YieldType, SendType, ReturnType]"""
    while n > 0:
        yield n   # pause, return n, resume khi next() được gọi
        n -= 1

gen = countdown(3)
print(next(gen))  # 3
print(next(gen))  # 2
print(next(gen))  # 1
# next(gen)       # StopIteration

# Dùng trong for loop (tự xử lý StopIteration)
for i in countdown(5):
    print(i)  # 5, 4, 3, 2, 1

# ── Infinite Sequence — không thể dùng list ─────────────────
def fibonacci() -> Generator[int, None, None]:
    a, b = 0, 1
    while True:  # infinite — chỉ tính khi cần
        yield a
        a, b = b, a + b

import itertools
first_10 = list(itertools.islice(fibonacci(), 10))
# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

# ── send() — two-way communication ─────────────────────────
def accumulator() -> Generator[float, float, str]:
    """Generator nhận giá trị qua send() và yield tổng tích lũy"""
    total = 0.0
    while True:
        value = yield total  # yield total ra ngoài, nhận value từ send()
        if value is None:
            break
        total += value
    return f"Final total: {total}"

acc = accumulator()
next(acc)           # khởi động generator (chạy đến yield đầu tiên)
print(acc.send(10)) # 10.0
print(acc.send(20)) # 30.0
print(acc.send(5))  # 35.0

# ── yield from — delegation ─────────────────────────────────
def read_chunks(filename: str, chunk_size: int = 1024) -> Generator[bytes, None, None]:
    with open(filename, "rb") as f:
        while chunk := f.read(chunk_size):
            yield chunk

def process_multiple_files(filenames: list[str]) -> Generator[bytes, None, None]:
    for filename in filenames:
        yield from read_chunks(filename)  # delegate sang sub-generator
        # Tương đương: for chunk in read_chunks(filename): yield chunk
        # Nhưng yield from còn forward send()/throw()/close() đúng cách

# ── Generator Expression vs List Comprehension ──────────────
import sys

data = range(1_000_000)

# List comprehension: tạo list ngay, dùng ~8MB RAM
list_comp = [x ** 2 for x in data]
print(f"list size: {sys.getsizeof(list_comp):,} bytes")  # ~8,000,000

# Generator expression: lazy, chỉ dùng ~200 bytes
gen_exp = (x ** 2 for x in data)
print(f"generator size: {sys.getsizeof(gen_exp)} bytes")  # 200

# Kết quả giống nhau khi sum
print(sum(x ** 2 for x in data) == sum(list_comp))  # True

# ── Pipeline với Generators ─────────────────────────────────
def read_lines(filename: str) -> Iterator[str]:
    with open(filename) as f:
        yield from f  # yield từng dòng

def parse_json_lines(lines: Iterator[str]) -> Iterator[dict]:
    import json
    for line in lines:
        if line.strip():
            yield json.loads(line)

def filter_active(records: Iterator[dict]) -> Iterator[dict]:
    for record in records:
        if record.get("active"):
            yield record

# Lazy pipeline — xử lý từng dòng, không load file vào RAM
# pipeline = filter_active(parse_json_lines(read_lines("data.jsonl")))
```

## Ứng Dụng Thực Tế

Generator rất phổ biến khi đọc file log lớn (GB), streaming DB query result với `cursor.fetchmany()`, hoặc xử lý Kafka messages. Thay vì `list(db.query(...))` load hết vào RAM, dùng generator để xử lý từng batch. Trong Python, `asyncio` và `aiohttp` được xây dựng trên generator protocol — `async/await` là syntactic sugar cho generator-based coroutine.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Generator khác list thế nào về memory? Khi nào nên dùng generator?</strong></summary>

**A:** List lưu tất cả phần tử trong memory ngay khi tạo — với 1 triệu phần tử thì dùng hàng chục MB. Generator chỉ giữ state hiện tại và tính phần tử tiếp theo khi được yêu cầu — luôn dùng O(1) memory bất kể sequence dài bao nhiêu. Dùng generator khi: (1) dataset quá lớn để fit trong RAM, (2) chỉ cần iterate một lần, (3) cần short-circuit sớm với `next()`, (4) xây dựng pipeline xử lý dữ liệu. Dùng list khi: cần truy cập nhiều lần, cần index, hoặc cần `len()`.

</details>

<details>
<summary><strong>yield from hoạt động thế nào? Khác gì so với for-yield thông thường?</strong></summary>

**A:** `yield from iterable` không chỉ là shorthand cho `for item in iterable: yield item`. Sự khác biệt quan trọng: `yield from` tạo một transparent tunnel hai chiều giữa caller và sub-generator — `send()` values, `throw()` exceptions, và `close()` được forward đúng cách đến sub-generator. Với `for-yield` thông thường, `send()` sẽ đến generator ngoài chứ không vào sub-generator. Điều này quan trọng khi build coroutine pipeline. `yield from` còn trả về giá trị return của sub-generator qua expression `result = yield from sub_gen()`.

</details>

<details>
<summary><strong>Generator có thể dùng như coroutine thế nào? Liên quan gì đến async/await?</strong></summary>

**A:** Generator với `send()` là coroutine đơn giản: `value = yield` vừa yield control ra ngoài vừa nhận giá trị khi resume. Python 3.4 thêm `asyncio` dùng generator-based coroutine (`@asyncio.coroutine` + `yield from`). Python 3.5 thêm `async/await` syntax sạch hơn — `async def` tạo coroutine object, `await` tương đương `yield from` trong context asyncio. Về implementation, `async def` function tạo ra coroutine object implement generator protocol (`__next__`, `send`, `throw`, `close`). Hiểu generator giúp debug `asyncio` sâu hơn khi gặp vấn đề về event loop hay coroutine lifecycle.

</details>
