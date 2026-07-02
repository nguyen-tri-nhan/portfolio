---
key: graphql
title: GraphQL
crumb: 18. API & Communication > GraphQL
---

GraphQL là query language cho API với single endpoint, cho phép client chỉ định chính xác dữ liệu cần lấy — giải quyết over-fetching và under-fetching của REST.

## Điểm Chính

- **Single endpoint**: tất cả operations qua `POST /graphql`; client định nghĩa shape của response qua query language.
- **No over/under-fetching**: REST trả về toàn bộ resource dù client chỉ cần 2 field; GraphQL trả về đúng những field được yêu cầu.
- **Schema types**: `type`, `Query` (read), `Mutation` (write), `Subscription` (real-time), `input` type, `enum`, `interface`, `union`.
- **Resolver pattern**: root resolver nhận query → field resolver cho từng field → có thể nest nhiều cấp; mỗi resolver trả về data hoặc promise.
- **N+1 problem**: query 1 lần để lấy N users, sau đó N query riêng để lấy posts của từng user → tổng N+1 queries; fix bằng **DataLoader** (batch + per-request cache).
- **DataLoader**: batch nhiều key lookup thành một database query; cache kết quả trong phạm vi một request để tránh duplicate queries.
- **Security**: query depth limiting (ngăn deeply nested attack query), query complexity analysis (mỗi field có cost, từ chối query vượt budget), persisted queries (whitelist).
- **Subscriptions**: real-time updates qua WebSocket; server push khi data thay đổi — phù hợp cho notification, live feed.

## Ví Dụ Code

*Python Strawberry GraphQL schema với DataLoader giải quyết N+1*

```python
# ✅ GraphQL schema với DataLoader — giải quyết N+1 problem
import strawberry
from strawberry.dataloader import DataLoader
from typing import List, Optional
from collections import defaultdict

# ---------- Database layer (simplified) ----------
async def fetch_users_by_ids(ids: List[int]) -> List["UserModel"]:
    # Single batched query thay vì N queries riêng lẻ
    return await db.execute(
        "SELECT * FROM users WHERE id = ANY($1)", ids
    )

async def fetch_posts_by_user_ids(user_ids: List[int]) -> List[List["PostModel"]]:
    rows = await db.execute(
        "SELECT * FROM posts WHERE user_id = ANY($1)", user_ids
    )
    # Group posts by user_id để DataLoader map kết quả theo thứ tự keys
    grouped: dict[int, list] = defaultdict(list)
    for row in rows:
        grouped[row.user_id].append(row)
    return [grouped[uid] for uid in user_ids]

# ---------- Strawberry types ----------
@strawberry.type
class Post:
    id: int
    title: str
    content: str

@strawberry.type
class User:
    id: int
    name: str
    email: str

    # ✅ DataLoader làm resolver — không trigger N+1
    @strawberry.field
    async def posts(self, info: strawberry.types.Info) -> List[Post]:
        # DataLoader batches all posts() calls trong cùng một request
        loader: DataLoader = info.context["posts_loader"]
        return await loader.load(self.id)

# ---------- Query root ----------
@strawberry.type
class Query:

    @strawberry.field
    async def users(self, info: strawberry.types.Info) -> List[User]:
        # 1 query để lấy users
        return await db.execute("SELECT * FROM users LIMIT 20")

    @strawberry.field
    async def user(self, id: int, info: strawberry.types.Info) -> Optional[User]:
        loader: DataLoader = info.context["users_loader"]
        return await loader.load(id)

# ---------- Mutation ----------
@strawberry.input
class CreatePostInput:
    title: str
    content: str
    user_id: int

@strawberry.type
class Mutation:

    @strawberry.mutation
    async def create_post(self, input: CreatePostInput) -> Post:
        row = await db.execute(
            "INSERT INTO posts (title, content, user_id) VALUES ($1, $2, $3) RETURNING *",
            input.title, input.content, input.user_id
        )
        return Post(id=row.id, title=row.title, content=row.content)

# ---------- Schema + context with DataLoaders ----------
schema = strawberry.Schema(query=Query, mutation=Mutation)

# FastAPI integration
from strawberry.fastapi import GraphQLRouter

async def get_context() -> dict:
    return {
        "users_loader": DataLoader(load_fn=fetch_users_by_ids),
        # posts_loader: batch posts per user, new DataLoader per request
        "posts_loader": DataLoader(load_fn=fetch_posts_by_user_ids),
    }

graphql_app = GraphQLRouter(schema, context_getter=get_context)
```

## Ứng Dụng Thực Tế

GraphQL phù hợp nhất cho BFF (Backend for Frontend) layer nơi nhiều loại client (mobile, web, third-party) cần các shape khác nhau của cùng một data. Netflix, GitHub, Shopify dùng GraphQL để cho phép client teams tự phục vụ data mà không cần backend tạo endpoint mới. N+1 vẫn là pitfall phổ biến nhất — DataLoader là bắt buộc cho production.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>GraphQL giải quyết vấn đề gì của REST mà REST không giải quyết được hiệu quả?</strong></summary>

**A:** REST có hai vấn đề cơ bản: over-fetching (endpoint `/users/{id}` trả về 20 field nhưng mobile chỉ cần 3 field — lãng phí bandwidth) và under-fetching (cần gọi nhiều endpoint để lấy đủ data cho một màn hình, tạo waterfall requests). GraphQL giải quyết bằng cách để client query chính xác những field cần, kể cả nested relationships, trong một request. Ngoài ra, GraphQL có strongly-typed schema là single source of truth — frontend biết chính xác data available và type của từng field mà không cần đọc documentation. Tuy nhiên, REST đơn giản hơn, caching dễ hơn (HTTP cache per URL), và phù hợp hơn khi resource model rõ ràng. GraphQL có chi phí cao hơn: phức tạp server-side, N+1 risk, caching phức tạp, và query security cần thiết kế cẩn thận.

</details>

<details>
<summary><strong>N+1 problem trong GraphQL là gì và DataLoader giải quyết thế nào?</strong></summary>

**A:** N+1 xuất hiện khi query danh sách và resolver cho mỗi item lại tự trigger query riêng: query 1 lần lấy 100 users, sau đó resolver `posts` của mỗi user trigger 1 query riêng → tổng 101 queries. DataLoader giải quyết bằng hai cơ chế: batching (gom tất cả `.load(userId)` calls trong cùng một tick của event loop thành một batch query `WHERE user_id IN (...)`) và caching (trong phạm vi một request, cùng key không bị fetch lại). DataLoader phải được tạo mới cho mỗi request (không share giữa requests) để tránh data leakage giữa users. Kết quả: 101 queries giảm còn 2 queries (1 cho users, 1 batch cho all posts). Đây là pattern bắt buộc trong GraphQL production — không có DataLoader, GraphQL với nested resolvers sẽ dễ làm database overwhelmed.

</details>

<details>
<summary><strong>REST vs GraphQL — khi nào nên chọn GraphQL thay vì REST?</strong></summary>

**A:** Chọn GraphQL khi: (1) nhiều loại client (mobile/web/TV) cần data shapes khác nhau từ cùng một backend, (2) frontend team cần flexibility tự phục vụ data mà không phụ thuộc backend tạo endpoint mới, (3) domain phức tạp với nhiều entity relationships cần fetch trong một roundtrip, (4) đang xây dựng public API cho developer ecosystem muốn self-discoverable schema. Giữ REST khi: (1) API đơn giản với resource model rõ ràng, (2) cần HTTP caching mạnh (CDN cache per URL), (3) team nhỏ và không có use case rõ ràng cho GraphQL complexity, (4) file upload là core use case (GraphQL multipart phức tạp), (5) microservice internal communication (gRPC phù hợp hơn). GraphQL không phải silver bullet — overhead của security (depth/complexity limiting), caching (phải dùng persisted queries hoặc CDN workaround), và learning curve cần được cân nhắc kỹ.

</details>
