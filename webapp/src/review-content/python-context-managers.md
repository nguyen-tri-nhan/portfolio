---
key: python-context-managers
title: Python Context Managers
crumb: 14. Python > Advanced Python
---

Context manager đảm bảo resource được cleanup đúng cách qua `with` statement — tương tự try-with-resources trong Java 7+, nhưng có thể tùy chỉnh qua `__enter__`/`__exit__` hoặc `contextlib.contextmanager`.

## Điểm Chính

- **with statement**: `with expr as var` — gọi `__enter__` khi vào, `__exit__` khi ra (kể cả khi có exception)
- **__enter__**: setup resource, return giá trị binding cho `as` clause
- **__exit__(exc_type, exc_val, exc_tb)**: cleanup; trả về `True` để suppress exception, `False`/`None` để re-raise
- **contextlib.contextmanager**: decorator biến generator function thành context manager — cách ngắn gọn hơn class
- **Exception handling trong __exit__**: nhận `exc_type`, `exc_val`, `exc_tb` — có thể log, transform, hoặc suppress exception
- **contextlib.suppress**: suppress specific exceptions một cách tường minh
- **Nested context managers**: `with A() as a, B() as b:` — Python 3.1+ syntax
- **Async context manager**: `async with` dùng `__aenter__`/`__aexit__` — cho async resource (DB connection pool)

## Ví Dụ Code

*Class-based, contextmanager decorator, exception handling và async context manager*

```python
import time
import logging
import contextlib
from contextlib import contextmanager, asynccontextmanager
from typing import Generator, AsyncGenerator

logger = logging.getLogger(__name__)

# ── Class-based Context Manager ─────────────────────────────
class Timer:
    """Đo thời gian thực thi của một block code"""
    def __init__(self, name: str = "block") -> None:
        self.name = name
        self.elapsed: float = 0.0

    def __enter__(self) -> "Timer":
        self._start = time.perf_counter()
        return self  # giá trị này bind vào biến sau `as`

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool | None:
        self.elapsed = time.perf_counter() - self._start
        logger.info("%s took %.4fs", self.name, self.elapsed)
        # Trả về None/False: không suppress exception
        # Trả về True: suppress exception (ẩn lỗi đi)
        return None  # re-raise exception nếu có

with Timer("db query") as t:
    time.sleep(0.1)  # simulate work
print(f"Elapsed: {t.elapsed:.4f}s")

# ── contextmanager Decorator — cách ngắn gọn ────────────────
@contextmanager
def managed_transaction(db_conn) -> Generator[any, None, None]:
    """Context manager dùng generator: code trước yield = __enter__,
    code sau yield = __exit__"""
    tx = db_conn.begin()
    try:
        yield tx          # giá trị này bind vào `as` clause
        tx.commit()       # chỉ commit nếu không có exception
    except Exception:
        tx.rollback()     # rollback khi có lỗi
        raise             # re-raise để caller biết

# Dùng:
# with managed_transaction(db) as tx:
#     tx.execute("INSERT INTO users ...")

# ── Exception Handling trong __exit__ ───────────────────────
class SuppressAndLog:
    """Suppress specific exception và log warning"""
    def __init__(self, *exception_types: type[Exception]) -> None:
        self.exception_types = exception_types

    def __enter__(self) -> "SuppressAndLog":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_type is not None and issubclass(exc_type, self.exception_types):
            logger.warning("Suppressed %s: %s", exc_type.__name__, exc_val)
            return True  # suppress — không re-raise
        return False  # re-raise nếu exception khác

with SuppressAndLog(FileNotFoundError, PermissionError):
    open("/nonexistent/path")  # FileNotFoundError bị suppress và log

# contextlib.suppress — built-in version đơn giản hơn
with contextlib.suppress(FileNotFoundError):
    open("/nonexistent/path")

# ── Nested Context Managers ─────────────────────────────────
# Python 3.1+: multiple context managers trên một dòng
# with open("input.txt") as fin, open("output.txt", "w") as fout:
#     fout.write(fin.read())

# ── Async Context Manager ───────────────────────────────────
class AsyncDBPool:
    async def __aenter__(self) -> "AsyncDBPool":
        await self._connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self._disconnect()

    async def _connect(self) -> None: ...
    async def _disconnect(self) -> None: ...

# Hoặc dùng decorator:
@asynccontextmanager
async def async_timer(name: str) -> AsyncGenerator[None, None]:
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        logger.info("%s: %.4fs", name, elapsed)

# async with async_timer("api call"):
#     await call_external_api()
```

## Ứng Dụng Thực Tế

Context manager phổ biến trong backend Python: quản lý DB connection/transaction, file I/O, distributed lock (Redis), test mock/patch (`with mock.patch(...)`), và timing/tracing. SQLAlchemy dùng `with session.begin()` để auto commit/rollback. `pytest` dùng `with pytest.raises(ValueError)` để test exception. Trong FastAPI, `lifespan` context manager quản lý startup/shutdown của app.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Context manager khác try-finally thế nào? Khi nào dùng cái nào?</strong></summary>

**A:** `try-finally` và `with` đều đảm bảo cleanup code chạy, nhưng context manager encapsulate logic setup/teardown vào một class/function tái sử dụng được. `try-finally` phải viết lại cleanup code mỗi lần, dễ bị quên và verbose. `with` statement ngắn gọn, tái sử dụng, và clearly signal resource lifecycle. Java 7+ có try-with-resources tương tự (implement `AutoCloseable`). Trong Python, prefer `with` cho resource management. `try-finally` vẫn dùng khi cần logic phức tạp hơn những gì context manager cung cấp, hoặc khi cần handle nhiều exception khác nhau theo cách riêng.

</details>

<details>
<summary><strong>contextlib.contextmanager hoạt động thế nào bên trong?</strong></summary>

**A:** `@contextmanager` biến generator function thành context manager bằng cách wrap nó trong class `_GeneratorContextManager` implement `__enter__` và `__exit__`. `__enter__` gọi `next()` để chạy generator đến `yield` đầu tiên, trả về giá trị yield. `__exit__` resume generator bằng cách gọi `next()` hoặc `generator.throw(exc)` nếu có exception. Nếu generator không có second yield (kết thúc sau `yield` đầu tiên), context manager hoạt động đúng. Nếu có exception trong `with` block, nó được inject vào generator tại điểm `yield` — đó là lý do cần `try-except-raise` trong generator để handle đúng.

</details>

<details>
<summary><strong>Làm thế nào để suppress exception trong __exit__? Khi nào nên suppress?</strong></summary>

**A:** Trả về `True` từ `__exit__` để suppress exception — Python không re-raise. Trả về `False`, `None`, hoặc không có return statement thì exception được re-raise bình thường. Suppress chỉ nên dùng trong các trường hợp cụ thể: `contextlib.suppress(FileNotFoundError)` khi file không tồn tại là expected behavior, hoặc cleanup trong test suite. Tuyệt đối không suppress blindly (bare `except` hoặc suppress `Exception`) — che giấu lỗi thật, khó debug. Best practice: chỉ suppress exception type cụ thể mà bạn hiểu rõ nguyên nhân và đã handle đúng.

</details>
