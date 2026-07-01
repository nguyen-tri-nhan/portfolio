---
key: "langgraph"
title: "LangGraph - Graph-Based Agent Framework"
crumb: "17. AI & Agents › Frameworks"
---

LangGraph mô hình hóa agent workflow như một directed graph với nodes (processing steps) và edges (routing logic) — cho phép cycles, branching phức tạp, và human-in-the-loop mà sequential chains không làm được.

## Điểm Chính

- <strong>State</strong>: TypedDict shared across toàn bộ graph — mỗi node nhận state và trả về dict để update state, pattern giống Redux.
- <strong>Nodes</strong>: Python functions (sync hoặc async) nhận `state` và trả về partial state updates — có thể là LLM call, tool execution, hay business logic.
- <strong>Edges</strong>: fixed (luôn đi từ A → B) hoặc conditional (router function quyết định đi đâu dựa trên state) — cho phép dynamic branching.
- <strong>Cycles</strong>: LangGraph cho phép edge từ node N quay lại node trước đó — điều mà LangChain chains không làm được, thiết yếu cho agentic loops.
- <strong>Checkpointer</strong>: lưu state sau mỗi node — cho phép resume interrupted runs, time-travel debugging, và multi-session persistence.
- <strong>Human-in-the-loop</strong>: `interrupt_before` hoặc `interrupt_after` node — graph pause, trả control cho human, resume sau khi có input.
- <strong>Subgraphs</strong>: graph lồng trong graph — reusable workflow components, isolation của sub-problems.
- <strong>LangGraph vs LangChain</strong>: chains là linear pipelines không có cycles; LangGraph là stateful graph supporting cycles, branching, interrupts.

## Ví Dụ Code

*LangGraph agent với human-in-the-loop: code review workflow với conditional routing và state persistence*

```python
import asyncio
from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

# ─── State Schema ──────────────────────────────────────────────────────────

class CodeReviewState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    code_snippet: str
    review_result: str
    severity: Literal["low", "medium", "high", ""]
    approved: bool
    iteration_count: int
    human_feedback: str

# ─── LLM Setup ────────────────────────────────────────────────────────────

llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.1)

# ─── Node Functions ────────────────────────────────────────────────────────

async def analyze_code(state: CodeReviewState) -> dict:
    """LLM analyzes code and assigns severity."""
    prompt = f"""Review this code for security and quality issues:

```
{state['code_snippet']}
```

Respond with:
SEVERITY: [low|medium|high]
ISSUES: [bullet list of issues]
SUGGESTIONS: [specific improvements]"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    review_text = response.content

    # Extract severity from response
    severity = "low"
    if "SEVERITY: high" in review_text.upper():
        severity = "high"
    elif "SEVERITY: medium" in review_text.upper():
        severity = "medium"

    return {
        "review_result": review_text,
        "severity": severity,
        "messages": [AIMessage(content=f"Code analysis complete. Severity: {severity}")],
        "iteration_count": state.get("iteration_count", 0) + 1
    }

async def auto_approve(state: CodeReviewState) -> dict:
    """Auto-approve low severity issues."""
    return {
        "approved": True,
        "messages": [AIMessage(content="Auto-approved: low severity issues only.")]
    }

async def incorporate_human_feedback(state: CodeReviewState) -> dict:
    """Process human reviewer decision."""
    feedback = state.get("human_feedback", "")
    approved = "approve" in feedback.lower() or "lgtm" in feedback.lower()
    return {
        "approved": approved,
        "messages": [AIMessage(content=f"Human review decision: {'APPROVED' if approved else 'REJECTED'}")]
    }

async def generate_fix(state: CodeReviewState) -> dict:
    """Generate improved code based on review + human feedback."""
    prompt = f"""Fix the following code based on this review and feedback:

Original code:
```
{state['code_snippet']}
```

Review: {state['review_result']}
Human feedback: {state.get('human_feedback', 'N/A')}

Provide only the corrected code."""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return {"messages": [AIMessage(content=f"Fixed code:\n{response.content}")]}

# ─── Conditional Routing ───────────────────────────────────────────────────

def route_by_severity(state: CodeReviewState) -> Literal["auto_approve", "human_review"]:
    """Route to auto-approve for low severity, human review for medium/high."""
    return "auto_approve" if state["severity"] == "low" else "human_review"

def route_after_human(state: CodeReviewState) -> Literal["generate_fix", "end"]:
    """After human review: fix if approved, end if rejected."""
    return "generate_fix" if state["approved"] else "end"

# ─── Graph Construction ────────────────────────────────────────────────────

def build_code_review_graph() -> StateGraph:
    graph = StateGraph(CodeReviewState)

    graph.add_node("analyze_code", analyze_code)
    graph.add_node("auto_approve", auto_approve)
    graph.add_node("human_review", incorporate_human_feedback)
    graph.add_node("generate_fix", generate_fix)

    graph.add_edge(START, "analyze_code")
    graph.add_conditional_edges("analyze_code", route_by_severity)
    graph.add_edge("auto_approve", END)
    graph.add_conditional_edges("human_review", route_after_human)
    graph.add_edge("generate_fix", END)

    return graph

# ─── Execution with human-in-the-loop ─────────────────────────────────────

async def run_code_review(code: str):
    graph = build_code_review_graph()
    checkpointer = MemorySaver()

    # interrupt_before "human_review" node to wait for human input
    app = graph.compile(
        checkpointer=checkpointer,
        interrupt_before=["human_review"]
    )

    config = {"configurable": {"thread_id": "review-001"}}
    initial_state = CodeReviewState(
        messages=[], code_snippet=code, review_result="",
        severity="", approved=False, iteration_count=0, human_feedback=""
    )

    # Run until interrupt
    async for event in app.astream(initial_state, config):
        print(f"Node executed: {list(event.keys())}")

    # Human provides feedback
    human_input = input("Approve or reject? (type 'approve' or reason for rejection): ")
    await app.aupdate_state(config, {"human_feedback": human_input})

    # Resume from interrupt
    async for event in app.astream(None, config):
        for values in event.values():
            if "messages" in values:
                print(values["messages"][-1].content)
```

## Ứng Dụng Thực Tế

Trong CI/CD automation system, LangGraph workflow xử lý pull request: analyze_code node chạy static analysis, conditional edge route PR có security issue tới security_review node (human-in-the-loop), còn PR bình thường tới auto_merge. Checkpointer lưu state — nếu job bị kill giữa chừng, pipeline resume từ đúng node đã interrupted mà không restart từ đầu.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>LangGraph vs LangChain về mặt kiến trúc — tại sao cần LangGraph?</strong></summary>

**A:** LangChain chains là LCEL pipelines tuyến tính: A | B | C — data chảy một chiều, không có cycles, không có state được share giữa các bước. LangGraph khắc phục hạn chế này: graph-based với typed state shared across nodes, edges có thể conditional và cyclic, cho phép agent loop (LLM → tool → LLM → tool → ...). LangGraph cũng hỗ trợ parallel branches, human-in-the-loop interrupts, và checkpointing — những tính năng thiết yếu cho production agents nhưng không có trong LangChain chains thuần.

</details>

<details>
<summary><strong>Tại sao graph-based tốt hơn sequential chain cho complex agent workflows?</strong></summary>

**A:** Sequential chains assume fixed execution order và không có branching — không phù hợp khi workflow cần: (1) Dynamic routing (nếu kết quả X thì đi path A, không thì path B); (2) Cycles/loops (retry sau fail, refinement iterations); (3) Parallel execution (chạy nhiều nhánh đồng thời); (4) Early termination (stop sớm khi condition met). Graph-based approach biểu diễn chính xác state machine của workflow, dễ visualize và debug. LangGraph cũng expose state rõ ràng — developer biết chính xác data nào được pass qua, không phải đoán qua chain magic.

</details>

<details>
<summary><strong>Implement human-in-the-loop trong LangGraph như thế nào?</strong></summary>

**A:** Dùng `interrupt_before` hoặc `interrupt_after` khi compile graph: `app = graph.compile(interrupt_before=["approval_node"])`. Khi graph chạy tới node đó, nó tự động pause và return control. State hiện tại được save vào checkpointer. Human có thể inspect state, đưa ra quyết định, rồi update state via `app.aupdate_state(config, {"decision": "approve"})`. Resume graph bằng cách call `app.astream(None, config)` — None thay vì initial state vì resume từ checkpoint. Pattern này phù hợp cho: approval workflows, ambiguous decisions cần human judgment, và agent safety checks.

</details>
