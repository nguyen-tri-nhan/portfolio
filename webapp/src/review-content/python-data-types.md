---
key: python-data-types
title: Python Data Types
crumb: 14. Python > Python Cơ Bản
---

Python có hệ thống kiểu dữ liệu động với built-in types phong phú — int, float, str, bool là scalar; list, tuple, dict, set là collection với đặc tính mutability khác nhau.

## Điểm Chính

- **int/float/str/bool**: immutable scalar types — `bool` là subclass của `int` (`True == 1`)
- **list**: mutable, ordered, cho phép duplicate — tương đương `ArrayList<T>` trong Java
- **tuple**: immutable, ordered — dùng làm key trong dict, return multiple values từ function
- **dict**: mutable, ordered (Python 3.7+), key-value — tương đương `HashMap<K,V>` nhưng syntax gọn hơn
- **set**: mutable, unordered, unique elements — tương đương `HashSet<T>`, dùng cho membership test O(1)
- **frozenset**: immutable set — có thể dùng làm dict key
- **Mutability**: list/dict/set là mutable; int/float/str/bool/tuple/frozenset là immutable
- **type() vs isinstance()**: `type(x) == int` kiểm tra exact type; `isinstance(x, int)` kiểm tra kế thừa — dùng `isinstance` trong production
- **Duck typing**: Python không kiểm tra type tường minh — nếu object có method cần thiết thì dùng được (EAFP: Easier to Ask Forgiveness than Permission)

## Ví Dụ Code

*Các built-in types và đặc tính mutability, so sánh với Java*

```python
from typing import Any

# ── Scalar Types ────────────────────────────────────────────
x: int = 42
pi: float = 3.14
name: str = "Python"
flag: bool = True

# bool là subclass của int — khác với Java (boolean primitive)
print(True + 1)       # 2
print(isinstance(True, int))  # True

# ── Collection Types ────────────────────────────────────────

# list — mutable, ordered (giống ArrayList<T>)
fruits: list[str] = ["apple", "banana", "apple"]  # duplicate OK
fruits.append("cherry")
fruits[0] = "avocado"   # mutable

# tuple — immutable, ordered
point: tuple[int, int] = (10, 20)
# point[0] = 5  # TypeError: 'tuple' object does not support item assignment
x, y = point   # unpacking — rất phổ biến trong Python

# dict — mutable, ordered (Python 3.7+) (giống LinkedHashMap<K,V>)
user: dict[str, Any] = {"name": "Nhan", "age": 28, "active": True}
user["role"] = "backend"        # thêm key mới
user.get("missing", "default")  # safe get với default

# set — mutable, unordered, unique (giống HashSet<T>)
tags: set[str] = {"python", "backend", "api"}
tags.add("fastapi")
tags.discard("missing")         # không raise error nếu không tồn tại
"python" in tags                # O(1) membership test

# frozenset — immutable set, có thể làm dict key
permissions: frozenset[str] = frozenset({"read", "write"})

# ── type() vs isinstance() ──────────────────────────────────
def process(value: int | float) -> float:
    # isinstance preferred: handles subclasses (bool is int)
    if not isinstance(value, (int, float)):
        raise TypeError(f"Expected number, got {type(value).__name__}")
    return float(value)

# type() kiểm tra exact type — ít dùng hơn
print(type(True) == bool)   # True
print(type(True) == int)    # False  ← khác với isinstance

# ── Duck Typing ─────────────────────────────────────────────
def total_length(items) -> int:
    """Bất kỳ iterable nào đều dùng được — list, tuple, set, str"""
    return sum(len(item) for item in items)

print(total_length(["hello", "world"]))   # 10
print(total_length(("foo", "bar")))       # 6
```

## Ứng Dụng Thực Tế

Trong backend với FastAPI/Django, `dict` và `list` là kiểu phổ biến nhất khi parse JSON request body. `tuple` thường dùng để return nhiều giá trị từ service function (e.g., `return data, status_code`). `set` rất hiệu quả để deduplicate IDs hoặc check permission membership O(1) thay vì loop qua list.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>list và tuple khác nhau thế nào? Khi nào dùng tuple thay list?</strong></summary>

**A:** `list` là mutable (có thể thêm/xóa/sửa phần tử), `tuple` là immutable (không thể thay đổi sau khi tạo). Dùng `tuple` khi dữ liệu không cần thay đổi — ví dụ tọa độ `(lat, lon)`, RGB color `(255, 0, 0)`, hoặc return nhiều giá trị từ function. `tuple` còn có thể làm dict key và set element vì hashable, trong khi `list` thì không. Tuple cũng nhẹ hơn list một chút về memory vì không cần over-allocate.

</details>

<details>
<summary><strong>dict và set khác nhau thế nào? Tại sao set lookup là O(1)?</strong></summary>

**A:** `dict` lưu key-value pairs; `set` chỉ lưu unique values — về cơ bản `set` là dict chỉ có key, không có value. Cả hai đều dùng hash table nên membership test (`in`) là O(1) trung bình. Trong Java, tương đương là `HashMap` vs `HashSet`. Dùng `set` khi chỉ cần check sự tồn tại, dùng `dict` khi cần ánh xạ key → value. Note: `set` elements phải hashable (immutable), nên không thể có `set` chứa `list`.

</details>

<details>
<summary><strong>Python dynamic typing hoạt động thế nào so với Java static typing?</strong></summary>

**A:** Python là dynamically typed — biến không có type cố định, type được xác định tại runtime theo giá trị đang giữ. Trong Java, `int x = 5` thì `x` mãi là `int`; trong Python `x = 5` rồi `x = "hello"` hoàn toàn hợp lệ. Python dùng duck typing: nếu object có method phù hợp thì dùng được, không quan tâm class cụ thể. Python 3.5+ thêm type hints (PEP 484) để có static analysis với mypy mà không làm mất tính dynamic — type hints là optional và không được enforce tại runtime mặc định.

</details>
