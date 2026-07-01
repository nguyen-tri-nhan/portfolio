---
key: python-async-await
title: Python async/await & asyncio
crumb: 14. Python > Async & Web
---

asyncio cung cấp event loop-based concurrency cho IO-bound tasks — một thread xử lý hàng nghìn concurrent connection bằng cách cooperative multitasking, tương tự reactive programming (WebFlux) trong Java nhưng với syntax trực quan hơn.

## Điểm Chính

- **Event loop**: single-threaded loop dispatch coroutines, I/O callbacks — tương tự Netty EventLoop trong Java
- **Coroutine**: `async def` function trả về coroutine object — chỉ chạy khi `await` hoặc cho vào event loop
- **Task**: coroutine được schedule trên event loop — chạy concurrently (không parallel) với các task khác
- **Future**: placeholder cho kết quả chưa có — low-level, thường dùng qua Task
- **asyncio.gather()**: chạy nhiều coroutine concurrent, chờ tất cả kết thúc — tương tự `CompletableFuture.allOf()`
- **asyncio.create_task()**: schedule coroutine ngay lập tức, không chờ — "fire and forget" hoặc lấy result sau
- **Async context manager**: `async with` dùng `__aenter__`/`__aexit__` — cho async resource (DB pool, HTTP session)
- **Async iterator**: `async for` dùng `__aiter__`/`__anext__` — cho streaming data từ DB hoặc message queue

## Ví Dụ Code

*Event loop, coroutine, gather, create_task, async context manager và error handling*

```python
import asyncio
import aiohttp
import time
from collections.abc import AsyncIterator

# ── Basic Coroutine ─────────────────────────────────────────
async def fetch_user(user_id: int) -> dict:
    """Coroutine: async def + await — chỉ block coroutine này, không block event loop"""
    await asyncio.sleep(0.1)  # simulate DB query — release event loop
    return {"id": user_id, "name": f"User {user_id}"}

# Chạy single coroutine
user = asyncio.run(fetch_user(1))   # Python 3.7+ — tạo event loop mới

# ── asyncio.gather — Concurrent Execution ───────────────────
async def fetch_all_users(user_ids: list[int]) -> list[dict]:
    """Tất cả requests chạy concurrent, không sequential"""
    tasks = [fetch_user(uid) for uid in user_ids]
    results = await asyncio.gather(*tasks)
    return list(results)

# Sequential: 5 × 0.1s = 0.5s
# Concurrent với gather: ~0.1s (tất cả chạy cùng lúc)
async def demo_gather():
    start = time.perf_counter()
    users = await fetch_all_users([1, 2, 3, 4, 5])
    print(f"5 users in {time.perf_counter() - start:.2f}s")  # ~0.1s

# ── asyncio.gather với return_exceptions ────────────────────
async def risky_fetch(uid: int) -> dict:
    if uid == 3:
        raise ValueError(f"User {uid} not found")
    return {"id": uid}

async def fetch_with_error_handling():
    results = await asyncio.gather(
        risky_fetch(1),
        risky_fetch(2),
        risky_fetch(3),
        return_exceptions=True,  # không raise, trả exception như value
    )
    for i, result in enumerate(results, 1):
        if isinstance(result, Exception):
            print(f"User {i} failed: {result}")
        else:
            print(f"User {i}: {result}")

# ── asyncio.create_task — Fire and Schedule ─────────────────
async def background_audit(user_id: int) -> None:
    await asyncio.sleep(1.0)  # slow audit task
    print(f"Audit complete for user {user_id}")

async def handle_login(user_id: int) -> dict:
    # Không await audit — schedule nó để chạy concurrently
    task = asyncio.create_task(background_audit(user_id))
    user = await fetch_user(user_id)  # return ngay sau 0.1s
    # task đang chạy nền, không block response
    return user

# ── Async Context Manager ───────────────────────────────────
class AsyncDBPool:
    """Quản lý connection pool async"""
    async def __aenter__(self) -> "AsyncDBPool":
        await asyncio.sleep(0.01)  # simulate connect
        print("Connected to DB")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await asyncio.sleep(0.01)  # simulate disconnect
        print("Disconnected from DB")

    async def query(self, sql: str) -> list[dict]:
        await asyncio.sleep(0.05)
        return [{"result": "data"}]

async def run_query():
    async with AsyncDBPool() as pool:
        return await pool.query("SELECT * FROM users")

# ── Async Iterator — Streaming ──────────────────────────────
async def stream_events(limit: int) -> AsyncIterator[dict]:
    """Simulate streaming từ message queue hoặc DB cursor"""
    for i in range(limit):
        await asyncio.sleep(0.01)  # simulate fetch next item
        yield {"event_id": i, "data": f"event_{i}"}

async def process_stream():
    async for event in stream_events(5):
        print(f"Processing: {event}")
    # async for tự gọi __anext__, xử lý StopAsyncIteration

# ── Avoid Blocking Event Loop ───────────────────────────────
import concurrent.futures

def cpu_intensive(n: int) -> int:
    """Sync blocking function"""
    return sum(i * i for i in range(n))

async def safe_cpu_task(n: int) -> int:
    """Chạy blocking function trong thread pool — không block event loop"""
    loop = asyncio.get_running_loop()
    with concurrent.futures.ThreadPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, cpu_intensive, n)
    return result
```

## Ứng Dụng Thực Tế

FastAPI built on asyncio — mỗi request handler là coroutine, có thể serve thousands of concurrent requests trên một thread. Dùng `asyncio.gather()` để fanout calls đến nhiều microservice đồng thời (thay vì sequential calls). Database driver `asyncpg` và `aiomysql` release event loop khi chờ DB response — không block other requests.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>asyncio và threading khác nhau thế nào? Khi nào dùng asyncio?</strong></summary>

**A:** `threading` tạo OS threads thật — mỗi thread có stack riêng (~1MB), context switching do OS quản lý, có race condition nếu share mutable state. `asyncio` là single-threaded cooperative multitasking — coroutines tự nguyện yield control (tại `await`), không có race condition, overhead cực thấp (tạo hàng nghìn coroutine không vấn đề gì). Dùng asyncio khi: IO-bound (network, DB, file), cần handle nhiều concurrent connection (web server, chat), library có async support. Dùng threading khi: legacy sync library không có async version, cần block operations trong async context (chạy trong ThreadPoolExecutor). Asyncio tương tự Spring WebFlux (Reactor), nhưng syntax dễ đọc hơn nhiều.

</details>

<details>
<summary><strong>asyncio.gather và create_task khác nhau thế nào?</strong></summary>

**A:** `asyncio.gather(*coros)` nhận coroutines, tạo tasks, chạy concurrent và **chờ tất cả** hoàn thành — trả về list kết quả theo thứ tự input. Nếu một task raise exception, mặc định cancel các task còn lại và re-raise. `asyncio.create_task(coro)` schedule một coroutine chạy ngay, trả về Task object ngay lập tức — caller có thể await task sau hoặc không await (fire-and-forget). `gather` là `all-or-nothing`, còn `create_task` là `schedule-and-optionally-await`. Dùng `gather` khi cần kết quả của tất cả tasks; `create_task` khi cần schedule background work hoặc muốn control từng task riêng lẻ (cancel một task cụ thể).

</details>

<details>
<summary><strong>Tại sao không được gọi blocking function trong async code? Cách fix?</strong></summary>

**A:** Event loop là single-threaded — khi coroutine gọi blocking function (sync I/O, `time.sleep()`, heavy computation), nó block **toàn bộ event loop**, không coroutine nào khác chạy được trong thời gian đó, gây latency spike cho tất cả requests. Fix: (1) thay bằng async equivalent (`asyncio.sleep` thay `time.sleep`, `aiofiles` thay `open`), (2) chạy trong thread pool với `loop.run_in_executor(executor, sync_func, *args)` — blocking code chạy trên thread riêng, event loop vẫn tiếp tục, (3) với CPU-bound, dùng `ProcessPoolExecutor` thay vì `ThreadPoolExecutor`. FastAPI cung cấp `BackgroundTasks` để chạy blocking task sau khi response.

</details>
