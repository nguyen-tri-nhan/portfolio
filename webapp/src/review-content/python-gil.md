---
key: python-gil
title: Python GIL — Global Interpreter Lock
crumb: 14. Python > Python Internals
---

GIL (Global Interpreter Lock) là mutex trong CPython cho phép chỉ một thread thực thi Python bytecode tại một thời điểm — ảnh hưởng lớn đến concurrency model và là điểm khác biệt cốt lõi với Java's true multi-threading.

## Điểm Chính

- **GIL definition**: mutex trong CPython bảo vệ Python object từ concurrent access — chỉ một thread chạy Python code tại một thời điểm
- **Tại sao GIL tồn tại**: đơn giản hóa reference counting (memory management) và C extension integration
- **IO-bound vs CPU-bound**: GIL được **release** khi thread thực hiện I/O — `threading` hiệu quả cho IO-bound; **không release** khi CPU computation — threading không giúp gì cho CPU-bound
- **threading**: hiệu quả cho IO-bound (network, file, DB queries) — GIL release khi chờ I/O
- **multiprocessing**: mỗi process có Python interpreter riêng, GIL riêng — bypass GIL cho CPU-bound
- **concurrent.futures**: `ThreadPoolExecutor` (IO-bound) và `ProcessPoolExecutor` (CPU-bound) — high-level API
- **Python 3.13 free-threaded mode**: PEP 703, có thể disable GIL với `python3.13t` — experimental
- **GIL bypass alternatives**: NumPy/SciPy dùng C extensions release GIL, Cython, ctypes

## Ví Dụ Code

*So sánh threading, multiprocessing và concurrent.futures cho IO-bound vs CPU-bound*

```python
import threading
import multiprocessing
import time
import requests  # pip install requests
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

# ── IO-bound: Threading HIỆU QUẢ ───────────────────────────
# GIL được release khi thread chờ I/O (network, file, DB)
# → Các thread khác có thể chạy trong lúc đó

def fetch_url(url: str) -> int:
    """Simulate HTTP request — IO-bound, GIL được release"""
    time.sleep(0.1)  # simulate network latency
    return 200

urls = [f"https://api.example.com/item/{i}" for i in range(20)]

# Sequential: ~2.0s
start = time.perf_counter()
results = [fetch_url(url) for url in urls]
print(f"Sequential: {time.perf_counter() - start:.2f}s")

# ThreadPoolExecutor: ~0.1s (20 threads chạy concurrent)
start = time.perf_counter()
with ThreadPoolExecutor(max_workers=20) as executor:
    results = list(executor.map(fetch_url, urls))
print(f"ThreadPool: {time.perf_counter() - start:.2f}s")

# ── CPU-bound: Threading KHÔNG HIỆU QUẢ (GIL block) ────────
def cpu_heavy(n: int) -> int:
    """Pure Python computation — GIL KHÔNG release"""
    return sum(i * i for i in range(n))

numbers = [1_000_000] * 8

# ThreadPoolExecutor: ~CHẬM HƠN sequential vì GIL contention + overhead
start = time.perf_counter()
with ThreadPoolExecutor(max_workers=8) as executor:
    results = list(executor.map(cpu_heavy, numbers))
print(f"ThreadPool (CPU): {time.perf_counter() - start:.2f}s")

# ProcessPoolExecutor: mỗi process có GIL riêng → true parallelism
start = time.perf_counter()
with ProcessPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(cpu_heavy, numbers))
print(f"ProcessPool (CPU): {time.perf_counter() - start:.2f}s")

# ── Asyncio: tốt nhất cho IO-bound (single thread, event loop) ─
import asyncio
import aiohttp

async def fetch_async(session: aiohttp.ClientSession, url: str) -> int:
    async with session.get(url) as response:
        return response.status

async def fetch_all(urls: list[str]) -> list[int]:
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_async(session, url) for url in urls]
        return await asyncio.gather(*tasks)

# asyncio không bị GIL vì single-threaded — không có race condition

# ── Decision Tree ────────────────────────────────────────────
def choose_concurrency(task_type: str) -> str:
    """Chọn approach phù hợp"""
    strategies = {
        "io_bound_async":     "asyncio + aiohttp/asyncpg",      # Best cho IO
        "io_bound_sync":      "ThreadPoolExecutor",               # Nếu không có async lib
        "cpu_bound_parallel": "ProcessPoolExecutor",              # True parallelism
        "cpu_bound_numpy":    "NumPy/SciPy (release GIL)",       # Vectorized operations
        "mixed":              "asyncio + ProcessPoolExecutor",    # run_in_executor
    }
    return strategies.get(task_type, "unknown")

# ── Python 3.13 Free-threaded (experimental) ────────────────
# python3.13t --experimental-no-gil script.py
# PEP 703: object-level locking thay vì GIL
# Cảnh báo: một số C extensions chưa support, performance có thể giảm
```

## Ứng Dụng Thực Tế

FastAPI chạy trên async event loop — IO-bound operations (DB query, HTTP call) là async, không bị GIL. Khi cần CPU-bound task trong FastAPI (image processing, ML inference), dùng `run_in_executor` với `ProcessPoolExecutor` để tránh block event loop. Celery worker mặc định dùng process-based (multiprocessing) để bypass GIL cho heavy computation.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>GIL là gì và tại sao CPython cần nó?</strong></summary>

**A:** GIL (Global Interpreter Lock) là mutex bảo vệ toàn bộ Python interpreter state — chỉ một thread có thể thực thi Python bytecode tại một thời điểm. CPython cần GIL vì reference counting (cơ chế garbage collection chính) không thread-safe nếu không có lock: hai thread cùng modify `ob_refcnt` của object gây data corruption. GIL đơn giản hóa implementation của C extensions và đảm bảo Python object model an toàn mà không cần fine-grained locking. Nhược điểm: không thể tận dụng multi-core cho pure Python CPU-bound code. JVM không có GIL vì dùng garbage collector khác (tracing GC, không phải reference counting).

</details>

<details>
<summary><strong>threading và multiprocessing khác nhau thế nào trong Python?</strong></summary>

**A:** `threading`: tất cả threads share cùng memory space và Python interpreter — GIL ngăn true parallel execution của Python bytecode, nhưng GIL được release khi I/O blocking → hiệu quả cho IO-bound. `multiprocessing`: mỗi process có interpreter riêng, GIL riêng, memory riêng → true CPU parallelism, nhưng IPC (inter-process communication) tốn kém hơn (pickle serialization, pipe/queue). Chọn: IO-bound (network, file) → `threading` hoặc `asyncio`; CPU-bound (computation, image processing) → `multiprocessing`. Trong Java, `Thread` là OS thread thực sự, true parallel ngay cả cho CPU-bound — không có khái niệm tương đương GIL.

</details>

<details>
<summary><strong>Chiến lược nào để bypass GIL cho CPU-bound Python code?</strong></summary>

**A:** Có nhiều cách: (1) **multiprocessing** — spawn separate processes, mỗi cái có GIL riêng, overhead IPC; (2) **NumPy/SciPy** — C extensions thực hiện vectorized computation và release GIL trong C code, true parallelism; (3) **Cython** — compile Python-like code sang C, có thể release GIL với `with nogil:` block; (4) **ctypes/cffi** — gọi C/C++ library, release GIL; (5) **Python 3.13 free-threaded** — experimental, disable GIL hoàn toàn. Trong practice, NumPy là cách phổ biến nhất cho ML/data processing — operations trên array chạy parallel trong C layer mà không cần multiprocessing.

</details>
