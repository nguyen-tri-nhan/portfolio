---
key: python-fastapi
title: FastAPI — Async Web Framework
crumb: 14. Python > Async & Web
---

FastAPI là modern Python web framework xây dựng trên asyncio và Pydantic — tự động generate OpenAPI docs, validation qua type hints, và dependency injection tương tự Spring nhưng nhẹ và idiomatic hơn.

## Điểm Chính

- **Type hints = source of truth**: FastAPI dùng type hints để validate request, serialize response, generate OpenAPI docs — không cần config thêm
- **Pydantic v2**: data validation và serialization với Rust core — nhanh hơn v1 ~5-50x, `model_config` thay `class Config`
- **Depends (Dependency Injection)**: inject shared dependencies (DB session, current user, config) — tương tự `@Autowired` Spring nhưng explicit hơn
- **async/sync handler**: `async def` cho IO-bound endpoint; `def` cho CPU-bound (chạy trên thread pool tự động)
- **Middleware**: xử lý cross-cutting concerns (CORS, auth, logging, request ID) — tương tự Spring Filter/HandlerInterceptor
- **Background Tasks**: chạy task sau khi response đã trả về (email, audit log) — không block response
- **Router**: tổ chức routes theo module — tương tự Spring `@RestController` groups
- **Lifespan**: startup/shutdown hooks để quản lý DB pool, cache connection — thay thế `@app.on_event` deprecated

## Ví Dụ Code

*CRUD endpoint với Pydantic v2, Depends, middleware, background tasks và lifespan*

```python
from __future__ import annotations
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from typing import Annotated
import asyncio

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr, field_validator

# ── Pydantic v2 Models ──────────────────────────────────────
class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    age: int = Field(ge=0, lt=150)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be blank")
        return v.strip()

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr

    model_config = {"from_attributes": True}  # Pydantic v2 (thay class Config)

# ── Dependency Injection ────────────────────────────────────
# Simulate DB session dependency
class FakeDB:
    users: dict[int, dict] = {}
    _counter = 0

fake_db = FakeDB()

async def get_db() -> AsyncIterator[FakeDB]:
    """Dependency: provide DB session, cleanup sau request"""
    try:
        yield fake_db
    finally:
        pass  # close connection ở đây nếu real DB

# Reusable annotated dependency type
DBDep = Annotated[FakeDB, Depends(get_db)]

async def get_current_user(token: str = "dummy") -> dict:
    """Auth dependency — inject vào bất kỳ endpoint nào"""
    if token == "invalid":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    return {"id": 1, "role": "admin"}

CurrentUser = Annotated[dict, Depends(get_current_user)]

# ── Lifespan — Startup/Shutdown ─────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup: init DB pool, cache, etc.
    print("Starting up: connecting to DB pool")
    yield
    # Shutdown: cleanup
    print("Shutting down: closing DB pool")

# ── FastAPI App ─────────────────────────────────────────────
app = FastAPI(
    title="User Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Endpoints ───────────────────────────────────────────────
from fastapi import APIRouter

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: DBDep,
    background_tasks: BackgroundTasks,
) -> UserResponse:
    """FastAPI auto-validates payload via Pydantic, auto-generates OpenAPI doc"""
    FakeDB._counter += 1
    user_id = FakeDB._counter
    db.users[user_id] = {"id": user_id, **payload.model_dump()}

    # Background task: chạy SAU KHI response đã trả về
    background_tasks.add_task(send_welcome_email, payload.email)

    return UserResponse(**db.users[user_id])

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: DBDep,
    current_user: CurrentUser,  # inject auth dependency
) -> UserResponse:
    user = db.users.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )
    return UserResponse(**user)

app.include_router(router)

# ── Background Task ─────────────────────────────────────────
async def send_welcome_email(email: str) -> None:
    await asyncio.sleep(1)  # simulate email sending
    print(f"Welcome email sent to {email}")
```

## Ứng Dụng Thực Tế

FastAPI là lựa chọn hàng đầu cho Python microservice backend — startup nhanh, performance cao (top tier trong async Python benchmarks), OpenAPI tự động giúp frontend và QA team không cần maintain API docs riêng. Pydantic v2 với Rust core đủ nhanh cho high-throughput validation. `Depends` pattern clean hơn Spring `@Autowired` vì explicit, testable (mock bằng `app.dependency_overrides`).

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>FastAPI khác Flask và Django thế nào? Khi nào chọn FastAPI?</strong></summary>

**A:** Flask: minimalist, sync-first, không có built-in validation hay OpenAPI; cần nhiều extensions. Django: batteries-included (ORM, admin, auth), sync-first nhưng có ASGI support; tốt cho monolith. FastAPI: async-first, type hints là core, Pydantic validation built-in, OpenAPI tự động; tốt cho API-only service và microservice. Chọn FastAPI khi: xây dựng REST/GraphQL API thuần, cần async performance cao, team có Python 3.10+ và muốn type safety. Django vẫn tốt hơn cho full-stack web với admin panel. FastAPI gần với Spring Boot hơn về triết lý (structured, validation-first, DI) nhưng nhẹ hơn nhiều.

</details>

<details>
<summary><strong>Pydantic validation hoạt động thế nào trong FastAPI?</strong></summary>

**A:** Khi request đến, FastAPI dùng Pydantic để parse và validate body (JSON → Python object), path params, query params — tất cả dựa trên type hints. Nếu validation fail, FastAPI tự trả `422 Unprocessable Entity` với chi tiết lỗi, không cần try-catch trong handler. `@field_validator` cho custom validation logic. Pydantic v2 dùng Rust core (`pydantic-core`) — validate rất nhanh, phù hợp high-throughput. Response cũng được serialize và validated qua `response_model` parameter — filter out fields không nên expose. Tất cả schema này được expose tự động qua `/docs` (Swagger UI) và `/redoc`.

</details>

<details>
<summary><strong>Dependency injection trong FastAPI hoạt động thế nào? So sánh với Spring @Autowired?</strong></summary>

**A:** `Depends()` trong FastAPI là explicit DI — function nhận dependency qua parameter với `Annotated[Type, Depends(factory_fn)]`. FastAPI gọi factory function, cache result trong request scope (không phải singleton), cleanup khi request kết thúc (nếu factory là generator với `yield`). Khác Spring: (1) explicit hơn — nhìn signature biết ngay dependency gì; (2) function-based thay class-based; (3) không có global IoC container. Testing dễ: `app.dependency_overrides[get_db] = lambda: mock_db`. Sub-dependencies hoạt động tự động: nếu `get_current_user` phụ thuộc `get_db`, FastAPI resolve chain tự động. Đây là pattern tốt hơn `@Autowired` về testability và explicitness.

</details>
