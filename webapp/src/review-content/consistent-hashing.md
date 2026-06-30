---
key: "Consistent Hashing"
title: "Consistent Hashing"
crumb: "7. System Design › Load Balancing"
---

Consistent hashing map key lên node trên vòng tròn ảo, giảm thiểu remap key khi node được thêm hoặc xóa — thiết yếu cho distributed cache và sharding.

## Điểm Chính

- Traditional hashing: <code>node = hash(key) % N</code>. Thêm/xóa node → remap gần như tất cả key.
- Consistent hashing: đặt node trên vòng (0–2³²). Key map đến node tiếp theo theo chiều kim đồng hồ.
- Thêm node: chỉ key giữa node mới và predecessor được remap. Trung bình N/K key mỗi node.
- Virtual node (vnode): mỗi physical node có nhiều điểm trên vòng → phân phối tốt hơn.
- Được dùng bởi: DynamoDB, Cassandra, Redis Cluster, CDN, load balancer.

## Ví Dụ Code

*Consistent hash ring với TreeMap + virtual nodes; Redis Cluster / Cassandra / DynamoDB usage*

```java
// Consistent hashing: minimize key remap when nodes added/removed
// Problem: hash(key) % N → adding 1 node remaps ~N/(N+1) keys (cache stampede!)
// Solution: consistent hashing remaps only ~K/N keys on average

// Java: TreeMap as consistent hash ring
public class ConsistentHashRouter {
    private final TreeMap<Integer, String> ring = new TreeMap<>();
    private static final int VNODES_PER_NODE = 150; // virtual nodes for even distribution

    public void addNode(String nodeId) {
        for (int i = 0; i < VNODES_PER_NODE; i++) {
            int hash = hash(nodeId + "-vnode-" + i);
            ring.put(hash, nodeId); // each physical node has 150 positions on ring
        }
    }

    public void removeNode(String nodeId) {
        for (int i = 0; i < VNODES_PER_NODE; i++) {
            ring.remove(hash(nodeId + "-vnode-" + i));
        }
    }

    // Route request to node: find next clockwise position from key's hash
    public String getNode(String key) {
        if (ring.isEmpty()) throw new IllegalStateException("No nodes available");
        int hash = hash(key);
        Map.Entry<Integer, String> entry = ring.ceilingEntry(hash);
        return (entry != null ? entry : ring.firstEntry()).getValue(); // wrap around
    }

    private int hash(String key) {
        // Use MurmurHash or MD5 for better distribution than Java hashCode()
        return Math.abs(key.hashCode()) % Integer.MAX_VALUE;
    }
}

// Usage: route order-events cache lookups to same node
// ConsistentHashRouter router = new ConsistentHashRouter();
// router.addNode("cache-node-1"); router.addNode("cache-node-2"); router.addNode("cache-node-3");
// String node = router.getNode("product-" + productId); // always same node for same productId
// redisNodes.get(node).get("product:" + productId);

// Real-world usage:
// Redis Cluster: 16384 hash slots distributed across nodes via consistent hashing
// Cassandra: token ring — each node owns a token range
// DynamoDB: partition key → consistent hash → storage node
// CDN: consistent hash to pick which edge server caches a URL
```

## Ứng Dụng Thực Tế

Khi xây dựng distributed cache hoặc session store, consistent hashing đảm bảo thêm/xóa cache node chỉ phân phối lại ~1/N key. Không có nó, node hỏng hoặc thêm gây cache stampede (tất cả key miss đồng thời).

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao consistent hashing tốt hơn simple modulo sharding?</strong></summary>

**A:** Modulo (hash(key) % N): thêm/bớt 1 node → N thay đổi → hầu hết keys map sang node khác → massive data movement. Consistent hashing: nodes placed on ring by hash; key routes to nearest node clockwise. Thêm 1 node: chỉ keys của adjacent section cần move (~1/N keys). Bớt 1 node: chỉ keys của node đó move sang successor. Consistent hashing dùng trong: Cassandra, DynamoDB, Memcached, Redis Cluster, Nginx upstream (consistent_hash).

</details>

<details>
<summary><strong>Virtual nodes giải quyết vấn đề gì?</strong></summary>

**A:** Không có virtual nodes: 3 nodes → 3 points trên ring → uneven distribution (120° mỗi node lý tưởng, nhưng hash không uniform). Thêm node → một node chịu nhiều hơn (hotspot). Virtual nodes: mỗi physical node có V virtual positions trên ring (V thường = 100-200). Kết quả: phân phối đồng đều hơn, thêm node = nhận một phần đều từ tất cả existing nodes (không chỉ từ adjacent node). Cassandra: virtual nodes (vnodes) là core của data distribution.

</details>

## Sơ Đồ Consistent Hashing Ring

```mermaid
flowchart LR
    subgraph Ring["Hash Ring (0 → 2^32 - 1)"]
        N1["Node A\nhash=100"] --> N2["Node B\nhash=250"] --> N3["Node C\nhash=400"] --> N1
        K1["Key X hash=150\n→ nearest clockwise = Node B"] -.-> N2
        K2["Key Y hash=350\n→ nearest clockwise = Node C"] -.-> N3
        K3["Key Z hash=50\n→ nearest clockwise = Node A"] -.-> N1
    end

    subgraph VN["Virtual Nodes (even distribution)"]
        NodeA["Node A"] <-- A1["A-vn1\nhash=30"] & A2["A-vn2\nhash=180"] & A3["A-vn3\nhash=380"]
        NodeB["Node B"] <-- B1["B-vn1\nhash=90"] & B2["B-vn2\nhash=280"]
    end
```
