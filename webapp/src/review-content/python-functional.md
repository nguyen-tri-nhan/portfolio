---
key: python-functional
title: Python Functional Programming — functools & itertools
crumb: 14. Python > Advanced Python
---

Python hỗ trợ functional programming qua built-in functions (map, filter, zip, sorted), `functools` (reduce, partial, lru_cache), và `itertools` (chain, product, groupby) — tương tự Stream API trong Java 8+.

## Điểm Chính

- **map/filter**: lazy iterator — tương tự `Stream.map()` và `Stream.filter()` trong Java
- **zip**: kết hợp nhiều iterable theo vị trí — `zip([1,2], ["a","b"])` → `[(1,"a"), (2,"b")]`
- **sorted/min/max với key**: `sorted(items, key=lambda x: x.age)` — tương tự `Comparator.comparing()`
- **functools.reduce**: fold sequence thành một giá trị — tương tự `Stream.reduce()` trong Java
- **functools.partial**: tạo function mới với một số args đã được bind — tương tự currying
- **functools.lru_cache / functools.cache**: memoization decorator — tương tự `@Cacheable` trong Spring
- **itertools.chain**: nối nhiều iterable — tương tự `Stream.concat()`
- **itertools.groupby**: group elements liên tiếp — phải sort trước, khác SQL GROUP BY
- **itertools.product/combinations/permutations**: combinatorial operations

## Ví Dụ Code

*Functional built-ins, functools, và itertools với các pattern thực tế trong backend*

```python
import functools
import itertools
from collections.abc import Callable, Iterable
from typing import TypeVar

T = TypeVar("T")

# ── Built-in Functional Tools ───────────────────────────────
users = [
    {"name": "Alice", "age": 30, "score": 95},
    {"name": "Bob",   "age": 25, "score": 87},
    {"name": "Carol", "age": 35, "score": 92},
]

# sorted với key — tương tự Comparator.comparing()
by_score = sorted(users, key=lambda u: u["score"], reverse=True)
oldest   = max(users, key=lambda u: u["age"])

# zip — combine parallel iterables
names  = ["Alice", "Bob", "Carol"]
scores = [95, 87, 92]
paired = list(zip(names, scores))  # [("Alice", 95), ...]

# zip_longest với fillvalue
import itertools as it
for a, b in it.zip_longest([1, 2, 3], ["x", "y"], fillvalue="-"):
    print(a, b)  # 3, "-"

# enumerate — thêm index khi iterate
for i, user in enumerate(users, start=1):
    print(f"{i}. {user['name']}")

# ── functools.reduce ────────────────────────────────────────
numbers = [1, 2, 3, 4, 5]
total   = functools.reduce(lambda acc, x: acc + x, numbers, 0)  # 15
product = functools.reduce(lambda acc, x: acc * x, numbers, 1)  # 120

# ── functools.partial — bind arguments ─────────────────────
def send_notification(user_id: int, message: str, priority: str = "normal") -> None:
    print(f"[{priority.upper()}] User {user_id}: {message}")

# Tạo specialized version với priority đã bind
send_urgent = functools.partial(send_notification, priority="urgent")
send_urgent(user_id=42, message="Payment failed")  # priority="urgent" đã bind

# Rất hữu ích với map — bind config params
import json
parse_strict = functools.partial(json.loads, parse_constant=None)

# ── functools.lru_cache / cache ─────────────────────────────
@functools.cache  # Python 3.9+, tương đương lru_cache(maxsize=None)
def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

@functools.lru_cache(maxsize=128)  # giới hạn cache size, thread-safe
def get_user_permissions(user_id: int) -> frozenset[str]:
    # Expensive DB query — kết quả được cache
    return frozenset(["read", "write"])

# Invalidate cache khi cần
get_user_permissions.cache_clear()
print(get_user_permissions.cache_info())  # CacheInfo(hits=5, misses=1, ...)

# ── itertools.chain ─────────────────────────────────────────
active_users   = [1, 2, 3]
inactive_users = [4, 5]
all_users = list(itertools.chain(active_users, inactive_users))
# [1, 2, 3, 4, 5]

# chain.from_iterable — flatten list of lists
nested = [[1, 2], [3, 4], [5, 6]]
flat   = list(itertools.chain.from_iterable(nested))  # [1, 2, 3, 4, 5, 6]

# ── itertools.groupby — PHẢI SORT TRƯỚC ─────────────────────
orders = [
    {"user_id": 1, "amount": 100},
    {"user_id": 1, "amount": 200},
    {"user_id": 2, "amount": 150},
]

# Phải sort theo key trước khi groupby
orders_sorted = sorted(orders, key=lambda o: o["user_id"])
for user_id, group in itertools.groupby(orders_sorted, key=lambda o: o["user_id"]):
    user_orders = list(group)
    total = sum(o["amount"] for o in user_orders)
    print(f"User {user_id}: {total}")

# ── itertools.product — Cartesian product ───────────────────
sizes   = ["S", "M", "L"]
colors  = ["red", "blue"]
variants = list(itertools.product(sizes, colors))
# [("S","red"), ("S","blue"), ("M","red"), ...]
```

## Ứng Dụng Thực Tế

`functools.lru_cache` dùng để cache expensive computation như permission check, config lookup — tránh hit DB mỗi request. `itertools.chain` hiệu quả khi merge result từ nhiều DB query hoặc API call mà không cần tạo list trung gian. `functools.partial` phổ biến khi configure callback function trong event handler hoặc bind database session vào service function.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>functools.partial hoạt động thế nào? So sánh với currying trong functional programming?</strong></summary>

**A:** `functools.partial(func, *args, **kwargs)` tạo một callable mới với một số argument đã được bind trước — khi gọi callable mới, các argument còn lại mới được provide. Không phải currying thuần túy (currying bind từng arg một, trả về function mới), `partial` bind nhiều args cùng lúc. Dùng `partial` khi cần specialize một generic function: `partial(send_email, smtp_host="smtp.example.com")` tạo `send_with_host` không cần truyền host mỗi lần. Trong Java, tương tự là dùng method reference với biến đã capture trong lambda closure.

</details>

<details>
<summary><strong>lru_cache và cache khác nhau thế nào? Thread safety ra sao?</strong></summary>

**A:** `functools.cache` (Python 3.9+) là `lru_cache(maxsize=None)` — unbounded cache, không bao giờ evict. `lru_cache(maxsize=128)` dùng LRU policy, giới hạn size. Cả hai đều **thread-safe** — implement với GIL, không cần lock thêm. Tuy nhiên, nếu cached function trả về mutable object (list, dict), caller có thể mutate nó và ảnh hưởng lần sau — nên trả về immutable (tuple, frozenset). Với asyncio, cần `async_lru` từ thư viện `async-lru` vì `lru_cache` không support `async def`. Cache key được tạo từ args — chỉ cache được nếu args là hashable.

</details>

<details>
<summary><strong>itertools.groupby khác SQL GROUP BY thế nào?</strong></summary>

**A:** Sự khác biệt quan trọng: `itertools.groupby` chỉ group các phần tử **liên tiếp** (consecutive) có cùng key — phải **sort trước** nếu muốn group toàn bộ. SQL GROUP BY tự sort và aggregate toàn bộ dataset. Nếu quên sort trước khi `groupby`, bạn có thể nhận nhiều group cho cùng một key. `groupby` trả về iterator of `(key, group_iterator)` — group iterator bị consumed khi move sang key tiếp theo, nên cần `list(group)` nếu cần dùng lại. Về performance: `groupby` là O(n) sau khi sort O(n log n), tốt cho in-memory grouping. Với large dataset, SQL aggregation trong DB hiệu quả hơn nhiều.

</details>
