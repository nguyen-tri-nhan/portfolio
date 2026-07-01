---
key: "Strong Consistency"
title: "Strong Consistency"
crumb: "7. System Design › Consistency Patterns"
---

Strong consistency (linearizability) đảm bảo mọi read thấy write gần nhất — như thể thao tác thực thi tuần tự trên một node, với chi phí latency cao hơn và availability thấp hơn.

## Điểm Chính

- Linearizability: thao tác xuất hiện tức thời; lịch sử nhất quán với model single-node.
- Cần: synchronous replication đến quorum trước khi acknowledge write, hoặc single-leader serialization.
- Hệ thống: PostgreSQL (trong single node), Google Spanner (globally consistent qua TrueTime), CockroachDB.
- Trade-off: write latency cao hơn (phải chờ quorum), availability giảm khi partition (CP).
- Use case: số dư tài chính, số lượng tồn kho, distributed lock, leader election.

## Ví Dụ Code

*Strong consistency: SERIALIZABLE isolation; PostgreSQL sync replication; Spanner TrueTime; distributed lock pattern*

```java
// Strong Consistency: every read returns the most recent committed write
// Required for: payment processing, inventory decrement, distributed locking

// 1. PostgreSQL: strong consistency by default (single-node ACID)
@Service @RequiredArgsConstructor
public class PaymentService {

    // SERIALIZABLE: strongest isolation — no phantom reads, no concurrent anomalies
    // Use for: financial transfer, inventory update
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public PaymentResult processPayment(String orderId, BigDecimal amount) {
        // Reads within this tx always see the latest committed data
        Account account = accountRepo.findByOrderId(orderId);
        if (account.getBalance().compareTo(amount) < 0) {
            throw new InsufficientFundsException(orderId, amount, account.getBalance());
        }
        account.debit(amount);
        accountRepo.save(account);
        return PaymentResult.success(orderId, amount);
    }

    // READ_COMMITTED (default): balance may update between reads within same tx
    // REPEATABLE_READ: same row returns same value within tx
    // SERIALIZABLE: no concurrent anomalies — behaves like sequential execution
}

// 2. Distributed strong consistency: PostgreSQL synchronous replication
// postgresql.conf: synchronous_commit = on  (default)
// → Primary waits for at least one replica WAL write before acknowledging commit
// synchronous_standby_names = 'replica-1'  → named standby must confirm
// Cost: write latency += replication round-trip (~1-5ms same datacenter)

// 3. Global strong consistency: Google Spanner / CockroachDB
// Uses TrueTime API (Spanner) or Hybrid Logical Clocks (CockroachDB)
// to assign globally monotonic timestamps across datacenters
// Reads at timestamp T guaranteed to see all commits before T globally

// 4. Application-level strong consistency with Redis distributed lock
@Transactional
public boolean reserveInventory(String productId, int qty) {
    RLock lock = redisson.getLock("lock:inventory:" + productId);
    lock.lock(10, TimeUnit.SECONDS); // exclusive lock → no concurrent decrement
    try {
        int available = inventoryRepo.getAvailableQty(productId);  // fresh read under lock
        if (available < qty) return false;
        inventoryRepo.decrement(productId, qty);
        return true;
    } finally {
        lock.unlock();
    }
}
// Strong: lock ensures only one thread decrements at a time → no oversell
// Cost: serialized writes (throughput limited by lock contention)
```

## Ứng Dụng Thực Tế

Dùng strong consistency cho thao tác nơi tính đúng đắn là tối quan trọng (tài chính, tồn kho). Chấp nhận chi phí latency. Thiết kế hệ thống cần strong consistency ở ít nơi hơn bằng cách đẩy state vào append-only event log và dùng eventual consistency cho derived view.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Strong consistency đảm bảo gì?</strong></summary>

**A:** Strong consistency đảm bảo: sau khi write thành công, **mọi subsequent read** (từ bất kỳ node nào) sẽ thấy giá trị đã write — không bao giờ thấy stale data. Giống như single-machine behavior. Implement: (1) Single writer (primary/leader) — mọi write qua một node. (2) Synchronous replication — write không được ack cho đến khi tất cả replicas confirm. (3) Distributed consensus (Raft/Paxos) — majority quorum confirm write trước khi commit. Trade-off: latency cao (phải chờ replicas), availability giảm (network partition → reject write). Dùng: financial transactions, inventory system, leader election.

</details>

<details>
<summary><strong>Linearizability và serializability khác nhau thế nào?</strong></summary>

**A:** **Linearizability**: consistency model cho **single operations** — mỗi operation appear to take effect atomically at a single point in time, results consistent with a sequential order. Real-time constraint: nếu op A hoàn thành trước op B start, A phải appear before B. **Serializability**: isolation level cho **transactions** — concurrent transactions execute as if some serial order. Không cần real-time constraint — serial order không phải wall-clock order. **Strict serializability** = Linearizability + Serializability. Spanner (Google): externally-consistent (strict serializable) distributed transactions.

</details>

<details>
<summary><strong>Khi nào strong consistency gây performance problem?</strong></summary>

**A:** Strong consistency gây latency cao khi: (1) **Geographic distribution** — write phải wait cho remote replicas (Singapore → Frankfurt = 150ms RTT). (2) **High write contention** — many writers qua single leader. (3) **Network partition** — CAP theorem: CP system (strong consistency) sẽ reject requests khi partition xảy ra (availability sacrifice). Giải pháp: (1) Local reads từ nearest replica (compromise: đọc slightly stale). (2) Async replication + read-your-own-writes tracking. (3) Eventual consistency cho non-critical data, strong consistency chỉ khi really need.

</details>
