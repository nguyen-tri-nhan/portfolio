---
key: "rag-pattern"
title: "RAG - Retrieval Augmented Generation"
crumb: "17. AI & Agents › Production AI"
---

RAG giải quyết vấn đề LLM không có knowledge về dữ liệu private hoặc real-time bằng cách retrieve relevant documents và inject vào prompt trước khi generate — không cần fine-tune.

## Điểm Chính

- <strong>RAG pipeline</strong>: document ingestion (load → split → embed → store) tách biệt với query pipeline (embed query → retrieve → augment context → generate).
- <strong>Chunking strategies</strong>: fixed-size (đơn giản, có thể cắt giữa câu), recursive (ưu tiên tách tại paragraph/sentence boundary), semantic (group by topic), document-structure (theo headings).
- <strong>Embedding models</strong>: `text-embedding-3-small` (OpenAI, cost-effective), `sentence-transformers/all-mpnet-base-v2` (open source), `text-multilingual-embedding-002` (Google, đa ngôn ngữ).
- <strong>Vector stores</strong>: Pinecone (managed, production), pgvector (PostgreSQL extension, existing infra), Qdrant (self-hosted, high performance), ChromaDB (local dev).
- <strong>Similarity search</strong>: cosine similarity trả về top-K documents gần nhất — nhanh nhưng có thể trả về duplicates hay off-topic documents.
- <strong>MMR (Maximal Marginal Relevance)</strong>: cân bằng relevance và diversity — tránh trả về 5 documents nói về cùng một điều.
- <strong>Hybrid search</strong>: kết hợp keyword search (BM25) và semantic search — keyword tốt cho exact matches (tên riêng, mã sản phẩm), semantic tốt cho concept matching.
- <strong>Re-ranking</strong>: dùng cross-encoder model score lại top-K results từ retrieval — chậm hơn nhưng precision cao hơn nhiều.

## Ví Dụ Code

*Production RAG system với hybrid search, re-ranking, và async pipeline cho SaaS documentation Q&A*

```python
import asyncio
from dataclasses import dataclass
from typing import Optional
import asyncpg
from openai import AsyncOpenAI
from sentence_transformers import CrossEncoder

client = AsyncOpenAI()

@dataclass
class Document:
    id: str
    content: str
    metadata: dict
    score: float = 0.0

# ─── Ingestion Pipeline ─────────────────────────────────────────────────────

class DocumentIngester:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    def recursive_split(self, text: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
        """Split text respecting sentence boundaries."""
        separators = ["\n\n", "\n", ". ", "! ", "? ", " "]
        for sep in separators:
            if sep in text and len(text) > chunk_size:
                parts = text.split(sep)
                chunks, current = [], ""
                for part in parts:
                    if len(current) + len(part) < chunk_size:
                        current += part + sep
                    else:
                        if current:
                            chunks.append(current.strip())
                        current = part + sep
                if current:
                    chunks.append(current.strip())
                # Add overlap: prepend end of previous chunk
                overlapped = []
                for i, chunk in enumerate(chunks):
                    if i > 0:
                        prev_end = chunks[i - 1][-overlap:]
                        chunk = prev_end + " " + chunk
                    overlapped.append(chunk)
                return overlapped
        return [text]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Batch embed for efficiency — reduces API calls."""
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=texts
        )
        return [item.embedding for item in response.data]

    async def ingest(self, doc_id: str, content: str, metadata: dict):
        chunks = self.recursive_split(content)
        embeddings = await self.embed_batch(chunks)

        async with self.pool.acquire() as conn:
            await conn.executemany(
                """INSERT INTO rag_documents (doc_id, chunk_index, content, embedding, metadata)
                   VALUES ($1, $2, $3, $4, $5)
                   ON CONFLICT (doc_id, chunk_index) DO UPDATE SET
                       content = EXCLUDED.content, embedding = EXCLUDED.embedding""",
                [(doc_id, i, chunk, emb, metadata)
                 for i, (chunk, emb) in enumerate(zip(chunks, embeddings))]
            )

# ─── Retrieval Pipeline ─────────────────────────────────────────────────────

class HybridRetriever:
    def __init__(self, pool: asyncpg.Pool, reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.pool = pool
        self.reranker = CrossEncoder(reranker_model)

    async def semantic_search(self, query_embedding: list[float], top_k: int = 20) -> list[Document]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT doc_id, content, metadata,
                          1 - (embedding <=> $1) AS score
                   FROM rag_documents
                   ORDER BY embedding <=> $1 LIMIT $2""",
                query_embedding, top_k
            )
        return [Document(id=r["doc_id"], content=r["content"],
                         metadata=r["metadata"], score=r["score"]) for r in rows]

    async def keyword_search(self, query: str, top_k: int = 20) -> list[Document]:
        """BM25-style full-text search via PostgreSQL tsvector."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT doc_id, content, metadata,
                          ts_rank(to_tsvector('english', content), plainto_tsquery($1)) AS score
                   FROM rag_documents
                   WHERE to_tsvector('english', content) @@ plainto_tsquery($1)
                   ORDER BY score DESC LIMIT $2""",
                query, top_k
            )
        return [Document(id=r["doc_id"], content=r["content"],
                         metadata=r["metadata"], score=r["score"]) for r in rows]

    def rerank(self, query: str, documents: list[Document], top_k: int = 5) -> list[Document]:
        """Cross-encoder reranking for precision — runs after initial retrieval."""
        pairs = [(query, doc.content) for doc in documents]
        scores = self.reranker.predict(pairs)
        for doc, score in zip(documents, scores):
            doc.score = float(score)
        return sorted(documents, key=lambda d: d.score, reverse=True)[:top_k]

    async def retrieve(self, query: str, top_k: int = 5) -> list[Document]:
        """Hybrid retrieval: semantic + keyword, deduplicate, rerank."""
        query_emb_response = await client.embeddings.create(
            model="text-embedding-3-small", input=query
        )
        query_embedding = query_emb_response.data[0].embedding

        # Parallel semantic + keyword search
        semantic_docs, keyword_docs = await asyncio.gather(
            self.semantic_search(query_embedding, top_k=20),
            self.keyword_search(query, top_k=20)
        )

        # Merge and deduplicate by content
        seen, merged = set(), []
        for doc in semantic_docs + keyword_docs:
            if doc.content not in seen:
                seen.add(doc.content)
                merged.append(doc)

        return self.rerank(query, merged, top_k=top_k)

async def generate_answer(query: str, docs: list[Document]) -> str:
    context = "\n\n---\n\n".join(
        f"[Source {i+1}]: {doc.content}" for i, doc in enumerate(docs)
    )
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Answer based on provided context only. If answer not in context, say so."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}
        ]
    )
    return response.choices[0].message.content
```

## Ứng Dụng Thực Tế

Trong SaaS platform, RAG được dùng cho documentation Q&A bot: ingest toàn bộ product docs, release notes, và support tickets vào pgvector. Hybrid search giúp bot tìm chính xác theo tên feature (keyword) lẫn theo intent người dùng (semantic). Re-ranking với cross-encoder giảm hallucination vì chỉ đưa top-5 most relevant chunks vào context thay vì 20 chunks nhiễu.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>RAG vs fine-tuning — khi nào nên dùng cái nào?</strong></summary>

**A:** RAG phù hợp khi: dữ liệu thay đổi thường xuyên (product catalog, support docs), cần cite sources, data quá lớn để fit vào fine-tuning, hoặc cần data isolation (multi-tenant). Fine-tuning phù hợp khi: muốn model học writing style hay domain-specific format, need faster inference (no retrieval step), hay task yêu cầu deep domain knowledge không phải fact lookup. Trong thực tế, nhiều production systems dùng cả hai: fine-tune model cho domain style, RAG cho current knowledge. Fine-tuning đắt và chậm hơn để update; RAG update real-time bằng cách ingest document mới.

</details>

<details>
<summary><strong>Chunk size ảnh hưởng thế nào đến RAG quality?</strong></summary>

**A:** Chunk quá nhỏ (< 100 tokens): mất context — chunk có thể chỉ là một câu không đủ ý nghĩa, retrieval không hiệu quả. Chunk quá lớn (> 1000 tokens): giảm retrieval precision — chunk có nhiều topic khác nhau, embedding biểu diễn "trung bình" không capture topic cụ thể nào tốt, tốn token khi inject vào context. Sweet spot thường là 256-512 tokens với 10-15% overlap. Overlap quan trọng để tránh mất thông tin ở ranh giới chunk. Với hierarchical documents, có thể dùng two-level: chunk nhỏ để retrieval, đưa vào context chunk to hơn chứa chunk đó để đủ context.

</details>

<details>
<summary><strong>Hybrid search là gì và tại sao tốt hơn pure semantic search?</strong></summary>

**A:** Hybrid search kết hợp BM25/keyword search với vector semantic search, thường dùng Reciprocal Rank Fusion (RRF) để merge kết quả. Semantic search tốt cho: understanding intent, synonyms, conceptual matches — "purchase" tìm được "buy", "acquire". Keyword search tốt cho: exact matches, proper nouns, code snippets, product IDs, version numbers. Pure semantic search thất bại khi user tìm "error code E4027" — embedding không capture chuỗi ký tự chính xác. Hybrid là best of both worlds: ví dụ tìm "Redis timeout configuration" — keyword match "Redis timeout" chính xác, semantic match "connection config" theo concept.

</details>
