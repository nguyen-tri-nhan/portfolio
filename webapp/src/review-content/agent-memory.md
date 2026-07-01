---
key: "agent-memory"
title: "Agent Memory Systems"
crumb: "17. AI & Agents › AI Agent Fundamentals"
---

Agent memory quyết định agent "nhớ" được gì giữa các turn và session — thiếu memory đúng đắn, agent phải bắt đầu từ đầu mỗi lần, không thể học từ past interactions.

## Điểm Chính

- <strong>In-context memory</strong>: conversation history nhét thẳng vào system/user messages — đơn giản nhất nhưng bị giới hạn bởi context window (thường 128K-1M tokens).
- <strong>External memory (vector store)</strong>: embed và lưu text chunks vào vector database, retrieve bằng semantic similarity — phù hợp cho knowledge base lớn.
- <strong>Episodic memory</strong>: lưu lại các interaction cụ thể từ quá khứ (ai hỏi gì, agent trả lời gì, outcome ra sao) để agent học từ kinh nghiệm.
- <strong>Semantic memory</strong>: facts và knowledge base tổng quát — ít thay đổi, thường là product catalog, FAQs, documentation.
- <strong>Sliding window</strong>: chỉ giữ N message gần nhất trong context, drop messages cũ — đơn giản nhưng mất context dài hạn.
- <strong>Summarization</strong>: dùng LLM tóm tắt conversation cũ thành dense summary trước khi drop — giữ được key info với ít token hơn.
- <strong>Retrieval-Augmented Memory</strong>: hybrid — lưu tất cả vào vector store, chỉ retrieve relevant memories vào context khi cần.

## Ví Dụ Code

*Long-term memory cho customer support agent dùng pgvector — kết hợp episodic và semantic memory*

```python
import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import asyncpg
from openai import AsyncOpenAI

client = AsyncOpenAI()

@dataclass
class Memory:
    content: str
    memory_type: str  # "episodic" | "semantic"
    user_id: Optional[str]
    created_at: datetime
    relevance_score: float = 0.0

class AgentMemoryStore:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def setup(self):
        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE EXTENSION IF NOT EXISTS vector;
                CREATE TABLE IF NOT EXISTS agent_memories (
                    id SERIAL PRIMARY KEY,
                    content TEXT NOT NULL,
                    memory_type VARCHAR(20) NOT NULL,
                    user_id VARCHAR(100),
                    embedding vector(1536),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS memories_embedding_idx
                    ON agent_memories USING ivfflat (embedding vector_cosine_ops);
            """)

    async def _embed(self, text: str) -> list[float]:
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding

    async def store_episodic(self, user_id: str, interaction_summary: str, metadata: dict = None):
        """Store a past interaction as episodic memory."""
        embedding = await self._embed(interaction_summary)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO agent_memories (content, memory_type, user_id, embedding, metadata)
                   VALUES ($1, 'episodic', $2, $3, $4)""",
                interaction_summary, user_id, embedding, metadata or {}
            )

    async def store_semantic(self, fact: str):
        """Store a product/domain fact as semantic memory."""
        embedding = await self._embed(fact)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO agent_memories (content, memory_type, embedding)
                   VALUES ($1, 'semantic', $2)""",
                fact, embedding
            )

    async def retrieve_relevant(
        self, query: str, user_id: Optional[str] = None, top_k: int = 5
    ) -> list[Memory]:
        """Semantic search — retrieve memories most relevant to current query."""
        query_embedding = await self._embed(query)
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT content, memory_type, user_id, created_at,
                          1 - (embedding <=> $1) AS score
                   FROM agent_memories
                   WHERE ($2::text IS NULL OR user_id = $2 OR memory_type = 'semantic')
                   ORDER BY embedding <=> $1
                   LIMIT $3""",
                query_embedding, user_id, top_k
            )
        return [Memory(
            content=r["content"], memory_type=r["memory_type"],
            user_id=r["user_id"], created_at=r["created_at"],
            relevance_score=r["score"]
        ) for r in rows]

async def build_context_with_memory(
    store: AgentMemoryStore, user_id: str, current_query: str, history: list[dict]
) -> str:
    memories = await store.retrieve_relevant(current_query, user_id=user_id, top_k=4)

    memory_text = ""
    if memories:
        memory_text = "\n## Relevant Context from Memory:\n"
        for m in memories:
            tag = f"[{m.memory_type.upper()}]"
            memory_text += f"- {tag} {m.content}\n"

    # Sliding window: keep last 10 messages to stay within token budget
    recent_history = history[-10:]
    history_text = "\n".join(
        f"{m['role'].title()}: {m['content']}" for m in recent_history
    )

    return f"{memory_text}\n## Conversation:\n{history_text}\nUser: {current_query}"
```

## Ứng Dụng Thực Tế

Trong SaaS support platform, agent memory giúp support bot nhớ rằng user A đã báo lỗi tương tự 2 tuần trước (episodic) và biết product changelog mới nhất (semantic) — từ đó có thể trả lời "Lỗi này đã được fix trong version 3.2 mà bạn chưa update" thay vì hỏi lại từ đầu. Kết hợp pgvector với PostgreSQL giúp tận dụng hạ tầng DB sẵn có thay vì phải dùng vector DB riêng.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao không để toàn bộ history trong context mà cần memory management?</strong></summary>

**A:** Context window có giới hạn (dù GPT-4o có 128K tokens, Gemini có 1M tokens) và chi phí tăng tuyến tính theo số tokens. Với long-running conversations hay multi-session agents, history có thể vượt giới hạn này. Ngoài ra, đưa quá nhiều irrelevant history vào context thực tế làm giảm quality — LLM bị "distracted" bởi noise. Giải pháp: sliding window cho recent context, summarization cho history cũ, và semantic retrieval để chỉ pull relevant memories khi cần. Đây là bài toán cân bằng giữa recall và precision.

</details>

<details>
<summary><strong>Episodic memory vs semantic memory khác nhau thế nào trong agent design?</strong></summary>

**A:** Episodic memory lưu "chuyện gì đã xảy ra" — các interaction cụ thể với context và outcome (user X hỏi Y, agent trả lời Z, user hài lòng/không hài lòng). Semantic memory lưu "biết gì" — facts tổng quát không gắn với interaction cụ thể (product specs, pricing, policies). Trong agent design, episodic memory giúp personalization và learning từ past mistakes; semantic memory là knowledge base tĩnh phục vụ mọi user. Phân tách rõ giúp retrieval chính xác hơn — khi user hỏi về product, chỉ search semantic; khi cần personalize, search episodic của user đó.

</details>

<details>
<summary><strong>Implement long-term memory cho agent như thế nào trong production?</strong></summary>

**A:** Pattern phổ biến: sau mỗi conversation kết thúc, dùng LLM tóm tắt interaction thành 2-3 câu key facts và store vào vector DB với user_id. Khi conversation mới bắt đầu, retrieve top-K memories liên quan nhất bằng semantic search và inject vào system prompt. Cần xử lý: memory staleness (đánh dấu outdated khi info thay đổi), privacy (user có quyền xóa memories của họ), và memory quality (filter out trivial interactions trước khi store). Trong production, nên có memory consolidation job chạy định kỳ để merge/deduplicate similar memories và giảm storage cost.

</details>
