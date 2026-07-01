---
key: python-decorators
title: Python Decorators
crumb: 14. Python > Advanced Python
---

Decorator là higher-order function wraps function/class khác để thêm behavior — tương tự Decorator pattern trong GoF, hoặc AOP (Aspect-Oriented Programming) trong Spring (@Transactional, @Cacheable).

## Điểm Chính

- **Decorator syntax**: `@decorator` là syntactic sugar cho `func = decorator(func)`
- **functools.wraps**: preserve `__name__`, `__doc__`, `__annotations__` của function gốc — không dùng thì debug/introspection bị sai
- **Decorator factory**: decorator nhận argument bằng cách thêm một tầng function nữa (`def decorator(arg): def inner(func): ...`)
- **Class-based decorator**: implement `__call__` method — giữ state giữa các lần gọi
- **Stacking decorators**: áp dụng từ dưới lên trên (`@A @B def f()` → `A(B(f))`)
- **Dùng trong production**: logging, timing, retry, rate limiting, caching, auth check — tương tự Spring AOP aspects
- **@wraps là bắt buộc**: mọi decorator production code phải có `@functools.wraps(func)`

## Ví Dụ Code

*Decorator cơ bản, decorator factory, class-based decorator và stacking*

```python
import functools
import time
import logging
from collections.abc import Callable
from typing import TypeVar, ParamSpec

P = ParamSpec("P")
R = TypeVar("R")

logger = logging.getLogger(__name__)

# ── Basic Decorator ─────────────────────────────────────────
def log_call(func: Callable[P, R]) -> Callable[P, R]:
    @functools.wraps(func)  # BẮT BUỘC: preserve metadata của func gốc
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        logger.info("Calling %s", func.__name__)
        result = func(*args, **kwargs)
        logger.info("%s returned %r", func.__name__, result)
        return result
    return wrapper

@log_call
def add(a: int, b: int) -> int:
    return a + b

# Kiểm tra @wraps hoạt động đúng
print(add.__name__)  # "add" (không phải "wrapper")

# ── Decorator Factory (Decorator với Arguments) ──────────────
def retry(max_attempts: int = 3, delay: float = 1.0):
    """Decorator factory: thêm một tầng để nhận arguments"""
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            last_error: Exception | None = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    logger.warning("Attempt %d/%d failed: %s", attempt, max_attempts, e)
                    if attempt < max_attempts:
                        time.sleep(delay)
            raise RuntimeError(f"All {max_attempts} attempts failed") from last_error
        return wrapper
    return decorator

@retry(max_attempts=3, delay=0.5)
def call_external_api(url: str) -> dict:
    # Simulated flaky API call
    import random
    if random.random() < 0.7:
        raise ConnectionError("Network error")
    return {"status": "ok"}

# ── Class-based Decorator (giữ state) ───────────────────────
class RateLimit:
    """Giới hạn số lần gọi trong một khoảng thời gian"""
    def __init__(self, max_calls: int, period: float) -> None:
        self.max_calls = max_calls
        self.period = period
        self.calls: list[float] = []

    def __call__(self, func: Callable[P, R]) -> Callable[P, R]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            now = time.time()
            # Remove expired calls
            self.calls = [t for t in self.calls if now - t < self.period]
            if len(self.calls) >= self.max_calls:
                raise RuntimeError(f"Rate limit: {self.max_calls} calls per {self.period}s")
            self.calls.append(now)
            return func(*args, **kwargs)
        return wrapper

@RateLimit(max_calls=5, period=60.0)
def send_email(to: str, subject: str) -> None:
    print(f"Sending email to {to}: {subject}")

# ── Stacking Decorators (áp dụng từ dưới lên) ───────────────
def timeit(func: Callable[P, R]) -> Callable[P, R]:
    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.perf_counter() - start:.4f}s")
        return result
    return wrapper

@timeit           # áp dụng sau cùng (ngoài cùng)
@log_call         # áp dụng trước (trong hơn)
@retry(max_attempts=2)  # áp dụng đầu tiên (trong nhất)
def process_data(data: list) -> list:
    return [x * 2 for x in data]
# Thứ tự thực thi: timeit → log_call → retry → process_data
```

## Ứng Dụng Thực Tế

Trong FastAPI, decorator dùng để implement auth (`@require_auth`), rate limiting, request logging, và cache invalidation — tương tự Spring AOP. `@functools.lru_cache` và `@functools.cache` là built-in decorator cực hữu ích cho memoization. Celery dùng `@app.task` decorator để register background tasks.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Decorator pattern trong Python hoạt động thế nào? So sánh với AOP trong Spring?</strong></summary>

**A:** Decorator trong Python là higher-order function nhận function/class và trả về function/class mới với behavior bổ sung. `@decorator` là syntactic sugar: Python thay thế `func` bằng `decorator(func)`. Spring AOP dùng proxy-based approach với annotation như `@Transactional`, `@Cacheable` — tương tự về ý tưởng (thêm cross-cutting concerns mà không sửa business logic), nhưng Spring hoạt động tại compile/load time qua bytecode manipulation, còn Python decorator chạy tại definition time. Python decorator linh hoạt hơn vì là first-class function, không cần framework.

</details>

<details>
<summary><strong>Tại sao functools.wraps lại quan trọng?</strong></summary>

**A:** Khi wrap function, wrapper thay thế function gốc hoàn toàn — mất `__name__`, `__doc__`, `__annotations__`, `__module__`. Điều này gây ra: (1) logging/error traceback hiện tên "wrapper" thay vì tên function thật, (2) `help(func)` hiển thị docstring của wrapper, (3) introspection tools như FastAPI (đọc `__annotations__` để xác định request schema) hoạt động sai. `@functools.wraps(func)` copy tất cả metadata này sang wrapper. Đây là convention bắt buộc trong mọi production decorator.

</details>

<details>
<summary><strong>Cách viết decorator nhận arguments (decorator factory)?</strong></summary>

**A:** Cần thêm một tầng function: `def retry(max_attempts=3)` trả về `decorator`, `decorator` nhận `func` và trả về `wrapper`. Tổng cộng 3 tầng hàm lồng nhau. Cú pháp dùng: `@retry(max_attempts=3)` — Python gọi `retry(3)` trước để lấy `decorator`, sau đó `decorator(func)`. Một cách viết gọn hơn với `functools.wraps` và `partial`: define decorator bình thường, nếu gọi không có `func` thì dùng `functools.partial` để bind arguments. Python 3 không có cú pháp đặc biệt, chỉ là closure thông thường.

</details>
