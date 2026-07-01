---
key: python-memory-model
title: Python Memory Model — Reference Counting & GC
crumb: 14. Python > Python Internals
---

Python dùng reference counting làm cơ chế GC chính, bổ sung cyclic garbage collector để handle circular reference — khác với JVM's tracing GC, và hiểu rõ model này giúp tránh memory leak và optimize performance.

## Điểm Chính

- **Reference counting**: mỗi object có `ob_refcnt` — tăng khi tạo reference, giảm khi xóa; về 0 thì free ngay lập tức
- **Cyclic GC**: module `gc` detect và collect circular reference (A → B → A) mà reference counting không thể handle
- **id()**: trả về memory address của object — unique trong lifetime của object
- **is vs ==**: `is` kiểm tra identity (cùng object trong memory), `==` kiểm tra equality (giá trị bằng nhau)
- **Interning**: CPython cache small integers (-5 đến 256) và intern một số string — `is` có thể True ngoài dự kiến
- **__slots__**: ngăn tạo `__dict__` per-instance, giảm memory đáng kể khi có nhiều instance
- **weakref**: reference không tăng refcount — tránh circular reference giữa parent/child objects
- **sys.getrefcount()**: đọc refcount tại runtime — thường lớn hơn 1 vì chính hàm getrefcount() tạo thêm ref

## Ví Dụ Code

*reference counting, is vs ==, interning, __slots__ và memory optimization*

```python
import sys
import gc
import weakref
from typing import Optional

# ── Reference Counting ──────────────────────────────────────
a = [1, 2, 3]           # refcount = 1
b = a                   # refcount = 2 (b cũng trỏ đến cùng list)
print(sys.getrefcount(a))  # 3 (a, b, và tham số của getrefcount)

del b                   # refcount = 2 (getrefcount vẫn giữ 1 ref)
# Khi refcount → 0, memory được free NGAY LẬP TỨC (không chờ GC cycle)

# ── id() và is vs == ────────────────────────────────────────
x = [1, 2, 3]
y = [1, 2, 3]
z = x

print(x == y)   # True  — same value
print(x is y)   # False — different objects (khác address)
print(x is z)   # True  — same object (cùng address)
print(id(x), id(y), id(z))  # x và z cùng id, y khác

# ⚠️ KHÔNG bao giờ dùng `is` để so sánh giá trị
# Chỉ dùng `is` để so sánh với None, True, False
value: Optional[str] = None
if value is None:    # ĐÚNG
    pass
if value == None:    # SAI — dùng is với None

# ── Integer Interning (-5 đến 256) ─────────────────────────
a = 256
b = 256
print(a is b)   # True — CPython intern small ints

a = 257
b = 257
print(a is b)   # False (có thể True trong REPL do optimization)

# String interning
s1 = "hello"
s2 = "hello"
print(s1 is s2)  # True — CPython intern string literals

s1 = "hello world"  # string có space thường không intern
s2 = "hello world"
print(s1 is s2)  # False (implementation-dependent)

# Explicit intern
import sys
s1 = sys.intern("hello world")
s2 = sys.intern("hello world")
print(s1 is s2)  # True

# ── __slots__ — Memory Optimization ────────────────────────
# Mặc định: mỗi instance có __dict__ (dict riêng) → overhead
class PointWithDict:
    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

# Với __slots__: không tạo __dict__, lưu attributes trong fixed-size array
class PointWithSlots:
    __slots__ = ("x", "y")  # define cho phép attributes

    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

# So sánh memory usage
p_dict  = PointWithDict(1.0, 2.0)
p_slots = PointWithSlots(1.0, 2.0)

print(sys.getsizeof(p_dict))    # ~48 bytes + __dict__ overhead (~232 bytes)
print(sys.getsizeof(p_slots))   # ~48 bytes (không có __dict__)
# Với hàng triệu instance: tiết kiệm ~180 bytes/instance = ~180MB

# ── Cyclic GC — Circular Reference ─────────────────────────
class Node:
    def __init__(self, value: int) -> None:
        self.value = value
        self.next: Optional["Node"] = None

# Circular reference — reference counting không thể free
a = Node(1)
b = Node(2)
a.next = b
b.next = a   # a → b → a: circular!

del a, b
# refcount của cả hai vẫn là 1 (trỏ nhau) → không free ngay
# cyclic GC sẽ detect và collect khi chạy

gc.collect()  # trigger manual GC cycle

# ── weakref — Tránh Circular Reference ─────────────────────
class Cache:
    def __init__(self) -> None:
        self._store: dict[str, weakref.ref] = {}

    def set(self, key: str, value: object) -> None:
        self._store[key] = weakref.ref(value)  # không tăng refcount

    def get(self, key: str) -> object | None:
        ref = self._store.get(key)
        return ref() if ref else None  # ref() trả None nếu object đã bị GC
```

## Ứng Dụng Thực Tế

`__slots__` rất hữu ích khi tạo hàng triệu instance nhỏ — ví dụ event objects trong high-throughput system hoặc row objects khi process large CSV. Circular reference thường xảy ra trong tree/graph structures hoặc observer pattern — dùng `weakref` cho parent reference để tránh memory leak. FastAPI Pydantic models dùng `__slots__` nội bộ để optimize performance.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>is và == khác nhau thế nào? Khi nào dùng is?</strong></summary>

**A:** `==` gọi `__eq__` method để so sánh giá trị — hai object khác nhau có thể bằng nhau. `is` kiểm tra identity: hai biến có trỏ đến cùng một object trong memory không (so sánh `id()`). Chỉ dùng `is` trong ba trường hợp: (1) so sánh với `None` (`if x is None`), (2) so sánh với `True`/`False` khi cần exact check, (3) kiểm tra singleton. Không bao giờ dùng `is` để so sánh int, string, list, hay custom object — kết quả phụ thuộc vào CPython optimization (interning) và không guaranteed theo Python spec.

</details>

<details>
<summary><strong>Python reference counting hoạt động thế nào? Khác JVM GC ra sao?</strong></summary>

**A:** CPython giữ `ob_refcnt` trong mỗi object header — tăng khi gán reference, giảm khi reference bị xóa (`del`, out of scope, reassign). Khi `ob_refcnt == 0`, memory được free **ngay lập tức** (deterministic). JVM dùng tracing GC (mark-and-sweep, generational GC) — không free ngay, chạy theo cycle, có Stop-The-World pause. Ưu điểm Python: predictable memory release, tốt cho `with` statement và `__del__`. Nhược điểm: không handle circular reference (cần cyclic GC bổ sung), overhead của việc update refcount mỗi assignment (thread safety issues → GIL).

</details>

<details>
<summary><strong>__slots__ optimization hoạt động thế nào? Khi nào nên dùng?</strong></summary>

**A:** Mặc định, mỗi Python instance có `__dict__` (hash table) để lưu attributes — flexible nhưng tốn ~200 bytes overhead. `__slots__ = ("x", "y")` ngăn tạo `__dict__`, thay bằng fixed-size array — giảm ~40-50% memory per instance. Nên dùng khi: tạo nhiều instance nhỏ (>10,000), attributes cố định từ đầu, performance critical. Nhược điểm: không thể add attribute động (`self.z = 5` sẽ AttributeError), không tương thích với một số metaclass và multiple inheritance phức tạp. `@dataclass` không tự thêm `__slots__`; dùng `@dataclass(slots=True)` (Python 3.10+) để kết hợp.

</details>
