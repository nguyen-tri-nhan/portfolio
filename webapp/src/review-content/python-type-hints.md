---
key: python-type-hints
title: Python Type Hints & Static Typing
crumb: 14. Python > Python Cơ Bản
---

Type hints (PEP 484) cho phép annotate kiểu dữ liệu trong Python — không được enforce tại runtime mặc định, nhưng giúp IDE, mypy và các tool khác phát hiện lỗi sớm, tương tự generics trong Java.

## Điểm Chính

- **PEP 484**: chuẩn type hints từ Python 3.5, dùng `typing` module cho các generic types
- **typing module**: `List`, `Dict`, `Tuple`, `Optional`, `Union`, `Any`, `Callable`, `TypeVar`
- **Python 3.9+**: dùng built-in `list[str]`, `dict[str, int]` thay vì `List[str]`, `Dict[str, int]`
- **Python 3.10+**: `X | Y` thay cho `Union[X, Y]`; `X | None` thay cho `Optional[X]`
- **Optional[X]**: tương đương `Union[X, None]` — biểu thị giá trị có thể là `None`
- **Any**: opt-out static checking — dùng khi integrate với dynamic code, tránh lạm dụng
- **mypy**: static type checker phổ biến nhất, tương tự javac type checking nhưng optional
- **Runtime vs static**: type hints mặc định không được kiểm tra lúc chạy — cần `beartype` hoặc Pydantic nếu muốn runtime validation

## Ví Dụ Code

*Type hints từ cơ bản đến nâng cao, Python 3.10+ syntax và mypy integration*

```python
from __future__ import annotations  # enable PEP 604 syntax in Python 3.9
from typing import Optional, Union, Any, Callable, TypeVar, Generic
from collections.abc import Sequence, Iterable

# ── Basic Type Hints ────────────────────────────────────────
def greet(name: str, times: int = 1) -> str:
    return f"Hello, {name}! " * times

# Python 3.9+: built-in generics (không cần import List, Dict từ typing)
def process_users(user_ids: list[int]) -> dict[str, list[int]]:
    return {"ids": user_ids}

# ── Optional và Union ───────────────────────────────────────
# Python 3.9 và trước: Optional[str] = Union[str, None]
def find_user_old(user_id: int) -> Optional[str]:
    ...

# Python 3.10+: X | None thay cho Optional[X]
def find_user(user_id: int) -> str | None:
    return "Alice" if user_id == 1 else None

# Union nhiều kiểu — Python 3.10+
def parse_value(raw: str | int | float) -> float:
    return float(raw)

# ── TypeVar và Generic ──────────────────────────────────────
T = TypeVar("T")

def first(items: list[T]) -> T | None:
    return items[0] if items else None

# Generic class — tương tự class Container<T> trong Java
class Repository(Generic[T]):
    def __init__(self) -> None:
        self._store: dict[int, T] = {}

    def save(self, id: int, entity: T) -> None:
        self._store[id] = entity

    def find(self, id: int) -> T | None:
        return self._store.get(id)

# ── Callable ────────────────────────────────────────────────
# Callable[[arg1_type, arg2_type], return_type]
def apply(func: Callable[[int], str], value: int) -> str:
    return func(value)

# ── Python 3.10+ match statement với type narrowing ─────────
def describe(value: int | str | list) -> str:
    match value:
        case int(n):
            return f"integer: {n}"
        case str(s):
            return f"string: {s}"
        case list(items):
            return f"list with {len(items)} items"
        case _:
            return "unknown"

# ── Any — dùng khi thực sự cần dynamic ─────────────────────
def serialize(obj: Any) -> dict[str, Any]:
    """Tránh dùng Any rộng rãi — mất type safety"""
    return {"type": type(obj).__name__, "value": str(obj)}
```

## Ứng Dụng Thực Tế

FastAPI dùng type hints để tự động validate request body (qua Pydantic) và generate OpenAPI docs — type hints trở thành source of truth cho cả validation lẫn documentation. Trong team, mypy với `--strict` mode chạy trong CI pipeline phát hiện type mismatch trước khi merge, giảm runtime TypeError trong production.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Type hints trong Python khác Java generics thế nào?</strong></summary>

**A:** Java generics được enforce tại compile-time — javac từ chối compile nếu type không khớp. Python type hints mặc định là optional và không được check tại runtime, chỉ có tác dụng với tool như mypy hoặc IDE. Java dùng type erasure (generics bị xóa sau compile), Python giữ type hints trong `__annotations__` attribute và có thể đọc tại runtime qua `typing.get_type_hints()`. Trong Python, `list[str]` tại runtime vẫn chỉ là `list` — không ngăn bạn thêm `int` vào. Nếu muốn runtime validation, cần Pydantic hoặc `beartype`.

</details>

<details>
<summary><strong>Optional[X] và X | None khác nhau thế nào?</strong></summary>

**A:** Về ngữ nghĩa, hai cái hoàn toàn tương đương — `Optional[X]` là syntactic sugar cho `Union[X, None]`, còn `X | None` là cú pháp mới từ Python 3.10 (PEP 604). Cú pháp `X | None` được khuyến khích dùng trong Python 3.10+ vì ngắn gọn và nhất quán hơn. Nếu cần support Python 3.9 và trước, dùng `Optional[X]` từ `typing` module, hoặc thêm `from __future__ import annotations` ở đầu file để enable new syntax trên Python 3.9.

</details>

<details>
<summary><strong>Làm thế nào để tích hợp mypy vào CI pipeline?</strong></summary>

**A:** Thêm mypy vào `pyproject.toml` hoặc `mypy.ini` với config phù hợp, sau đó chạy `mypy src/` trong CI. Bắt đầu với `--ignore-missing-imports` để không bị chặn bởi third-party lib chưa có stubs. Tăng dần độ strict: `--disallow-untyped-defs` (require type hints cho tất cả function) → `--strict` (maximum checking). Pre-commit hook với `mypy` giúp catch lỗi trước khi push. FastAPI và Pydantic có sẵn type stubs, nên tích hợp tốt với mypy mà không cần config thêm.

</details>
