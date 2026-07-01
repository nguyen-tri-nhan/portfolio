---
key: python-internals
title: Python Internals — CPython, Bytecode & Import System
crumb: 14. Python > Python Internals
---

Hiểu CPython internals — bytecode, LEGB scope rule, và import system — giúp debug hiệu quả, optimize performance, và tránh các pitfall phổ biến về namespace và module loading.

## Điểm Chính

- **CPython**: implementation tham chiếu của Python — biên dịch source thành bytecode (.pyc) và chạy trên Python VM
- **Bytecode (.pyc)**: intermediate representation — lưu trong `__pycache__/` để tránh recompile; `dis` module để disassemble
- **LEGB scope rule**: Local → Enclosing → Global → Built-in — thứ tự Python tìm kiếm tên biến
- **global / nonlocal**: `global x` để modify global variable từ function; `nonlocal x` để modify enclosing scope
- **__builtins__**: module chứa built-in functions (print, len, range...) — cuối cùng trong LEGB lookup
- **__all__**: list tên public khi `from module import *` — explicit public API
- **__name__ == '__main__'**: guard để phân biệt chạy trực tiếp vs import
- **Import system**: `sys.path` là danh sách directories Python tìm module; `sys.modules` cache module đã import
- **__init__.py**: đánh dấu directory là package; có thể re-export names để API gọn hơn

## Ví Dụ Code

*LEGB rule, bytecode inspection, import system và các dunder attributes quan trọng*

```python
import dis
import sys

# ── LEGB Scope Rule ─────────────────────────────────────────
x = "global"   # Global scope

def outer():
    x = "enclosing"   # Enclosing scope

    def inner():
        x = "local"   # Local scope
        print(x)      # "local" — LEGB: tìm thấy ngay ở Local

    def inner_no_local():
        print(x)      # "enclosing" — không có Local, lên Enclosing

    inner()
    inner_no_local()

outer()
print(x)   # "global"

# ── global và nonlocal ──────────────────────────────────────
counter = 0

def increment():
    global counter   # modify global variable — ít dùng, prefer return value
    counter += 1

def make_counter():
    count = 0
    def inc():
        nonlocal count  # modify enclosing scope variable
        count += 1
        return count
    return inc

my_counter = make_counter()
print(my_counter())  # 1
print(my_counter())  # 2  — count được giữ trong closure

# ── Bytecode Inspection với dis ─────────────────────────────
def add(a: int, b: int) -> int:
    return a + b

# Xem Python VM instructions
print(dis.dis(add))
# LOAD_FAST 0 (a)
# LOAD_FAST 1 (b)
# BINARY_OP  0 (+)
# RETURN_VALUE

# List comprehension có bytecode riêng (GET_ITER, FOR_ITER)
def squares(n: int) -> list[int]:
    return [x * x for x in range(n)]

dis.dis(squares)

# ── __name__ == '__main__' ──────────────────────────────────
# File: utils.py
def helper_function() -> str:
    return "I'm a helper"

if __name__ == "__main__":
    # Code này chỉ chạy khi: python utils.py
    # KHÔNG chạy khi: from utils import helper_function
    print("Running directly:", helper_function())

# ── __all__ — Public API Control ───────────────────────────
# File: mymodule.py
__all__ = ["public_function", "PublicClass"]  # explicit public API

def public_function() -> str:
    return "public"

def _private_function() -> str:  # convention: _ prefix = private
    return "private"

class PublicClass: ...
class _InternalClass: ...

# from mymodule import *  → chỉ import public_function, PublicClass

# ── Import System ────────────────────────────────────────────
print(sys.path)        # list directories Python tìm module
print(sys.modules)     # cache dict: module name → module object

# Module chỉ được import một lần — lần sau lấy từ sys.modules cache
import json
import json  # không tải lại — cực kỳ nhanh, lấy từ cache

# Kiểm tra module đã được import chưa
if "mymodule" in sys.modules:
    print("Already imported")

# Reload module (rare — dùng trong development/debugging)
import importlib
# importlib.reload(some_module)

# ── Package Structure ────────────────────────────────────────
# my_project/
# ├── __init__.py         ← đánh dấu là package, re-export public API
# ├── models/
# │   ├── __init__.py
# │   ├── user.py
# │   └── order.py
# └── services/
#     ├── __init__.py
#     └── user_service.py

# __init__.py của models/ có thể re-export:
# from .user import User
# from .order import Order
# __all__ = ["User", "Order"]
# → Cho phép: from models import User (thay vì from models.user import User)

# ── Compile và Cache ─────────────────────────────────────────
import py_compile
import importlib.util

# Python tự động tạo .pyc khi import
# __pycache__/module.cpython-312.pyc

# Kiểm tra bytecode version
spec = importlib.util.find_spec("json")
print(spec.origin if spec else "not found")
```

## Ứng Dụng Thực Tế

`dis.dis()` dùng khi micro-optimize hot path — so sánh bytecode của hai implementation để chọn cái hiệu quả hơn. LEGB rule quan trọng khi debug closure bug (biến bị capture theo reference, không phải value — classic `for i in range(n): lambdas`). `__init__.py` với `__all__` là cách organize public API của package trong large codebase.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>LEGB rule trong Python là gì? Tại sao quan trọng?</strong></summary>

**A:** LEGB là thứ tự Python tìm kiếm tên biến: **L**ocal (trong function hiện tại) → **E**nclosing (các function bao ngoài, từ trong ra ngoài) → **G**lobal (module level) → **B**uilt-in (module builtins). Quan trọng vì: (1) giải thích tại sao variable trong function không conflict với global; (2) closure hoạt động vì `inner` function có thể "nhìn thấy" scope của `outer`; (3) `global`/`nonlocal` keywords cần thiết khi muốn assign vào scope bên ngoài (chỉ đọc thì không cần). Classic bug: `if x > 0: x = x - 1` trong function — `x` bên phải tìm trong Local (thấy assignment phía dưới) nhưng chưa có giá trị → `UnboundLocalError`.

</details>

<details>
<summary><strong>Python bytecode là gì? dis module dùng để làm gì?</strong></summary>

**A:** Python source được biên dịch thành bytecode — instructions cho Python Virtual Machine (không phải machine code như C). Bytecode lưu trong `.pyc` file trong `__pycache__/` để tái sử dụng khi source không thay đổi. `dis` module disassemble bytecode thành human-readable form, cho thấy VM instructions như `LOAD_FAST`, `CALL_FUNCTION`, `BINARY_OP`. Dùng `dis.dis(func)` để: (1) hiểu tại sao một implementation nhanh hơn (ít instructions hơn), (2) debug closure và scope issues, (3) hiểu tại sao list comprehension có own scope (riêng `<listcomp>` frame). Trong production, bytecode được optimize nhẹ (peephole optimizer) nhưng không aggressive như JVM JIT.

</details>

<details>
<summary><strong>Import system trong Python hoạt động thế nào? sys.path và sys.modules?</strong></summary>

**A:** Khi `import foo`, Python: (1) check `sys.modules["foo"]` — nếu đã cache thì return ngay (nhanh); (2) nếu chưa có, tìm trong `sys.path` theo thứ tự — script directory, PYTHONPATH env var, standard library, site-packages; (3) load file, compile thành bytecode, execute module-level code, cache vào `sys.modules["foo"]`. Module chỉ execute một lần dù import nhiều lần — side effects (như global variable init) chỉ xảy ra lần đầu. `__init__.py` trong package folder được execute khi import package — dùng để re-export names và lazy import. Circular import gây `ImportError` hoặc `AttributeError` khi A import B và B import A — fix bằng cách restructure code hoặc lazy import bên trong function.

</details>
