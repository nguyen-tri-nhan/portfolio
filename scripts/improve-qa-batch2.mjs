#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../webapp/src/review-content');

function qa(pairs) {
  const items = pairs.map(({ q, a }) =>
    `<details>\n<summary><strong>${q}</strong></summary>\n\n${a}\n\n</details>`
  ).join('\n\n');
  return `## Câu Hỏi Phỏng Vấn\n\n${items}\n`;
}

function replaceQA(content, newSection) {
  const marker = '## Câu Hỏi Phỏng Vấn';
  const start = content.indexOf(marker);
  if (start === -1) return null;
  const afterStart = start + marker.length;
  const nextSection = content.indexOf('\n## ', afterStart);
  const end = nextSection !== -1 ? nextSection : content.length;
  return content.slice(0, start) + newSection + content.slice(end);
}

const QA = {

'acid': qa([
  { q: 'Giải thích durability — cơ chế nào đảm bảo nó trong PostgreSQL?',
    a: `**A:** Durability đảm bảo dữ liệu tồn tại vĩnh viễn sau commit dù crash. PostgreSQL dùng **WAL (Write-Ahead Log)**: ghi thay đổi vào WAL file trước khi áp dụng vào data page; khi crash, replay WAL để phục hồi. \`fsync\` đảm bảo WAL thực sự xuống disk — tắt \`fsync\` có thể mất dữ liệu ngay cả khi commit thành công.` },
  { q: 'Isolation khác atomicity thế nào?',
    a: `**A:** **Atomicity** — transaction là "tất cả hoặc không có gì" (rollback nếu bất kỳ bước nào fail). **Isolation** — concurrent transaction không thấy intermediate state của nhau. Ví dụ transfer: atomicity đảm bảo cả debit lẫn credit xảy ra cùng lúc; isolation đảm bảo transaction khác không thấy trạng thái "đã trừ nhưng chưa cộng".` },
  { q: 'BASE có nghĩa gì và DB NoSQL nào theo nó?',
    a: `**A:** BASE = **Basically Available, Soft state, Eventually consistent** — đối lập ACID. Hệ thống luôn trả lời (dù có thể stale), state có thể thay đổi do replication, và các replica hội tụ sau thời gian không có update mới. NoSQL theo BASE: **Cassandra**, **DynamoDB** (eventual consistency mặc định), **CouchDB** — ưu tiên availability hơn strong consistency.` },
]),

'abstraction': qa([
  { q: 'Khi nào dùng abstract class thay vì interface?',
    a: `**A:** Dùng **abstract class** khi cần chia sẻ state (instance fields) hoặc constructor logic giữa các subclass, hoặc muốn template method pattern với protected helpers. Dùng **interface** khi chỉ định nghĩa contract/capability, muốn đa kế thừa behavior, hoặc không cần shared state. Java 8 default methods thu hẹp khoảng cách, nhưng abstract class vẫn cần khi cần protected/package-private members.` },
  { q: 'Default method trong Java 8 interface thay đổi điều gì?',
    a: `**A:** Trước Java 8, không thể thêm method vào interface mà không phá vỡ tất cả implementation. **Default method** cho phép evolve API mà không breaking change — ví dụ \`Collection.stream()\`, \`Map.getOrDefault()\` được thêm vào Java 8 mà không cần sửa existing code. Khi class implement nhiều interface có default method cùng tên → compile error, phải override để giải quyết.` },
  { q: 'Abstraction hỗ trợ khả năng test như thế nào?',
    a: `**A:** Abstraction tách interface khỏi implementation, cho phép inject mock/stub trong test. Ví dụ: \`UserRepository\` interface → unit test dùng Mockito mock, không cần real DB. Không có abstraction: service hardcode \`new JpaUserRepository()\` → không thể test độc lập. Đây là foundation của **Dependency Inversion Principle** và testable code.` },
]),

'actuator': qa([
  { q: 'Spring Boot Actuator expose endpoint nào theo mặc định?',
    a: `**A:** Mặc định expose **tất cả endpoint qua JMX** nhưng chỉ **/health** và **/info** qua HTTP. Để expose thêm: \`management.endpoints.web.exposure.include=health,info,metrics,prometheus\`. Không expose \`/env\` và \`/beans\` public vì chúng lộ sensitive config và bean structure của application.` },
  { q: 'Làm thế nào để tạo custom health indicator?',
    a: `**A:** Implement interface \`HealthIndicator\` và annotate \`@Component\`:\n\`\`\`java\n@Component\npublic class DbHealthIndicator implements HealthIndicator {\n    public Health health() {\n        try { checkDb(); return Health.up().build(); }\n        catch (Exception e) { return Health.down().withDetail("error", e.getMessage()).build(); }\n    }\n}\n\`\`\`\nSpring Boot tự động include vào \`/actuator/health\`. Detail chỉ hiển thị khi \`management.endpoint.health.show-details=always\`.` },
  { q: 'Làm thế nào để bảo mật các Actuator endpoint?',
    a: `**A:** Hai hướng: (1) **Network level** — chạy Actuator trên port riêng (\`management.server.port=8081\`) và block port đó bằng firewall. (2) **Spring Security** — thêm rule \`EndpointRequest.toAnyEndpoint().hasRole("ADMIN")\`. Best practice: \`/health/liveness\` và \`/health/readiness\` public cho K8s probe; \`/env\`, \`/beans\`, \`/heapdump\` chỉ cho authenticated admin.` },
]),

'algorithms': qa([
  { q: 'Tại sao Least Connections tốt hơn Round Robin cho long-lived connection?',
    a: `**A:** Round Robin phân phối đều theo vòng tròn bất kể trạng thái server. Với long-lived connection (WebSocket, DB connection), một server có thể đang giữ 100 connection chậm trong khi server khác chỉ có 10 — Round Robin vẫn gửi đều → overload. **Least Connections** gửi request mới đến server ít active connection nhất, phù hợp khi request có thời gian xử lý không đều.` },
  { q: 'Thuật toán power-of-two-choices là gì?',
    a: `**A:** Thay vì scan tất cả N server (O(N)), chọn ngẫu nhiên **2 server** và gửi đến server ít connection hơn trong hai — O(1). Lý thuyết chứng minh phân phối gần optimal với xác suất cao. Dùng bởi Nginx, HAProxy và nhiều cloud LB. Trade-off: không globally optimal nhưng rất tốt trong practice với overhead cực thấp.` },
  { q: 'Khi nào bạn dùng IP Hash cho load balancing?',
    a: `**A:** IP Hash luôn route request từ cùng client IP đến cùng server — tạo **sticky session** cho app có in-memory session chưa externalize ra Redis. Nhược điểm: phân phối không đều khi nhiều user sau cùng NAT IP; server down → mất toàn bộ session của nhóm. Best practice: externalize session vào Redis để không cần IP Hash.` },
]),

'atomic-classes': qa([
  { q: 'Compare-And-Swap là gì và hoạt động thế nào?',
    a: `**A:** CAS là atomic CPU instruction: chỉ ghi giá trị mới vào địa chỉ bộ nhớ nếu giá trị hiện tại bằng expected — trả về true/false. Java \`AtomicInteger.compareAndSet()\` map xuống \`CMPXCHG\` (x86). Không cần lock; hardware đảm bảo atomicity. CAS loop: đọc value → tính value mới → CAS; nếu fail (thread khác thay đổi) → retry — là foundation của lock-free data structures.` },
  { q: 'Khi nào bạn chọn LongAdder thay vì AtomicLong?',
    a: `**A:** \`AtomicLong\` dùng CAS trên một cell — high contention gây CAS retry liên tục, waste CPU. \`LongAdder\` chia thành nhiều **striped cells**, mỗi thread update cell riêng, giảm contention drastically; \`sum()\` cộng tất cả cell khi cần. Dùng **LongAdder** cho counter/metric chỉ cần tổng cuối; **AtomicLong** khi cần atomic CAS hoặc get-and-set cụ thể.` },
  { q: 'ABA problem là gì và bạn giải quyết nó thế nào?',
    a: `**A:** Thread 1 đọc A, bị preempt. Thread 2 đổi A→B→A. Thread 1 quay lại, CAS thấy A và thành công — nhưng đã có thay đổi trung gian bị bỏ qua. Giải pháp: **\`AtomicStampedReference\`** — thêm version/stamp vào pair (value, stamp); CAS chỉ thành công khi cả value lẫn stamp khớp, nên A(v1)→B(v2)→A(v3) → CAS fail vì stamp v1≠v3.` },
]),

'atomicinteger': qa([
  { q: 'getAndIncrement() đảm bảo atomicity bằng cách nào?',
    a: `**A:** Dùng **CAS loop**: đọc value hiện tại v → tính v+1 → \`compareAndSet(v, v+1)\`; nếu fail (thread khác thay đổi) → retry. Map xuống CPU atomic instruction (\`LOCK XADD\` trên x86), không cần OS lock/context switch. JDK 9+ dùng \`VarHandle.getAndAdd()\` với ACQUIRE/RELEASE memory ordering đảm bảo visibility.` },
  { q: 'Sự khác biệt giữa updateAndGet và accumulateAndGet là gì?',
    a: `**A:** \`updateAndGet(UnaryOperator)\` nhận current value, áp dụng function: \`counter.updateAndGet(x -> x * 2)\`. \`accumulateAndGet(x, BinaryOperator)\` kết hợp current value với argument bên ngoài: \`counter.accumulateAndGet(5, Integer::sum)\`. Cả hai return giá trị **sau** update; \`getAndUpdate\`/\`getAndAccumulate\` return **trước**. Function phải side-effect free vì có thể bị retry khi contention.` },
  { q: 'Trong tình huống nào AtomicInteger hoạt động kém hơn synchronized?',
    a: `**A:** Khi **contention cực cao** (1000 thread cùng increment), CAS retry loop gây CPU spinning liên tục — waste CPU nhiều hơn \`synchronized\` (block thread, để OS schedule). Trong trường hợp đó, \`LongAdder\` tốt nhất. Ngoài ra: compound operation phức tạp với nhiều bước CAS → \`synchronized\` hoặc \`ReentrantLock\` đơn giản và ít bug hơn.` },
]),


'aspect-pointcut-advice': qa([
  { q: 'Sự khác biệt giữa joinpoint và pointcut là gì?',
    a: `**A:** **Joinpoint** là một điểm cụ thể trong execution flow (một method invocation cụ thể). **Pointcut** là biểu thức khớp với tập hợp joinpoint — ví dụ \`execution(* com.example.service.*.*(..))\` khớp tất cả method trong package service. Pointcut là filter/selector; joinpoint là điểm thực tế bị match. Trong Spring AOP, joinpoint luôn là method execution.` },
  { q: 'Khi nào dùng @Around thay vì @Before + @AfterReturning?',
    a: `**A:** Dùng **\`@Around\`** khi cần: skip method (không gọi \`proceed()\`), modify input args, modify return value, hoặc wrap trong try-catch để quyết định re-throw hay swallow exception. Ví dụ: caching, circuit breaker. Dùng **\`@Before\` + \`@AfterReturning\`** khi chỉ cần observe (logging, audit) — intent tường minh hơn và ít nguy cơ quên gọi \`proceed()\`.` },
  { q: 'Làm thế nào để truyền argument từ pointcut sang advice method?',
    a: `**A:** Dùng **\`args()\` binding** trong pointcut expression:\n\`\`\`java\n@Around("execution(* service.*.*(..)) && args(userId, ..)")\npublic Object log(ProceedingJoinPoint pjp, String userId) throws Throwable {\n    log.info("userId={}", userId);\n    return pjp.proceed();\n}\n\`\`\`\nTên \`userId\` trong \`args()\` phải khớp tên parameter trong advice. Cũng dùng \`@annotation(ann)\` để inject annotation instance, \`target(bean)\` để inject target object.` },
]),

'at-least-once-vs-exactly-once': qa([
  { q: 'Sự khác biệt giữa at-least-once và exactly-once delivery là gì?',
    a: `**A:** **At-least-once**: message được deliver ít nhất một lần, có thể duplicate khi producer retry hoặc consumer crash trước khi commit offset. Hệ thống nhận phải **idempotent**. **Exactly-once**: mỗi message được xử lý đúng một lần — cần coordination nặng giữa producer, broker và consumer. Kafka hỗ trợ EOS với \`enable.idempotence=true\` + transactional API.` },
  { q: 'Kafka đạt exactly-once semantics thế nào?',
    a: `**A:** Hai cơ chế: (1) **Idempotent Producer** (\`enable.idempotence=true\`): mỗi message có sequence number, broker dedup khi retry. (2) **Transactions**: producer dùng \`beginTransaction()\`/\`commitTransaction()\` để atomic ghi vào nhiều partition/topic. Consumer đọc với \`isolation.level=read_committed\` — chỉ thấy message từ committed transaction. Overhead: ~20-30% throughput giảm so với at-least-once.` },
  { q: 'Tại sao at-least-once + idempotency là lựa chọn thực tế phổ biến nhất?',
    a: `**A:** Exactly-once đòi 2PC hoặc Kafka transactions — phức tạp, giảm throughput. At-least-once đơn giản hơn: producer retry khi timeout, consumer re-process nếu crash. Nhiều operation tự nhiên là idempotent: DB upsert với unique key, payment với idempotency key, REST PUT. Pattern: \`message_id\` trong message, consumer check \`processed_messages\` table trước khi xử lý — skip nếu đã có.` },
]),

'authentication-vs-authorization': qa([
  { q: 'Sự khác biệt giữa authentication và authorization là gì?',
    a: `**A:** **Authentication (AuthN)** — xác minh identity: "Bạn là ai?" — verify username/password, JWT, API key. **Authorization (AuthZ)** — kiểm tra quyền: "Bạn được làm gì?" — sau khi biết identity, check permission. HTTP 401 = chưa authenticated; HTTP 403 = authenticated nhưng không authorized. Spring Security: \`Authentication\` object (AuthN) → \`AccessDecisionManager\` check authorities (AuthZ).` },
  { q: 'Spring Security lưu trữ user đã xác thực giữa các request thế nào?',
    a: `**A:** Dùng \`SecurityContextHolder\` với \`ThreadLocal\` strategy mặc định — mỗi request thread có \`SecurityContext\` riêng chứa \`Authentication\`. Giữa request: session-based auth lưu vào HTTP Session; stateless REST + JWT không lưu session — mỗi request extract từ Authorization header. Để stateless: \`SessionCreationPolicy.STATELESS\`.` },
  { q: 'Sự khác biệt giữa @Secured và @PreAuthorize là gì?',
    a: `**A:** **\`@Secured({"ROLE_ADMIN"})\`** — đơn giản, chỉ check role name, không support SpEL. **\`@PreAuthorize("hasRole('ADMIN') && #userId == authentication.principal.id")\`** — mạnh hơn, dùng SpEL, có thể truy cập method arguments, authentication object, gọi Spring bean. Cần enable \`@EnableMethodSecurity\` (Spring Security 6). Prefer \`@PreAuthorize\` cho flexibility.` },
]),

'behavioral': qa([
  { q: 'Strategy khác if-else thế nào?',
    a: `**A:** If-else nhúng algorithm trực tiếp — thêm algorithm mới phải sửa class (vi phạm Open/Closed). **Strategy** tách algorithm thành interface, mỗi implementation là Strategy object; client chọn lúc runtime qua DI. Ví dụ: \`PaymentStrategy\` với \`CreditCardPayment\`, \`PaypalPayment\` — thêm loại mới chỉ cần thêm class, không sửa client. Spring inject \`List<PaymentStrategy>\` và code map theo type.` },
  { q: 'Chain of Responsibility được dùng ở đâu trong Spring?',
    a: `**A:** **Spring Security Filter Chain** là ví dụ điển hình: mỗi \`Filter\` xử lý request rồi quyết định pass xuống filter tiếp theo (\`chain.doFilter()\`). **HandlerInterceptor chain** trong Spring MVC: \`preHandle()\` của mỗi interceptor chạy tuần tự. **Spring AOP**: nhiều aspect proxy lồng nhau tạo chain quanh target method. Khác Strategy: Chain cho phép request đi qua nhiều handler tuần tự.` },
  { q: 'Sự khác biệt giữa Observer và pub/sub messaging?',
    a: `**A:** **Observer** (in-process): subject trực tiếp gọi \`update()\` trên observer — synchronous, tight coupling về thời gian. **Pub/Sub**: qua **message broker** (Kafka, RabbitMQ) — publisher và subscriber không biết nhau, decoupled về space và thời gian, async delivery. Spring \`@EventListener\` là Observer in-process; Kafka là pub/sub distributed. Dùng Observer cho domain event trong bounded context; pub/sub cho cross-service communication.` },
]),

'blocking-i-o-java-io': qa([
  { q: 'Byte stream và char stream khác nhau thế nào?',
    a: `**A:** **Byte stream** (\`InputStream/OutputStream\`) — đọc/ghi raw bytes, dùng cho binary data (image, serialized object). **Char stream** (\`Reader/Writer\`) — đọc/ghi characters với charset encoding, dùng cho text. \`InputStreamReader\` bridge byte→char với charset chỉ định. Lỗi phổ biến: đọc text file bằng byte stream → hỏng ký tự UTF-8 multi-byte. Luôn chỉ định charset rõ ràng: \`StandardCharsets.UTF_8\`.` },
  { q: 'BufferedReader bổ sung gì cho FileReader?',
    a: `**A:** \`FileReader\` đọc từng ký tự → mỗi \`read()\` là một system call tốn kém. \`BufferedReader\` wrap với in-memory buffer (default 8KB): đọc bulk từ disk vào buffer, phục vụ từ buffer — giảm số system call đáng kể. Ngoài ra có \`readLine()\` convenience method. Rule: **luôn buffer I/O stream**. Java 11+: \`Files.readString()\` và \`Files.lines()\` tự buffer nội bộ.` },
  { q: 'Điều gì xảy ra nếu quên đóng stream?',
    a: `**A:** **Resource leak**: file descriptor bị chiếm → hết fd → \`Too many open files\` IOException. Network connection không đóng → port exhaustion. Dữ liệu ghi có thể không flush. Giải pháp: **try-with-resources** (Java 7+) tự động gọi \`close()\` dù exception hay không — stream phải implement \`AutoCloseable\`. Nếu cả body lẫn close() ném exception → body exception được giữ, close exception bị suppressed.` },
]),

'blue-green-canary-deploy': qa([
  { q: 'Trade-off chính giữa blue-green và canary deployment là gì?',
    a: `**A:** **Blue-Green**: switch toàn bộ traffic một lần (0%→100%), rollback nhanh bằng cách switch lại. Cần double infrastructure cost — phải chạy 2 full environment. Bug ảnh hưởng 100% user ngay khi switch. **Canary**: gradually tăng traffic (1%→5%→100%), phát hiện bug sớm với ít user bị ảnh hưởng, infrastructure cost thấp hơn nhưng setup phức tạp hơn.` },
  { q: 'Argo Rollouts tự động hóa quyết định canary promotion thế nào?',
    a: `**A:** Tích hợp với **analysis providers** (Prometheus, Datadog) để evaluate metrics trong khi rollout tiến hành. Ví dụ: nếu error rate > 5% → tự động rollback; nếu tất cả metrics pass → promote lên step tiếp theo. Kết hợp với \`steps\` config: \`setWeight 20 → pause 5m → setWeight 50 → pause 10m → setWeight 100\` tạo progressive rollout với automated guardrails.` },
  { q: 'Feature flag là gì và khác canary deployment thế nào?',
    a: `**A:** **Feature flag**: code được deploy nhưng feature ẩn sau conditional check (\`if featureEnabled("new-ui")\`), bật/tắt runtime không cần redeploy, thường per-user/segment. Tools: LaunchDarkly, Unleash. **Canary**: infrastructure-level routing, route % traffic đến new version instance. Feature flag ở code level; canary ở infra level. Nhiều team kết hợp: deploy với flag disabled → dần bật flag theo % user.` },
]),

'bulkhead-isolation': qa([
  { q: 'Bulkhead giải quyết vấn đề gì mà shared thread pool không làm được?',
    a: `**A:** Với **shared thread pool**: service A chậm chiếm toàn bộ thread pool → request đến service B (bình thường) cũng bị queue/timeout → cascade failure. **Bulkhead** cô lập: mỗi downstream service có thread pool/semaphore riêng → service A saturate chỉ ảnh hưởng pool của A, service B không bị ảnh hưởng. Tên từ "bulkhead" trong tàu thủy — vách ngăn ngăn chìm toàn tàu.` },
  { q: 'Thread pool bulkhead và semaphore bulkhead khác nhau thế nào?',
    a: `**A:** **Thread pool bulkhead**: dedicated thread pool cho mỗi service call; caller thread submit task, pool thread execute — cho phép timeout đang-executing call. Overhead: thread creation, context switch. **Semaphore bulkhead**: giới hạn concurrent call bằng Semaphore; caller thread tự execute — overhead thấp hơn nhiều nhưng không timeout đang-executing call. Resilience4j default: semaphore. Hystrix (deprecated): thread pool.` },
  { q: 'Bulkhead bổ sung cho Circuit Breaker thế nào?',
    a: `**A:** Circuit Breaker theo dõi failure rate theo thời gian, mở khi vượt threshold — chờ service đang down recover. Bulkhead giới hạn concurrent requests — ngăn service slow (chưa fail) chiếm quá nhiều resource. Scenario: service A slow (5s thay vì 50ms) → CB chưa trigger nhưng thread pool đang fill up → Bulkhead kích hoạt. Kết hợp: Bulkhead ngăn resource exhaustion trong khi CB chờ failure rate đủ để trip.` },
]),

'cache-aside': qa([
  { q: 'Luồng đọc và ghi của Cache-Aside là gì?',
    a: `**A:** **Đọc**: check cache → HIT → return; MISS → đọc DB → ghi vào cache với TTL → return. **Ghi**: ghi vào DB → **invalidate** (xóa) cache key (không update cache). Lần đọc tiếp theo sẽ MISS và load fresh. Tại sao invalidate thay vì update? Tránh race condition: 2 update đồng thời → update cũ có thể ghi đè update mới trong cache. Cache-Aside còn gọi là **Lazy Loading**.` },
  { q: 'Thundering herd problem trong caching là gì?',
    a: `**A:** Khi cache key expire, **hàng trăm concurrent request** cùng hit DB → DB bị overwhelm. Giải pháp: (1) **Mutex/Lock**: request đầu tiên acquire lock, load từ DB, populate cache; các request khác wait. (2) **Probabilistic early expiration**: trước khi TTL hết, một request tự expire sớm và refresh. (3) **Stale-While-Revalidate**: trả stale data ngay, async refresh. (4) **Staggered TTL**: tránh nhiều key expire cùng lúc.` },
  { q: 'Khi nào bạn KHÔNG dùng Cache-Aside?',
    a: `**A:** (1) Data thay đổi liên tục → hit rate thấp, chỉ thêm overhead. (2) Strong consistency bắt buộc — Cache-Aside có window stale. (3) Write-heavy → cache bị invalidate liên tục. (4) Data nhạy cảm không nên cache (PII, security token). (5) Cold start không chịu được — cache empty sau restart → DB phải chịu full load. Thay thế: Write-Through (ghi đồng thời cache và DB), Read-Through (cache tự load từ DB).` },
]),

'cap-theorem': qa([
  { q: 'Hệ thống có thể CA (consistent và available nhưng không partition-tolerant) không?',
    a: `**A:** Single-node RDBMS là CA về lý thuyết. Nhưng trong distributed system: network partition **luôn có thể xảy ra** — bạn không thể chọn không partition-tolerant, chỉ có thể chọn behavior *khi* partition xảy ra. CAP thực sự là: partition xảy ra → chọn **C** (reject request giữ consistency) hay **A** (tiếp tục serve có thể stale). Đa số distributed system chọn giữa CP hoặc AP.` },
  { q: 'Đưa ví dụ về hệ thống CP và AP và giải thích lựa chọn.',
    a: `**A:** **CP**: ZooKeeper, etcd — khi partition, từ chối write để giữ consistency — đúng đắn cho distributed coordination, leader election, config management. **AP**: Cassandra, DynamoDB (default), Amazon S3 — khi partition, tiếp tục serve stale data — phù hợp cho user timeline, shopping cart, counter (merge conflict sau). Cassandra tunable: \`QUORUM\` (CP-leaning) hoặc \`ONE\` (AP-leaning). Không có đúng/sai — phụ thuộc business requirement.` },
  { q: 'PACELC là gì và mở rộng CAP thế nào?',
    a: `**A:** CAP chỉ nói về behavior khi có partition. **PACELC** (Daniel Abadi): *khi Partition → chọn Availability hay Consistency*; *Else (bình thường) → chọn Latency hay Consistency*. Cassandra là PA/EL — partition chọn Availability; bình thường với ONE chọn Latency. MySQL Cluster là PC/EC — luôn chọn Consistency kể cả khi không có partition (sync replication). PACELC capture thực tế hơn CAP.` },
]),

'capacity-planning': qa([
  { q: "Áp dụng Little's Law để tính thread pool cho 2000 RPS ở 150ms avg latency?",
    a: `**A:** Little's Law: **L = λ × W** (L = concurrent, λ = throughput, W = response time). L = 2000 × 0.15 = **300 concurrent request** → thread pool cần 300. Thêm safety buffer 20-30%: pool size ~360-390. Với Virtual Threads (Java 21): không cần tính thread pool — JVM manage automatically; chỉ tính max concurrency để giới hạn downstream resource.` },
  { q: 'Chuyển 10M daily active user thành ước tính QPS thế nào?',
    a: `**A:** 1 ngày = 86,400s. 80/20 rule: 80% traffic trong 20% thời gian (17,280s peak). Ví dụ social app (~30 request/user/ngày): avg QPS = 10M × 30 / 86,400 ≈ **3,472 QPS**; peak ≈ 3,472 × 5 × 1.5 safety ≈ **26,000 QPS**. Điều chỉnh theo tỷ lệ read/write, caching hit rate, geography (peak theo timezone). Validate với real traffic log nếu có.` },
  { q: '"Điểm gãy" trong load test là gì?',
    a: `**A:** **Breaking point** là ngưỡng tải mà hệ thống bắt đầu degradation không tuyến tính: latency tăng đột biến, error rate tăng, throughput không tăng dù load tăng. Queuing theory: khi utilization → 100%, queue length → ∞. Tìm bằng **stress test**: tăng dần load đến khi error rate > 1% hoặc latency p99 vượt threshold. Breaking point của production nên gấp **2-3x expected peak load**.` },
]),


'checked-vs-unchecked': qa([
  { q: 'Tại sao Java bao gồm checked exception? Lập luận ủng hộ và phản đối là gì?',
    a: `**A:** **Ủng hộ**: Compiler buộc caller phải xử lý hoặc declare — "fail loudly" khi bỏ sót error handling, phù hợp I/O operations có thể fail. **Phản đối**: Verbose, thường bị "swallow" bằng \`catch(Exception e){}\` vô nghĩa; spread qua nhiều layer (DAO → Service → Controller); không phù hợp với lambda (Functional interfaces không khai báo checked exception). Xu hướng hiện đại: wrap trong unchecked RuntimeException và xử lý ở global @ExceptionHandler.` },
  { q: 'Khi nào bạn nên bọc checked exception trong unchecked?',
    a: `**A:** Bọc khi: (1) Exception là implementation detail không nên leak qua API (JPA wrap \`SQLException\` thành \`DataAccessException\`). (2) Caller không thể xử lý meaningful — re-throw vô nghĩa. (3) Dùng trong functional/lambda context — \`CheckedFunction\` workaround xấu. Pattern: \`throw new ServiceException("Failed to read config", e)\` — preserve original exception làm cause để không mất stack trace.` },
  { q: 'Exception chaining là gì và tại sao quan trọng?',
    a: `**A:** Exception chaining: khi wrap exception, pass original làm cause: \`new RuntimeException("message", originalException)\`. Đảm bảo root cause không bị mất — \`getCause()\` và stack trace đầy đủ giúp debug. Không chain: chỉ thấy high-level exception, không biết nguyên nhân gốc rễ. Anti-pattern: \`catch(SQLException e) { throw new ServiceException("error"); }\` — mất nguyên nhân. Luôn: \`throw new ServiceException("error", e)\`.` },
]),

'choreography': qa([
  { q: 'Nhược điểm của choreography trong saga dài là gì?',
    a: `**A:** (1) **Khó debug**: không có central orchestrator — phải trace event qua nhiều service để hiểu flow. (2) **Cyclic dependencies**: service A emit event → service B handle → emit event → service A handle — tạo tight coupling ẩn. (3) **Khó thêm step mới**: phải cập nhật nhiều service emit/consume đúng event. (4) **Visibility thấp**: không có nơi nào thể hiện toàn bộ business flow — cần distributed tracing để theo dõi.` },
  { q: 'Làm thế nào để debug choreography saga khi bước nào đó fail âm thầm?',
    a: `**A:** (1) **Distributed tracing** (Jaeger/Zipkin): trace toàn bộ event chain với correlation ID — thấy được event nào được emit, service nào handle. (2) **Dead Letter Queue (DLQ)**: message fail sau N retry được route đến DLQ — monitor và alert trên DLQ size. (3) **Saga state table**: persist trạng thái saga trong DB — query để biết bước nào chưa hoàn thành. (4) **Centralized logging** với correlation ID để correlate log giữa các service.` },
  { q: 'Choreography xử lý out-of-order event thế nào?',
    a: `**A:** Event B đến trước Event A (do network, different partition) → service nhận B chưa có context từ A → xử lý sai hoặc error. Giải pháp: (1) **Idempotent consumers + eventual ordering**: lưu event, chờ tất cả dependency đến rồi mới xử lý. (2) **Sequence number/version**: reject event với sequence không khớp, yêu cầu re-delivery theo thứ tự. (3) Đặt tất cả event của một entity vào cùng Kafka partition (message key = entityId) để đảm bảo order trong partition.` },
]),

'ci-cd': qa([
  { q: 'Sự khác biệt giữa CI, CD (Delivery) và CD (Deployment) là gì?',
    a: `**A:** **CI (Continuous Integration)**: tự động build, test, và merge code thường xuyên — phát hiện lỗi sớm. **CD (Continuous Delivery)**: sau CI, artifact sẵn sàng deploy lên production bất cứ lúc nào — nhưng vẫn cần manual approval để deploy thực sự. **CD (Continuous Deployment)**: tự động deploy lên production sau CI pass — không cần manual step. Mature pipeline: CI → Continuous Delivery với canary/feature flag → Continuous Deployment khi confidence cao.` },
  { q: 'Làm thế nào để đảm bảo CI pipeline vẫn nhanh khi codebase tăng trưởng?',
    a: `**A:** (1) **Parallel test execution**: chia test suite chạy song song trên nhiều worker. (2) **Test caching**: cache build artifact và test result — chỉ re-run khi file liên quan thay đổi. (3) **Incremental build**: chỉ build/test module bị ảnh hưởng bởi commit (nx, turborepo). (4) **Test pyramid**: nhiều unit test fast, ít integration/E2E test chậm. (5) **Fail fast**: chạy lint/type check trước, unit test trước, integration test cuối.` },
  { q: 'GitOps là gì và ArgoCD implement nó thế nào?',
    a: `**A:** **GitOps**: Git là single source of truth cho infrastructure và application config — mọi thay đổi qua Git commit/PR, không kubectl/manual. **ArgoCD** implement: (1) Watch Git repo chứa K8s manifests/Helm charts. (2) So sánh desired state (Git) với actual state (cluster). (3) Tự động sync khi phát hiện drift — apply manifest từ Git xuống cluster. (4) Audit trail đầy đủ qua Git history. Rollback = revert Git commit.` },
]),

'collections': qa([
  { q: 'Sự khác biệt giữa ArrayList và LinkedList là gì?',
    a: `**A:** **ArrayList**: dynamic array, O(1) random access (\`get(i)\`), O(n) insert/delete giữa list (shift elements), cache-friendly vì contiguous memory. **LinkedList**: doubly linked, O(1) insert/delete ở head/tail, O(n) random access (traverse), pointer overhead per node. Thực tế: ArrayList tốt hơn cho hầu hết use case vì cache locality. LinkedList chỉ tốt khi cần O(1) add/remove đầu cuối và không cần random access.` },
  { q: 'HashMap xử lý hash collision như thế nào?',
    a: `**A:** Java HashMap dùng **chaining**: mỗi bucket là một linked list (Java 7-) hoặc TreeMap khi chain dài ≥ 8 (Java 8+ — \`TREEIFY_THRESHOLD\`). Khi put: tính \`hashCode()\`, find bucket, traverse chain tìm key equal; nếu không có → add node. Load factor (default 0.75): khi 75% capacity → resize gấp đôi và rehash. TreeMap trong bucket: O(log n) thay vì O(n) khi nhiều collision — tránh worst case hash DoS.` },
  { q: 'Khi nào bạn dùng CopyOnWriteArrayList?',
    a: `**A:** Dùng khi **read cực nhiều, write rất ít**: mỗi write tạo một bản copy mới của array → read concurrent không bao giờ block (lock-free read), không cần synchronize khi đọc. Use case điển hình: danh sách listener/subscriber đăng ký một lần rồi ít thay đổi; cache immutable data. Không dùng khi write thường xuyên — copy O(n) mỗi write cực tốn. \`ConcurrentHashMap\` cho map use case tương tự.` },
]),

'command': qa([
  { q: 'Command cho phép undo/redo thế nào?',
    a: `**A:** Mỗi Command object implement cả \`execute()\` và \`undo()\`. Maintain hai stack: **undo stack** và **redo stack**. Khi execute command: push vào undo stack. Khi undo: pop từ undo stack, gọi \`undo()\`, push vào redo stack. Khi redo: pop từ redo stack, gọi \`execute()\`, push vào undo stack. Command phải lưu đủ state để đảo ngược — ví dụ DrawCommand lưu trước/sau color, vị trí.` },
  { q: 'Vai trò của Invoker trong Command pattern?',
    a: `**A:** **Invoker** là object quyết định khi nào thực thi command, nhưng không biết command làm gì cụ thể — chỉ gọi \`command.execute()\`. Invoker tách biệt người gửi yêu cầu khỏi người thực thi. Ví dụ: Button (Invoker) giữ Command object, khi click → gọi \`execute()\` — Button không biết command là SaveFile hay DeleteRecord. Cho phép swap command ở runtime, queue/delay/log command, hỗ trợ undo.` },
  { q: 'Làm thế nào để implement job queue với Command?',
    a: `**A:** Mỗi job là một Command object (implement \`execute()\`). Queue (LinkedBlockingQueue) giữ pending commands. Worker thread poll từ queue và gọi \`execute()\`. Command có thể serialize (lưu DB hoặc message queue) để survive restart. Ví dụ:\n\`\`\`java\nBlockingQueue<Command> queue = new LinkedBlockingQueue<>();\nqueue.put(new SendEmailCommand(user));\nqueue.put(new GenerateReportCommand(params));\nworker.execute(() -> { while(true) queue.take().execute(); });\n\`\`\`` },
]),

'composite-index': qa([
  { q: 'Giải thích leftmost prefix rule cho composite index.',
    a: `**A:** Index \`(a, b, c)\` có thể được dùng bởi query filter theo **prefix từ trái**: \`WHERE a=?\`, \`WHERE a=? AND b=?\`, \`WHERE a=? AND b=? AND c=?\` đều dùng index. Nhưng \`WHERE b=?\` hoặc \`WHERE c=?\` — không dùng index (thiếu prefix). \`WHERE a=? AND c=?\` — chỉ dùng phần \`a\`, không dùng \`c\`. Index tree được sắp xếp theo (a, rồi b, rồi c) — skip prefix đầu là không navigate được.` },
  { q: 'Với index (a, b), query nào có thể dùng nó: WHERE b=1, WHERE a=1 hay WHERE a=1 AND b=1?',
    a: `**A:** **\`WHERE a=1\`** — dùng index, chỉ phần a (range scan). **\`WHERE a=1 AND b=1\`** — dùng index đầy đủ cả (a,b) — hiệu quả nhất. **\`WHERE b=1\`** — **không dùng index** vì b không phải leftmost prefix. EXPLAIN sẽ show \`key=null\` hoặc \`type=ALL\` cho \`WHERE b=1\`. Nếu thường xuyên query theo b một mình, cần index riêng trên cột b.` },
  { q: 'Thứ tự cột trong composite index ảnh hưởng hiệu năng thế nào?',
    a: `**A:** Đặt **cột có cardinality cao** (nhiều distinct values) lên đầu để loại bỏ nhiều row nhất sớm nhất. Tuy nhiên, phải cân bằng với leftmost prefix rule: cột nào được dùng trong WHERE thường xuyên nhất → đặt đầu. Nếu query vừa equality vừa range: đặt equality column trước, range column sau — \`(status, created_at)\` cho \`WHERE status='ACTIVE' AND created_at > ?\` tốt hơn ngược lại.` },
]),

'configmap-secret': qa([
  { q: 'Sự khác biệt giữa ConfigMap và Secret trong Kubernetes là gì?',
    a: `**A:** **ConfigMap**: lưu non-sensitive config (URL, port, feature flag) dạng plain text, có thể xem bằng \`kubectl get configmap -o yaml\`. **Secret**: lưu sensitive data (password, API key, certificate) — encode bằng **Base64** (không encrypt), có thể restrict access qua RBAC. Base64 chỉ là encoding, không phải encryption — Secret vẫn cần encrypt at rest (K8s EncryptionConfiguration hoặc Vault).` },
  { q: 'Làm thế nào để quản lý secret an toàn trong Kubernetes production?',
    a: `**A:** (1) **Enable encryption at rest**: \`EncryptionConfiguration\` trong kube-apiserver để encrypt Secret trong etcd. (2) **External secret management**: HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager + External Secrets Operator sync vào K8s Secret. (3) **RBAC**: giới hạn \`get/list\` Secret chỉ cho service account cần thiết. (4) **Sealed Secrets**: encrypt Secret bằng public key, chỉ cluster có thể decrypt — safe để commit lên Git.` },
  { q: 'Điều gì xảy ra với pod khi bạn cập nhật ConfigMap mà chúng mount?',
    a: `**A:** Khi ConfigMap được mount dạng **volume**: K8s tự động cập nhật file trong pod sau một khoảng thời gian (mặc định 60s sync period) — pod không cần restart, nhưng app cần tự detect và reload config (inotify/watch). Khi ConfigMap inject dạng **env variable**: pod **không** tự cập nhật — phải restart pod để env mới có hiệu lực. Dùng volume mount để hot-reload config, env variable cho config ít thay đổi.` },
]),

'cong-cu-profiling-jstack-jmap-jcmd': qa([
  { q: 'Tìm thread nào đang ngốn 100% CPU bằng jstack thế nào?',
    a: `**A:** (1) \`top -H -p <pid>\` → tìm TID (thread ID) dùng CPU nhiều nhất. (2) Convert TID decimal → hex: \`printf "%x" <TID>\`. (3) \`jstack <pid> | grep -A 30 "<hex_tid>"\` → tìm stack trace của thread đó. Thường thấy: infinite loop, lock contention, GC thread busy. Với async-profiler: \`./profiler.sh -e cpu -d 30 -f cpu.html <pid>\` → flame graph trực quan hơn.` },
  { q: 'jstat -gcutil cho biết gì?',
    a: `**A:** \`jstat -gcutil <pid> 1000\` in mỗi giây: **S0/S1** (Survivor space %), **E** (Eden space %), **O** (Old Gen %), **M** (Metaspace %), **YGC** (Young GC count), **YGCT** (Young GC time), **FGC** (Full GC count), **FGCT** (Full GC time), **GCT** (Total GC time). Cảnh báo: O > 80% → sắp OOM; FGC tăng liên tục → memory leak; FGCT cao → GC pause lớn ảnh hưởng latency.` },
  { q: 'Khi nào dùng async-profiler thay vì jmap?',
    a: `**A:** **jmap -heap/-histo**: snapshot allocation hiện tại — dùng khi nghi ngờ memory leak (xem object nào chiếm nhiều heap). SafePoint-based → có thể bỏ sót allocation giữa safepoint. **async-profiler**: continuous CPU/allocation sampling với PERF events, không cần safepoint — phát hiện hot method/allocation path trong production. Dùng async-profiler cho CPU profiling và allocation profiling real-time; jmap/jcmd heapdump cho phân tích memory snapshot sau sự cố.` },
]),

'connection-pool-hikaricp': qa([
  { q: 'Điều gì xảy ra khi tất cả HikariCP connection đang được dùng và có request mới?',
    a: `**A:** Request mới phải **chờ** (block) tối đa \`connectionTimeout\` (default 30s). Nếu sau \`connectionTimeout\` vẫn không có connection → throw \`SQLTimeoutException\` với message "Connection is not available, request timed out". Trong log thấy: \`HikariPool-1 - Connection is not available, request timed out after 30000ms\`. Giải pháp: tăng pool size, optimize slow query, hoặc giảm connection hold time.` },
  { q: 'Tính maximumPoolSize thế nào khi deploy 5 app instance?',
    a: `**A:** DB connection limit thường cố định (PostgreSQL default 100). Mỗi app instance cần pool riêng → tổng connection = instances × pool_size. Công thức: \`pool_size_per_instance = (DB_max_connections - reserved) / num_instances\`. Ví dụ: DB max 100, reserve 10 cho admin → (100-10)/5 = **18 connections/instance**. Đặt \`maximumPoolSize=18\`. Nếu scale app, phải giảm pool size per instance hoặc tăng DB max_connections.` },
  { q: 'Connection leak detection là gì và cấu hình thế nào?',
    a: `**A:** Connection leak: code lấy connection từ pool nhưng không trả lại (quên close, exception không được handle). HikariCP detect bằng \`leakDetectionThreshold\`: nếu connection được giữ lâu hơn threshold → log warning với stack trace của code lấy connection. Config: \`spring.datasource.hikari.leak-detection-threshold=2000\` (ms). Warning không release connection, chỉ log — dùng để debug. Luôn dùng try-with-resources hoặc Spring \`@Transactional\` để đảm bảo connection được trả lại.` },
]),

'consistency-patterns': qa([
  { q: 'Sự khác biệt giữa eventual consistency và strong consistency là gì?',
    a: `**A:** **Strong consistency**: sau khi write thành công, mọi read tiếp theo (từ bất kỳ node nào) đều thấy giá trị mới nhất — đòi hỏi coordination. **Eventual consistency**: sau write, system *cuối cùng* sẽ hội tụ đến giá trị mới nhất — trong thời gian đó có thể đọc được giá trị cũ (stale). Trade-off: strong consistency có latency cao hơn (phải sync); eventual consistency có availability cao hơn và latency thấp hơn.` },
  { q: '"Read-your-writes" consistency là gì và làm thế nào để implement?',
    a: `**A:** **Read-your-writes**: sau khi user A write, user A (cùng session) luôn thấy write đó — kể cả khi đọc từ replica. *Người khác* có thể thấy stale. Implement: (1) Sau write, route read của user đó đến primary tạm thời (dùng session flag). (2) Ghi timestamp write vào session cookie, read request gửi timestamp → replica chờ đủ replication đến timestamp đó rồi mới trả lời. (3) Luôn read from primary cho user context cụ thể.` },
  { q: 'CRDT là gì và giúp gì với eventual consistency?',
    a: `**A:** **CRDT (Conflict-free Replicated Data Type)**: data structure được thiết kế để tự động merge conflict mà không cần central coordination. Ví dụ: Grow-only Counter (G-Counter) chỉ tăng → merge = max của mỗi node; OR-Set cho set có add/remove; LWW-Register (Last-Write-Wins). CRDTs đảm bảo: (1) Concurrent update từ nhiều node luôn merge được. (2) Kết quả cuối cùng deterministic. Dùng: Redis (HyperLogLog), Riak, Apple Notes offline sync.` },
]),

'contract-testing': qa([
  { q: 'Contract testing giải quyết vấn đề gì so với integration test?',
    a: `**A:** Integration test yêu cầu tất cả service phải chạy cùng lúc — brittle, chậm, khó maintain trong microservices. **Contract testing**: consumer ghi lại expectations (contract), provider chạy test đối chiếu contract mà không cần consumer running. Phát hiện breaking change sớm ở CI, mỗi team test độc lập. Pact là tool phổ biến: consumer generate pact file, provider verify pact file — không cần deployed environment.` },
  { q: 'Vai trò của Pact Broker là gì?',
    a: `**A:** **Pact Broker** là central repository lưu trữ tất cả pact contract files và kết quả verification: (1) Consumer publish pact file sau test. (2) Provider pull pact file và chạy verification, publish kết quả. (3) Broker track versions và verification status. (4) Cung cấp **can-i-deploy** API để biết liệu phiên bản cụ thể của service có an toàn để deploy không. PactFlow là managed Pact Broker với thêm enterprise features.` },
  { q: 'can-i-deploy là gì?',
    a: `**A:** CLI tool của Pact ecosystem: \`pact-broker can-i-deploy --pacticipant UserService --version 1.2.3 --to production\` → query Pact Broker kiểm tra tất cả pact contract của UserService v1.2.3 đã được provider verify thành công chưa. Trả về YES/NO — tích hợp vào CI pipeline trước deploy step. Ngăn deploy service khi consumer/provider contract chưa được verify — giảm risk breaking change.` },
]),

'covering-index': qa([
  { q: 'Covering index là gì và cải thiện hiệu năng thế nào?',
    a: `**A:** **Covering index**: index chứa tất cả column mà query cần (WHERE, SELECT, ORDER BY) — DB không cần access table data, chỉ cần đọc index. Ví dụ: \`CREATE INDEX idx ON orders(user_id, status, total)\` cho query \`SELECT total FROM orders WHERE user_id=? AND status='ACTIVE'\` — tất cả column đều có trong index. Giảm I/O dramatically vì index tree nhỏ hơn table nhiều, fit vào buffer pool.` },
  { q: '"Index Only Scan" trong output EXPLAIN có nghĩa gì?',
    a: `**A:** \`Index Only Scan\` trong PostgreSQL EXPLAIN (hoặc \`Using index\` trong MySQL EXPLAIN Extra) — query được satisfy hoàn toàn từ index mà không cần access heap table. Đây là dấu hiệu **covering index đang hoạt động**. PostgreSQL: phải check visibility map vì MVCC — nếu table chưa được VACUUM, vẫn có thể cần heap access. So sánh: \`Index Scan\` = dùng index để navigate nhưng vẫn cần fetch row từ table.` },
  { q: 'Khi nào covering index KHÔNG có lợi?',
    a: `**A:** (1) **SELECT \*** — phải include tất cả column vào index, index to bằng table, không có lợi. (2) **Write-heavy table**: mỗi INSERT/UPDATE phải update thêm covering index — overhead ghi tăng. (3) **Column có giá trị lớn** (TEXT, BLOB) trong SELECT — index quá to, chậm hơn table scan. (4) **Low selectivity query trả về nhiều row**: overhead traverse index rồi filter không worth it so với full table scan.` },
]),

'creational': qa([
  { q: 'Khi nào dùng Builder thay vì constructor?',
    a: `**A:** Dùng Builder khi: (1) Class có nhiều optional parameter — tránh telescoping constructor (4-5 overloaded constructors). (2) Muốn immutable object với nhiều field. (3) Các parameter cùng type dễ nhầm lẫn thứ tự — Builder đặt tên rõ ràng. Ví dụ: \`HttpRequest.newBuilder().GET().uri(url).timeout(Duration.ofSeconds(5)).build()\`. Lombok \`@Builder\` generate tự động. Java records với compact constructor là alternative cho immutable simple DTO.` },
  { q: 'Sự khác biệt giữa Factory Method và Abstract Factory?',
    a: `**A:** **Factory Method**: define interface để tạo object, subclass quyết định concrete class nào. Một product, nhiều variant qua subclassing. Ví dụ: \`createConnection()\` trong \`PostgresRepository\` vs \`MysqlRepository\`. **Abstract Factory**: interface để tạo **family of related objects** — tất cả cùng nhau. Ví dụ: \`UIFactory\` tạo \`Button\`, \`TextField\`, \`Dialog\` — \`DarkUIFactory\` vs \`LightUIFactory\` tạo consistent family. Abstract Factory dùng Factory Method nội bộ.` },
  { q: 'Spring quản lý Singleton bean thế nào?',
    a: `**A:** Spring singleton: **một instance per ApplicationContext** (không phải per JVM như GoF Singleton). Container tạo bean khi context start (eager), giữ trong registry map (key=bean name, value=instance), inject cùng instance cho mọi dependency. Thread-safety: bean phải stateless hoặc dùng synchronized — Spring không tự make bean thread-safe. \`@Scope("prototype")\`: tạo instance mới mỗi lần inject/request. \`@Scope("request")\` cho web: một instance per HTTP request.` },
]),

'cross-cutting-concerns': qa([
  { q: 'Cross-cutting concern là gì? Đặt tên ba ví dụ trong Spring app điển hình.',
    a: `**A:** Cross-cutting concern là functionality cắt ngang nhiều module/layer, không thuộc business logic của bất kỳ module cụ thể nào. Ba ví dụ phổ biến trong Spring: (1) **Logging**: log method call, parameter, thời gian thực thi. (2) **Security/Authorization**: check quyền trước khi thực thi method. (3) **Transaction management**: bắt đầu/commit/rollback transaction xung quanh service method. Thêm: caching, audit trail, performance monitoring, retry.` },
  { q: 'Aspect cải thiện maintainability code thế nào?',
    a: `**A:** Không có AOP: code logging/security/transaction rải rác khắp mọi class → khi cần thay đổi (đổi log format, thêm security check) phải sửa hàng chục file. Với Aspect: tập trung một nơi, thêm/sửa behavior mà không sửa business code. Ví dụ: thêm execution time logging cho tất cả service method chỉ cần thêm một \`@Around\` aspect — business code không thay đổi. Separation of concerns → dễ test business logic độc lập.` },
  { q: 'Nhược điểm của việc lạm dụng AOP là gì?',
    a: `**A:** (1) **Debug khó**: behavior xảy ra "ẩn" — stack trace qua proxy layers phức tạp. (2) **Performance overhead**: proxy invocation cho mỗi method call. (3) **Self-invocation không hoạt động**: \`this.method()\` bypass proxy → \`@Transactional\` self-invocation bug phổ biến. (4) **Khó predict behavior**: developer mới không biết có aspect nào đang chạy. Rule: chỉ dùng AOP cho cross-cutting concern thực sự, không dùng cho business logic.` },
]),

'custom-exceptions': qa([
  { q: 'Domain exception tùy chỉnh nên là checked hay unchecked? Tại sao?',
    a: `**A:** **Unchecked (RuntimeException)** là best practice hiện đại: (1) Caller không bị buộc handle — exception thường lan lên đến global handler. (2) Phù hợp với functional programming (lambda). (3) Không pollute method signatures với \`throws\`. (4) Spring, JPA, Hibernate đều dùng unchecked exception. Checked chỉ hợp lý cho recoverable scenario mà caller *thực sự* có thể handle (ví dụ \`FileNotFoundException\` — caller có thể prompt user chọn file khác).` },
  { q: 'Làm thế nào để map custom exception sang HTTP status code trong Spring?',
    a: `**A:** Dùng \`@ResponseStatus\` trên exception class:\n\`\`\`java\n@ResponseStatus(HttpStatus.NOT_FOUND)\npublic class ResourceNotFoundException extends RuntimeException { ... }\n\`\`\`\nHoặc trong \`@ControllerAdvice\` với \`@ExceptionHandler\` để control response body:\n\`\`\`java\n@ExceptionHandler(ResourceNotFoundException.class)\npublic ResponseEntity<ErrorResponse> handle(ResourceNotFoundException e) {\n    return ResponseEntity.status(404).body(new ErrorResponse(e.getMessage()));\n}\n\`\`\`` },
  { q: 'Rủi ro của việc đặt business logic trong constructor của exception là gì?',
    a: `**A:** (1) **Exception trong exception constructor** → throw exception khi xây dựng exception → NullPointerException hoặc IllegalArgumentException bị throw thay vì exception gốc, che giấu nguyên nhân thực. (2) **Side effects** (log, network call) trong exception constructor → không control được timing, ngăn exception được dùng làm test helper. (3) **Performance**: constructor phức tạp được gọi mỗi lần throw, kể cả trong hot path. Giải pháp: exception chỉ nên giữ message và cause, không làm gì thêm.` },
]),


'database-scaling': qa([
  { q: 'Read replica giúp gì với database scalability?',
    a: `**A:** Read replica là bản sao read-only của primary DB, nhận replication stream. **Offload read traffic** khỏi primary: SELECT, report query, analytics chạy trên replica; primary chỉ xử lý write. Hầu hết ứng dụng là read-heavy (80-90% read) → replica giảm đáng kể load trên primary. Spring với \`@Transactional(readOnly=true)\` có thể route đến replica tự động khi config \`AbstractRoutingDataSource\`.` },
  { q: 'Replication lag là gì và ảnh hưởng đến ứng dụng thế nào?',
    a: `**A:** **Replication lag**: độ trễ giữa write trên primary và khi write đó apply trên replica — có thể từ milliseconds đến seconds khi primary bận. Ảnh hưởng: user vừa create record → đọc từ replica → không thấy record vừa tạo. Giải pháp: (1) Sau write, đọc từ primary trong cùng transaction/request. (2) "Read-your-writes": dùng session token track version, chờ replica catch up. (3) Tăng replication hardware. Monitor: \`SHOW SLAVE STATUS\` / \`pg_stat_replication\`.` },
  { q: 'Khi nào bạn chọn sharding thay vì read replica?',
    a: `**A:** Read replica giúp **scale reads**, không scale writes — primary vẫn là single write node. Chọn **sharding** khi: write throughput vượt khả năng một primary, dataset quá lớn cho một node, hoặc cần geographic distribution writes. Sharding phức tạp hơn nhiều: cross-shard joins không thể, transactions phức tạp, resharding costly. Thứ tự scale: vertical → read replica → sharding. Sharding là last resort vì complexity cao.` },
]),

'decorator': qa([
  { q: 'Decorator khác Proxy thế nào?',
    a: `**A:** **Decorator**: thêm behavior/responsibility mới, được compose từ bên ngoài bởi client, có thể stack nhiều decorator. Focus: enhancement. **Proxy**: control access đến subject — authentication, caching, lazy init, remote proxy. Focus: control. Decorator thường transparent (implement cùng interface, forward call); Proxy thường thay thế subject về phía client. Ranh giới mờ trong thực tế: \`@Transactional\` là Proxy (control), \`BufferedInputStream\` là Decorator (enhance).` },
  { q: 'Khi nào dùng Decorator thay vì subclass?',
    a: `**A:** Dùng Decorator khi: (1) Muốn thêm responsibility **tại runtime** theo nhiều combination khác nhau — subclass tạo class explosion nếu có N feature × M variant. (2) Muốn compose từ bên ngoài mà không sửa original class. (3) Class bị final (không thể subclass). Ví dụ: Logger với timestamp decorator + json formatter decorator + file writer — 8 combination mà chỉ cần 3 decorator class thay vì 8 subclass.` },
  { q: 'Java I/O stream dùng Decorator thế nào?',
    a: `**A:** \`InputStream\` là component interface. \`FileInputStream\` là concrete component. \`BufferedInputStream\`, \`GZIPInputStream\`, \`DataInputStream\` là concrete decorator — đều wrap một \`InputStream\` khác. Stack: \`new DataInputStream(new BufferedInputStream(new GZIPInputStream(new FileInputStream(file))))\` — đọc compressed, buffered binary file với type-aware API. Mỗi decorator thêm một layer behavior mà không sửa class kia.` },
]),

'distributed-lock': qa([
  { q: 'Vấn đề với dùng Redis SETNX đơn giản cho distributed lock là gì?',
    a: `**A:** Vấn đề: \`SETNX key value\` để set lock, \`DEL key\` để release — hai operation không atomic. Nếu process crash sau SETNX nhưng trước DEL → lock **never released** (deadlock). Fix: \`SET key value NX EX 30\` — set với TTL trong một atomic command. Nhưng vẫn có vấn đề: release sai lock của người khác nếu mình hold lock quá lâu và TTL expired trước khi release.` },
  { q: 'Thuật toán Redlock là gì?',
    a: `**A:** Redlock (Antirez): acquire lock trên **N/2+1 independent Redis nodes** (thường 5) trong tổng thời gian nhỏ hơn TTL. Nếu không acquire đủ quorum trong thời gian → release tất cả và retry. Mục đích: tránh single point of failure. Tranh cãi: Martin Kleppmann chỉ ra Redlock không an toàn khi có GC pause hoặc clock skew — process nghĩ mình đang hold lock nhưng TTL đã expire. **Recommendation**: dùng Redlock + **fencing token** cho critical sections.` },
  { q: 'Làm thế nào để ngăn deadlock với distributed lock nếu lock holder crash?',
    a: `**A:** (1) **TTL (Time-To-Live)**: lock tự expire sau khoảng thời gian cố định — nếu holder crash, lock tự release. Nhưng TTL phải đủ dài cho operation. (2) **Fencing token**: mỗi lần acquire lock nhận một monotonically increasing token; resource server reject request với token cũ hơn token hiện tại — ngăn stale lock holder tác động sau khi TTL hết. (3) **Heartbeat**: holder renew lock periodically; nếu heartbeat dừng → lock expire.` },
]),

'distributed-tracing': qa([
  { q: 'Sự khác biệt giữa trace và span là gì?',
    a: `**A:** **Trace**: toàn bộ hành trình của một request qua nhiều service — identified bởi \`traceId\`. **Span**: một unit of work trong trace — một RPC call, một DB query, một function call. Mỗi span có \`spanId\`, \`parentSpanId\`, timestamp, duration, và tags. Trace là cây span: root span (incoming request) → child spans (downstream call, DB query). Jaeger/Zipkin visualize trace như waterfall diagram.` },
  { q: 'Trace context được truyền qua HTTP boundary thế nào?',
    a: `**A:** Dùng **HTTP headers** để propagate context: W3C standard: \`traceparent: 00-<traceId>-<spanId>-01\`. B3 format (Zipkin): \`X-B3-TraceId\`, \`X-B3-SpanId\`, \`X-B3-ParentSpanId\`. Spring Cloud Sleuth/Micrometer Tracing tự động inject headers vào outgoing request (RestTemplate, WebClient, Feign) và extract từ incoming. Service nhận request extract context → tạo child span với parentSpanId = received spanId.` },
  { q: 'Sampling là gì và tại sao 100% sampling problematic trong production?',
    a: `**A:** **Sampling**: chỉ collect trace cho một phần requests thay vì tất cả. 100% sampling problematic: (1) **Storage cost**: mỗi trace có hàng chục span × metadata → hàng TB/ngày với high traffic. (2) **Performance overhead**: serialization, network call đến tracing backend trên mỗi request. Strategies: **Head-based** (quyết định sample khi request bắt đầu, ví dụ 1%); **Tail-based** (quyết định sau khi request hoàn thành — có thể sample 100% lỗi + 1% thành công). Jaeger/Tempo support adaptive sampling.` },
]),

'dockerfile-best-practices': qa([
  { q: 'Tại sao bạn nên tránh chạy container với root?',
    a: `**A:** Container root = root trên host nếu có container escape vulnerability. Attacker có thể: đọc/ghi file nhạy cảm của host, leo thang privilege, attack container khác cùng node. Best practice: thêm \`USER nonroot\` (hoặc \`USER 1001\`) vào Dockerfile. Nhiều K8s cluster enforce \`PodSecurityPolicy\`/\`PodSecurityAdmission\` block container chạy với uid=0. Spring Boot images từ Buildpacks mặc định dùng non-root user (\`cnb\`).` },
  { q: '.dockerignore file là gì và tại sao quan trọng?',
    a: `**A:** \`.dockerignore\` liệt kê file/dir không copy vào build context gửi lên Docker daemon. Quan trọng: (1) **Security**: tránh copy \`.env\`, credentials, private keys vào image. (2) **Performance**: giảm build context size — \`node_modules\`, \`.git\`, \`target/\` có thể hàng GB; Docker daemon phải transfer toàn bộ build context trước khi build. (3) **Cache**: tránh invalidate cache khi file không liên quan thay đổi.` },
  { q: 'Làm thế nào để xử lý secret cần thiết lúc build time vs runtime?',
    a: `**A:** **Build time secret** (npm token, private repo): dùng \`--secret\` flag (BuildKit): \`RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm install\` — secret không được lưu trong image layer. **Không** dùng ARG/ENV cho secret vì visible trong \`docker history\`. **Runtime secret**: inject qua environment variable (K8s Secret, Docker Compose secrets, Vault Agent). Không hardcode secret vào Dockerfile hay image.` },
]),

'dynamic-sql': qa([
  { q: 'Tag <where> giải quyết vấn đề gì so với hardcode "WHERE 1=1"?',
    a: `**A:** \`WHERE 1=1\` là workaround phổ biến: luôn có WHERE, append condition bằng \`AND\` — nhưng sinh SQL xấu khi không có condition nào. **\`<where>\`** tag MyBatis thông minh hơn: nếu có ít nhất một condition → thêm WHERE và bỏ AND/OR thừa ở đầu; nếu không có condition nào → không thêm WHERE. Tương tự \`<trim prefix="WHERE" prefixOverrides="AND|OR">\`. Clean SQL, không cần workaround.` },
  { q: 'Viết batch INSERT 100 record bằng MyBatis thế nào?',
    a: `**A:** Dùng \`<foreach>\` tag trong mapper XML:\n\`\`\`xml\n<insert id="batchInsert">\n  INSERT INTO users (name, email) VALUES\n  <foreach collection="list" item="u" separator=",">\n    (#{u.name}, #{u.email})\n  </foreach>\n</insert>\n\`\`\`\nHoặc dùng ExecutorType.BATCH trong session:\n\`\`\`java\ntry (SqlSession session = factory.openSession(ExecutorType.BATCH)) {\n    users.forEach(u -> session.insert("insertUser", u));\n    session.commit();\n}\n\`\`\`` },
  { q: 'Biểu thức OGNL kiểm tra list không rỗng thế nào?',
    a: `**A:** Trong MyBatis \`<if test="...">\`, dùng OGNL expression:\n\`\`\`xml\n<if test="ids != null and ids.size() > 0">\n  AND id IN\n  <foreach collection="ids" item="id" open="(" separator="," close=")">\n    #{id}\n  </foreach>\n</if>\n\`\`\`\nCũng có thể: \`ids != null and !ids.isEmpty()\`. OGNL hỗ trợ: null check, method call, ternary, \`instanceof\`. Lưu ý: dùng \`and\`/\`or\` thay vì \`&&\`/\`||\` trong XML (& cần escape).` },
]),

'encapsulation': qa([
  { q: 'Encapsulation khác information hiding như thế nào?',
    a: `**A:** **Encapsulation**: kỹ thuật bundling data và behavior vào cùng class, với access modifier (private/protected/public) kiểm soát truy cập — *cơ chế*. **Information hiding**: nguyên tắc thiết kế — ẩn implementation detail, chỉ expose interface cần thiết — *mục tiêu*. Encapsulation là công cụ để đạt information hiding. Ví dụ: private field + getter/setter là encapsulation; nhưng nếu setter expose toàn bộ internal state → encapsulation nhưng không information hiding.` },
  { q: 'Tại sao immutable class mặc định thread-safe?',
    a: `**A:** Immutable object không có state mutation sau khi khởi tạo → không có race condition khi nhiều thread cùng đọc cùng lúc — không cần synchronization. String, Integer, LocalDate trong Java là immutable và thread-safe. Điều kiện immutable: tất cả fields phải \`final\`, không có setter, fields mutable (collection) phải defensive copy trong constructor. **Shared-nothing** là cách scale dễ nhất: immutable data pass between threads.` },
  { q: 'Vấn đề gì xảy ra khi trả về trực tiếp field collection có thể thay đổi?',
    a: `**A:** Caller nhận reference đến internal collection, có thể modify → phá vỡ invariant của class:\n\`\`\`java\npublic List<String> getItems() { return this.items; } // unsafe!\ncart.getItems().clear(); // xóa internal state!\n\`\`\`\nFix: trả về **defensive copy** hoặc **unmodifiable view**:\n\`\`\`java\nreturn Collections.unmodifiableList(this.items); // view, thay đổi ném UnsupportedOperationException\nreturn new ArrayList<>(this.items); // deep copy\nreturn List.copyOf(this.items); // Java 10+, immutable copy\n\`\`\`` },
]),

'entity-lifecycle': qa([
  { q: 'Sự khác biệt giữa managed và detached entity là gì?',
    a: `**A:** **Managed**: entity đang được Persistence Context (EntityManager) theo dõi — mọi thay đổi tự động persist khi flush/commit (dirty checking). **Detached**: entity không còn được EntityManager theo dõi — thay đổi sẽ không tự persist, phải gọi \`merge()\` để reattach. Entity trở thành detached khi: EntityManager close, gọi \`detach()\`, transaction end (với TRANSACTION scope). DTO pattern tránh detached entity vấn đề.` },
  { q: 'Khi nào Hibernate issue UPDATE SQL cho field đã thay đổi?',
    a: `**A:** Hibernate issue UPDATE khi: (1) Transaction commit (hoặc \`flush()\` được gọi) với managed entity đã bị modify. (2) Default: Hibernate flush **tất cả changed entities trong persistence context** trước khi execute query để đảm bảo query thấy data mới nhất. Hibernate default UPDATE tất cả columns (không chỉ changed column) — dùng \`@DynamicUpdate\` để chỉ update changed columns (giảm lock contention, tốt cho wide table).` },
  { q: 'Mục đích của merge() vs persist() là gì?',
    a: `**A:** **\`persist()\`**: thêm **new (transient) entity** vào persistence context — entity chưa có ID, sau commit sẽ INSERT. Throw exception nếu entity đã có ID. **\`merge()\`**: copy state của **detached entity** vào managed entity — load managed entity từ DB (hoặc tạo mới nếu không có), copy state, return managed entity. Dùng persist() cho create mới; merge() khi nhận detached entity từ bên ngoài (REST API, Session deserialization).` },
]),

'eventual-consistency': qa([
  { q: 'Làm thế nào để giải thích eventual consistency cho stakeholder không kỹ thuật?',
    a: `**A:** Dùng analogy: "Như bảng thông báo trong văn phòng — khi bạn post thông báo, không phải mọi người thấy ngay, nhưng sau vài phút tất cả sẽ thấy. Trong thời gian đó, một số người thấy thông báo mới, một số chưa." Hoặc DNS: sau khi đổi domain, không phải tất cả DNS server trên thế giới cập nhật ngay — cần 24-48h để propagate. Hệ thống của chúng ta hoạt động tương tự: dữ liệu sẽ đồng bộ, nhưng có thể mất vài giây.` },
  { q: 'Conflict nào có thể phát sinh với eventual consistency và giải quyết thế nào?',
    a: `**A:** **Write-write conflict**: hai node cùng update cùng record → diverge. Giải pháp: (1) **Last-Write-Wins (LWW)**: dùng timestamp/version — write mới hơn win; có thể mất data. (2) **CRDT**: data structure tự merge được. (3) **Version vectors**: track version mỗi node, detect conflict, prompt user resolve (Google Docs). (4) **Saga với compensating transaction**: undo conflict bằng business logic. Strategy phụ thuộc business: giỏ hàng có thể LWW; financial transaction cần strict consistency.` },
  { q: 'Đưa ví dụ khi eventual consistency chấp nhận được vs nguy hiểm.',
    a: `**A:** **Chấp nhận được**: social media like count (vài giây lag không ảnh hưởng UX), user profile view (stale avatar OK), product catalog (giá cũ vài giây OK nếu có validation khi checkout), DNS record, CDN cache. **Nguy hiểm**: (1) **Bank transfer** — phải strong consistency, không thể double-spend. (2) **Inventory** — oversell nếu count stale: đặt hàng thành công nhưng hết hàng thực. (3) **Authentication token** — revoke token phải propagate ngay. Dùng strong consistency cho financial, medical, security.` },
]),

'eviction-policies': qa([
  { q: 'Sự khác biệt giữa LRU và LFU eviction là gì?',
    a: `**A:** **LRU (Least Recently Used)**: evict item không được access **gần nhất** — phù hợp khi recent usage là predictor tốt của future access (temporal locality). **LFU (Least Frequently Used)**: evict item được access **ít lần nhất** theo lịch sử — phù hợp khi frequency là predictor tốt hơn. LFU tốt hơn cho data với stable popularity (hot vs cold content); LRU tốt hơn cho access pattern thay đổi theo thời gian. LRU implement đơn giản hơn (LinkedHashMap); LFU cần counter per item.` },
  { q: 'Redis quyết định evict gì khi memory đầy thế nào?',
    a: `**A:** Phụ thuộc \`maxmemory-policy\` config: **allkeys-lru** — evict any key theo LRU (phổ biến nhất cho cache). **volatile-lru** — chỉ evict key có TTL, theo LRU. **allkeys-lfu** (Redis 4+) — evict any key theo LFU. **noeviction** — throw error khi memory đầy (default, phù hợp cho data store không phải cache). **allkeys-random** — evict random. Redis dùng **approximate LRU** (sample 5-10 key, evict LRU trong sample) thay vì exact LRU để tránh overhead.` },
  { q: 'Metric nào cho biết eviction policy cần điều chỉnh?',
    a: `**A:** (1) **Eviction rate cao** (\`evicted_keys\` tăng liên tục trong \`INFO stats\`): cache quá nhỏ hoặc TTL quá ngắn — tăng memory hoặc điều chỉnh eviction policy. (2) **Hit rate thấp** (\`keyspace_hits/(keyspace_hits+keyspace_misses) < 80%\`): data bị evict trước khi được hit — tăng memory. (3) **Memory usage tăng liên tục đến maxmemory**: normal nếu policy là allkeys-lru; problematic nếu noeviction vì sẽ throw error sớm.` },
]),

'exception-handling': qa([
  { q: 'Sự khác biệt giữa checked và unchecked exception là gì?',
    a: `**A:** **Checked exception** (extends \`Exception\`, không phải \`RuntimeException\`): compiler buộc caller phải catch hoặc declare \`throws\` — ví dụ IOException, SQLException. Dùng cho recoverable situations. **Unchecked exception** (extends \`RuntimeException\`): không cần declare — ví dụ NullPointerException, IllegalArgumentException. Dùng cho programming errors hoặc unrecoverable situations. Modern Java: trend về unchecked bởi vì checked gây boilerplate và thường bị swallow.` },
  { q: 'Điều gì xảy ra nếu exception được ném trong finally block?',
    a: `**A:** Exception trong \`finally\` **replace** exception từ \`try\`/\`catch\` — exception gốc bị mất hoàn toàn, không phải suppressed. Đây là bug nguy hiểm vì mất nguyên nhân gốc. Ví dụ: connection.close() trong finally ném exception → che giấu exception thực từ business logic. Fix: wrap finally body trong try-catch, hoặc dùng **try-with-resources** — resource close exception được suppressed (accessible qua \`getSuppressed()\`), primary exception được giữ.` },
  { q: 'try-with-resources hoạt động như thế nào bên dưới?',
    a: `**A:** Compiler transform \`try (Resource r = new Resource()) { body }\` thành code: (1) Gọi \`body\`. (2) Khi exit (normal hoặc exception), gọi \`r.close()\`. (3) Nếu cả body và close() đều throw: body exception được giữ, close exception được **suppressed** (\`addSuppressed()\`). Resource phải implement \`AutoCloseable\`. Java 9: có thể dùng effectively-final variable đã khai báo ngoài: \`try (existingVar)\` — không cần khai báo lại.` },
]),

'exception-handling-controlleradvice': qa([
  { q: '@ControllerAdvice khác try-catch trong mỗi controller thế nào?',
    a: `**A:** try-catch trong mỗi controller: code lặp lại, dễ miss case, không consistent response format. **\`@ControllerAdvice\`**: centralized exception handling cho tất cả controller — không sửa controller code, consistent ErrorResponse format, dễ maintain. Áp dụng globally hoặc filter theo package/annotation. Kết hợp \`@ExceptionHandler\` cho từng exception type, \`ResponseBodyAdvice\` để transform response.` },
  { q: 'Spring giải quyết nhiều @ExceptionHandler method theo thứ tự nào?',
    a: `**A:** Spring chọn \`@ExceptionHandler\` **cụ thể nhất** (most specific): \`ResourceNotFoundException extends RuntimeException\` → handler cho \`ResourceNotFoundException\` được ưu tiên hơn handler cho \`RuntimeException\` hoặc \`Exception\`. Nếu cùng specificity trong \`@ControllerAdvice\` class → undefined order; nếu nhiều \`@ControllerAdvice\` class → thứ tự do \`@Order\` hoặc \`Ordered\` interface. Local controller \`@ExceptionHandler\` được ưu tiên hơn global \`@ControllerAdvice\`.` },
  { q: 'Làm thế nào để xử lý lỗi validation từ @Valid?',
    a: `**A:** \`@Valid\` trên method parameter ném \`MethodArgumentNotValidException\` (request body) hoặc \`ConstraintViolationException\` (path/query param). Trong \`@ControllerAdvice\`:\n\`\`\`java\n@ExceptionHandler(MethodArgumentNotValidException.class)\npublic ResponseEntity<Map<String, String>> handle(MethodArgumentNotValidException ex) {\n    Map<String, String> errors = new HashMap<>();\n    ex.getBindingResult().getFieldErrors()\n      .forEach(e -> errors.put(e.getField(), e.getDefaultMessage()));\n    return ResponseEntity.badRequest().body(errors);\n}\n\`\`\`` },
]),


'exchange-queue-binding': qa([
  { q: 'Sự khác biệt giữa direct và topic exchange là gì?',
    a: `**A:** **Direct exchange**: route message đến queue có binding key **khớp chính xác** routing key. Ví dụ: binding key "payment.success" → chỉ nhận message với routing key "payment.success". **Topic exchange**: routing key dùng **wildcard** — \`*\` (một word), \`#\` (zero hoặc nhiều word). Ví dụ: binding \`payment.*\` nhận "payment.success" và "payment.failed"; \`payment.#\` nhận cả "payment.success.retry". Topic linh hoạt hơn cho event routing pattern.` },
  { q: 'Điều gì xảy ra với message nếu không có queue nào bind để khớp routing key?',
    a: `**A:** Message bị **dropped** (mất) mặc định — RabbitMQ không lưu unrouted message. Nếu publisher set \`mandatory=true\`: broker return message về publisher qua \`ReturnCallback\`. Giải pháp tốt hơn: configure **Alternate Exchange (AE)** — khi message không được route, forward đến AE (thường là fanout exchange vào dead-letter queue) để audit/alert. Không dùng \`mandatory=true\` trong production vì synchronous và tốn resource.` },
  { q: 'Làm thế nào để implement pub/sub pattern trong RabbitMQ?',
    a: `**A:** Dùng **Fanout exchange**: exchange broadcast message đến TẤT CẢ queue đang bind — không cần routing key. Mỗi consumer (subscriber) tạo queue riêng và bind vào fanout exchange. Consumer mới → tạo queue mới và bind → tự động nhận message từ thời điểm đó. Ví dụ: order.placed fanout exchange → inventory queue, notification queue, analytics queue — mỗi service nhận bản copy riêng. Topic exchange với \`#\` routing key cũng đạt pub/sub nhưng với filter capability.` },
]),

'executorservice': qa([
  { q: 'Sự khác biệt giữa execute() và submit() trong ExecutorService là gì?',
    a: `**A:** **\`execute(Runnable)\`**: không trả về gì, exception trong task bị silent (logged bởi thread's uncaught exception handler). **\`submit(Callable/Runnable)\`**: trả về \`Future\` — có thể \`get()\` kết quả, \`cancel()\`, track completion. Exception trong task được wrap và re-thrown khi gọi \`future.get()\` dưới dạng \`ExecutionException\`. Prefer \`submit()\` trong production để handle exception và có thể timeout với \`get(timeout, unit)\`.` },
  { q: 'Làm thế nào để xử lý exception từ Future.get()?',
    a: `**A:** \`future.get()\` throw \`ExecutionException\` wrapping exception thực, và \`InterruptedException\` nếu thread bị interrupt:\n\`\`\`java\ntry {\n    Result r = future.get(5, TimeUnit.SECONDS);\n} catch (ExecutionException e) {\n    Throwable cause = e.getCause(); // exception thực\n    log.error("Task failed", cause);\n} catch (TimeoutException e) {\n    future.cancel(true);\n} catch (InterruptedException e) {\n    Thread.currentThread().interrupt(); // restore interrupt status\n}\n\`\`\`` },
  { q: 'Sự khác biệt giữa shutdown() và shutdownNow() là gì?',
    a: `**A:** **\`shutdown()\`**: graceful — không nhận task mới nhưng chờ task đang chạy và queued task hoàn thành. Sau đó gọi \`awaitTermination()\` để block chờ. **\`shutdownNow()\`**: forceful — interrupt tất cả đang chạy, trả về list task chưa start. Task đang chạy vẫn phải tự check \`Thread.interrupted()\` để dừng. Best practice: \`shutdown()\` → \`awaitTermination(60, SECONDS)\` → nếu không xong → \`shutdownNow()\`.` },
]),

'facade': qa([
  { q: 'Sự khác biệt giữa Facade và Adapter?',
    a: `**A:** **Facade**: simplify **complex subsystem** bằng cách cung cấp interface đơn giản hơn — client không cần biết chi tiết bên trong. Focus: simplification. **Adapter**: **convert interface** của một class thành interface khác mà client expect — giải quyết incompatibility. Focus: compatibility. Ví dụ: Facade = \`OrderService\` hide \`InventoryService + PaymentService + NotificationService\`. Adapter = wrap legacy \`OldPaymentGateway\` thành \`PaymentProcessor\` interface mới.` },
  { q: 'Facade có ngăn truy cập trực tiếp vào subsystem không?',
    a: `**A:** **Không** — Facade là suggestion/convenience, không enforce restriction. Client vẫn có thể access subsystem class trực tiếp nếu muốn. Facade chỉ cung cấp một cách đơn giản hơn để dùng subsystem. Nếu muốn enforce encapsulation (ngăn truy cập trực tiếp), cần dùng package-private access modifiers, Java modules (module-info.java), hoặc architecture enforcement tool (ArchUnit) — Facade thuần túy không đủ.` },
  { q: 'Đặt tên một Facade trong Spring Framework.',
    a: `**A:** **\`JdbcTemplate\`** là Facade điển hình: hide phức tạp của JDBC (tạo connection, PreparedStatement, xử lý ResultSet, close resource, handle exception) sau interface đơn giản: \`jdbcTemplate.query("SELECT * FROM users WHERE id=?", rowMapper, id)\`. **\`RestTemplate\`** là Facade cho HTTP client (connection management, serialization, error handling). **\`RedisTemplate\`** hide Redis connection và serialization. Tất cả đều simplify complex subsystem operations.` },
]),

'file-process': qa([
  { q: 'kill -9 và kill -15 khác nhau thế nào?',
    a: `**A:** **\`kill -15\` (SIGTERM)**: graceful shutdown signal — process nhận được, có thể handle: flush data, close connection, cleanup trước khi exit. Spring Boot handle SIGTERM → graceful shutdown (chờ active request hoàn thành). **\`kill -9\` (SIGKILL)**: force kill — OS terminate process ngay lập tức, không thể catch hay ignore. Process không có cơ hội cleanup → có thể để lại incomplete data, open file, lock. Luôn thử SIGTERM trước, SIGKILL là last resort.` },
  { q: 'Chạy ứng dụng Java background và giữ nó chạy sau khi logout thế nào?',
    a: `**A:** (1) **nohup**: \`nohup java -jar app.jar > app.log 2>&1 &\` — output vào nohup.out, process survive logout. (2) **systemd** (production): tạo service file, \`systemctl start myapp\` — auto-restart khi crash, start on boot. (3) **screen/tmux**: tạo session persist qua logout: \`screen -S myapp\`, chạy app, \`Ctrl+A+D\` để detach, \`screen -r myapp\` để resume. systemd là best practice cho production.` },
  { q: 'Tìm thư mục nào đang chiếm nhiều disk nhất thế nào?',
    a: `**A:** \`du -sh /* 2>/dev/null | sort -rh | head -20\` — hiện top thư mục lớn nhất. Drill down: \`du -sh /var/* | sort -rh | head -10\`. \`ncdu\` là TUI tool đẹp hơn: \`ncdu /\` — interactive browse theo tree. Để tìm file lớn nhất: \`find / -type f -size +100M -exec ls -lh {} \; 2>/dev/null | sort -k5 -rh\`. Với Java apps: check \`/tmp\` (temp file), log directory, GC log, heap dump.` },
]),

'filters-vs-interceptors': qa([
  { q: 'Bạn có thể inject Spring bean vào Filter không? Bằng cách nào?',
    a: `**A:** \`Filter\` là Servlet API, khởi tạo trước Spring context — inject bình thường không work. Giải pháp: (1) **Extend \`OncePerRequestFilter\`** (Spring) — abstract class support \`@Autowired\` vì Spring tạo bean, đăng ký với Servlet container. (2) **\`DelegatingFilterProxy\`**: Servlet filter chỉ delegate sang Spring bean thực — Spring context manage lifecycle. (3) **Programmatic registration**: \`FilterRegistrationBean\` trong \`@Configuration\` — Spring tạo và manage filter bean.` },
  { q: 'Điều gì xảy ra với interceptor nếu filter ném exception?',
    a: `**A:** Filter chạy **trước** DispatcherServlet — nếu filter ném exception, request **không reach** DispatcherServlet, do đó interceptor **không được gọi**. \`preHandle()\`, \`postHandle()\`, \`afterCompletion()\` đều không được invoke. Exception từ filter phải được handle trong filter tự nó hoặc bởi error page mapping (web.xml / \`@WebServlet\`). \`@ExceptionHandler\` trong \`@ControllerAdvice\` cũng không catch exception từ filter vì nó xử lý sau DispatcherServlet.` },
  { q: 'Làm thế nào để đăng ký Filter vs Interceptor?',
    a: `**A:** **Filter**: (1) Annotate \`@WebFilter\` + \`@ServletComponentScan\` trên main class. (2) \`FilterRegistrationBean\` trong \`@Configuration\` — control order bằng \`setOrder()\`. **Interceptor**: implement \`HandlerInterceptor\`, đăng ký trong \`@Configuration\` extends \`WebMvcConfigurer\`:\n\`\`\`java\n@Override\npublic void addInterceptors(InterceptorRegistry registry) {\n    registry.addInterceptor(myInterceptor).addPathPatterns("/api/**");\n}\n\`\`\`\nFilter scope: toàn bộ Servlet container. Interceptor scope: chỉ trong Spring MVC.` },
]),

'group-by-having': qa([
  { q: 'Sự khác biệt giữa WHERE và HAVING là gì?',
    a: `**A:** **WHERE**: filter rows **trước** khi aggregate — không dùng được aggregate function (\`SUM\`, \`COUNT\`). **HAVING**: filter **sau** khi GROUP BY, dùng được aggregate function. Ví dụ: \`WHERE age > 18\` lọc rows trước; \`HAVING COUNT(*) > 5\` lọc group sau. Rule: filter non-aggregate condition → WHERE (hiệu quả hơn, loại rows sớm); filter aggregate condition → HAVING. Có thể dùng cả hai: \`WHERE age > 18 GROUP BY city HAVING COUNT(*) > 100\`.` },
  { q: 'Bạn có thể dùng HAVING mà không có GROUP BY không?',
    a: `**A:** **Có** — toàn bộ result set được treat như một group. Ví dụ: \`SELECT COUNT(*) FROM orders HAVING COUNT(*) > 1000\` — trả về count nếu total orders > 1000, trả về empty nếu không. Tương đương với \`SELECT COUNT(*) FROM orders WHERE (SELECT COUNT(*) FROM orders) > 1000\` nhưng ngắn hơn. Thực tế ít dùng pattern này; thường HAVING đi kèm GROUP BY.` },
  { q: 'Thứ tự thực thi SQL là gì?',
    a: `**A:** Logical execution order: (1) **FROM / JOIN** — xác định table, join. (2) **WHERE** — filter rows. (3) **GROUP BY** — group rows. (4) **HAVING** — filter groups. (5) **SELECT** — compute column, expression. (6) **DISTINCT** — remove duplicate. (7) **ORDER BY** — sort. (8) **LIMIT/OFFSET** — paginate. Lý do không dùng SELECT alias trong WHERE: alias được resolve ở bước 5, sau bước 2 WHERE. PostgreSQL cho phép dùng alias trong ORDER BY vì ORDER BY ở bước 7.` },
]),

'happens-before': qa([
  { q: 'Liệt kê các quy tắc happens-before trong JMM.',
    a: `**A:** Các quy tắc happens-before trong Java Memory Model: (1) **Program order**: action trước trong thread happens-before action sau. (2) **Monitor lock**: \`unlock\` happens-before \`lock\` kế tiếp trên cùng monitor. (3) **Volatile write**: write volatile variable happens-before read kế tiếp. (4) **Thread start**: \`thread.start()\` happens-before mọi action trong thread đó. (5) **Thread join**: tất cả action trong thread happens-before \`thread.join()\` return. (6) **Transitivity**: nếu A hb B và B hb C → A hb C.` },
  { q: 'synchronized có cung cấp happens-before không? Giải thích.',
    a: `**A:** **Có**. Khi thread giải phóng monitor lock (\`synchronized\` block exit hoặc method return): tất cả action trước unlock **happens-before** tất cả action sau khi thread khác acquire cùng lock đó. Đảm bảo: mọi write trong synchronized block được flush lên main memory, mọi read sau khi acquire lock sẽ thấy update mới nhất. Đây là lý do synchronized cung cấp cả **mutual exclusion** lẫn **visibility guarantee**.` },
  { q: 'Có happens-before giữa hai thread không đồng bộ hóa không?',
    a: `**A:** **Không** — nếu hai thread không share synchronization point (lock, volatile, thread join), không có happens-before giữa chúng. Hậu quả: thread B có thể không thấy write từ thread A (CPU cache, compiler reordering). Ví dụ classic: \`flag\` là non-volatile boolean, thread A set \`flag=true\`, thread B spin \`while(!flag)\` → B có thể loop mãi vì không thấy write. Fix: \`volatile boolean flag\` tạo happens-before.` },
]),

'high-concurrency': qa([
  { q: "Phát biểu Little's Law và dùng để size thread pool.",
    a: `**A:** **L = λ × W**: L = số item trong system (concurrent requests), λ = throughput (request/s), W = thời gian xử lý (s). Ví dụ: 500 RPS, avg latency 200ms → L = 500 × 0.2 = **100 concurrent requests** → cần thread pool size = 100 (plus buffer 20% → 120). Lưu ý: W = *service time + wait time*, nên khi queue build up, W tăng → cần L tăng → pool không đủ → queue càng dài → latency tăng (spiral). Target: utilization < 70-80%.` },
  { q: 'Walk me through thiết kế system xử lý 50K request/giây.',
    a: `**A:** (1) **Load balancer layer**: 2-3 LB instances (L4/L7), sticky session nếu cần. (2) **App tier**: horizontal scale — tính số instance theo Little's Law: 50K × 0.1s (avg) = 5000 concurrent → mỗi instance 500 thread → 10 instances. (3) **Caching**: Redis cluster giảm 80% DB load — cache hot data. (4) **DB layer**: read replica, connection pooling (HikariCP). (5) **Async**: heavy operation → Kafka, không block request. (6) **CDN**: static assets. (7) **Rate limiting**: protect backend.` },
  { q: 'Khi latency spike dưới high load, điều đầu tiên bạn kiểm tra là gì?',
    a: `**A:** Theo thứ tự: (1) **Thread pool saturation**: \`/actuator/metrics/executor.active\` — nếu active ≈ max → thread pool full → queue building. (2) **DB slow query**: slow query log, connection pool wait time. (3) **GC pressure**: GC log — Full GC hoặc long pause. (4) **External dependency**: downstream service latency (distributed trace). (5) **CPU throttling**: Docker/K8s CPU limit hit → throttle. Dùng distributed tracing để thấy span nào đang chậm.` },
]),

'horizontal-vs-vertical': qa([
  { q: 'Khi nào vertical scaling không còn hiệu quả?',
    a: `**A:** Vertical scaling (thêm RAM/CPU) có giới hạn vật lý và kinh tế: (1) **Hardware ceiling**: máy lớn nhất có giới hạn (AWS r6a.48xlarge: 192 vCPU, 1.5TB RAM). (2) **Cost**: máy to đắt hơn phi tuyến — 2x resource thường > 3x chi phí. (3) **Single point of failure**: một node không có HA. (4) **Downtime khi scale**: thường cần restart để resize. Khi traffic tăng 10x cần 10x resource → vertical không còn viable → horizontal.` },
  { q: 'Service cần gì để hỗ trợ horizontal scaling?',
    a: `**A:** (1) **Stateless**: không lưu session state in-memory — dùng Redis/DB cho session. (2) **Idempotent**: request có thể retry khi LB re-route. (3) **External config**: không hardcode host/port — dùng env var hoặc config service. (4) **Health check endpoint**: LB cần để biết instance healthy. (5) **Externalize state**: DB, cache, message queue là shared state, không nằm trong instance. (6) **Distributed locking**: nếu cần lock, dùng Redis/ZooKeeper không phải in-memory.` },
  { q: 'Kubernetes HPA quyết định khi nào scale thế nào?',
    a: `**A:** HPA (Horizontal Pod Autoscaler) periodically (default 15s) query metrics server: CPU usage, memory, hoặc custom metrics (RPS, queue length qua KEDA). Algorithm: \`desiredReplicas = ceil(currentReplicas × currentMetricValue / targetMetricValue)\`. Ví dụ: target CPU = 50%, hiện 80%, 3 pods → ceil(3 × 80/50) = ceil(4.8) = 5 pods. Scale-up: ngay khi metric vượt threshold. Scale-down: chờ 5 phút (cooldown) để tránh flapping.` },
]),

'hpa-rolling-update': qa([
  { q: 'Kubernetes đảm bảo zero downtime trong rolling update thế nào?',
    a: `**A:** Rolling update tuân theo cấu hình \`strategy.rollingUpdate\`: \`maxSurge\` (số pod extra được tạo vượt replicas, default 25%) và \`maxUnavailable\` (số pod có thể unavailable trong quá trình, default 25%). Kubernetes chỉ terminate pod cũ khi pod mới đã **Ready** (pass readiness probe). Với \`maxUnavailable=0\`: không terminate pod cũ cho đến khi pod mới ready → true zero downtime nhưng cần thêm resource.` },
  { q: 'HPA có thể dùng metric nào ngoài CPU và memory?',
    a: `**A:** HPA v2 hỗ trợ **custom metrics** và **external metrics**: (1) Prometheus metrics qua Prometheus Adapter: RPS, queue depth, error rate. (2) **KEDA (Kubernetes Event-Driven Autoscaler)**: scale theo Kafka consumer lag, RabbitMQ queue length, Redis list length, SQS queue depth, HTTP request count. (3) Cloud provider metrics: AWS SQS, Azure Service Bus. Ví dụ: scale consumer pods khi Kafka lag > 1000 → \`ScaledObject\` in KEDA.` },
  { q: 'PodDisruptionBudget là gì và khi nào bạn cần?',
    a: `**A:** **PDB** giới hạn số pod của một deployment có thể bị disrupted (voluntarily) cùng lúc: \`minAvailable: 2\` hoặc \`maxUnavailable: 1\`. Khi nào cần: (1) **Node drain** (rolling upgrade, scaling down node): kubectl drain terminate pod — PDB ngăn không để quá nhiều pod bị terminate đồng thời, đảm bảo service availability. (2) Cluster upgrade, node maintenance. Không ảnh hưởng involuntary disruption (node crash). Rule: set PDB cho mọi production service với replicas > 1.` },
]),


'image-container-layer': qa([
  { q: 'Tại sao bạn nên copy file descriptor gói trước source code trong Dockerfile?',
    a: `**A:** Docker cache layer theo thứ tự instruction. Source code thay đổi thường xuyên; \`package.json\`/\`pom.xml\` thay đổi ít hơn. Nếu copy source code trước → mỗi code change invalidate cache từ COPY trở xuống, bao gồm \`npm install\`/\`mvn install\` — cực chậm. Copy package files trước:\n\`\`\`dockerfile\nCOPY pom.xml .\nRUN mvn dependency:go-offline  # cache hit nếu pom không đổi\nCOPY src/ src/\nRUN mvn package\n\`\`\`\nDependency install chỉ re-run khi package file thay đổi.` },
  { q: 'Điều gì xảy ra với writable layer khi container bị xóa?',
    a: `**A:** Mỗi container có **writable layer** (container layer) trên top của image layers (read-only). Khi container bị xóa (\`docker rm\`), writable layer bị xóa vĩnh viễn — mọi data được ghi trong container (log, temp file, DB data) mất. Để persist data: dùng **Docker volume** (managed bởi Docker daemon, persist sau khi container xóa) hoặc **bind mount** (map với host directory). Stateful service (DB) phải dùng volume.` },
  { q: 'Union filesystem cho phép chia sẻ layer giữa container thế nào?',
    a: `**A:** Docker dùng Union filesystem (OverlayFS trên Linux): multiple read-only image layers + writable container layer stack thành một unified view. Nhiều container dùng cùng base image (ví dụ \`eclipse-temurin:21-jre\`) **chia sẻ image layers** — layer chỉ lưu một lần trên disk và trong memory. Container A và B đều có \`eclipse-temurin:21-jre\` layer nhưng chỉ download/store một lần → tiết kiệm đáng kể disk và pull time khi cùng host.` },
]),

'indexing': qa([
  { q: 'Sự khác biệt giữa clustered và non-clustered index là gì?',
    a: `**A:** **Clustered index**: data rows được **sắp xếp vật lý** theo index key — chỉ có một clustered index per table vì không thể sắp xếp vật lý theo hai chiều. InnoDB: Primary Key là clustered index mặc định, data pages chứa actual rows. **Non-clustered index**: B-tree riêng, leaf node chứa index key + pointer đến row (row ID hoặc PK). Nhiều non-clustered index per table. Lookup qua non-clustered: traverse index → fetch row từ clustered index (double lookup).` },
  { q: 'Khi nào bạn dùng composite index?',
    a: `**A:** Dùng composite index khi: (1) Query thường filter theo nhiều column cùng lúc: \`WHERE status='ACTIVE' AND user_id=?\` → index \`(status, user_id)\`. (2) Muốn **covering index**: include SELECT columns vào index để tránh table lookup. (3) ORDER BY theo nhiều column: \`ORDER BY a, b\` → index \`(a, b)\` eliminate filesort. Rule: đặt equality column trước, range column sau. Số lượng: đừng tạo quá nhiều — mỗi index tốn write overhead.` },
  { q: 'Index selectivity là gì và tại sao quan trọng?',
    a: `**A:** **Selectivity** = số distinct values / tổng rows. Cao (gần 1.0): index rất selective — gender (M/F) selectivity ≈ 0.5, email selectivity ≈ 1.0. DB optimizer dùng selectivity để quyết định có dùng index hay không. Index với selectivity thấp (ví dụ: boolean column, status với 3 giá trị) thường không hiệu quả — DB có thể chọn full table scan nhanh hơn. Kiểm tra: \`SHOW INDEX FROM table\` → cardinality column.` },
]),

'inheritance': qa([
  { q: 'Diamond problem là gì và Java giải quyết nó thế nào?',
    a: `**A:** Diamond problem: class D inherit từ B và C, cả B và C đều inherit từ A có method \`foo()\` — D inherit version nào? Java giải quyết: (1) **Không cho phép extend nhiều class** — chỉ single inheritance cho class. (2) **Multiple interface**: nếu B và C là interface và cùng có default method \`foo()\` → compile error trong D, buộc D phải override và specify rõ: \`B.super.foo()\` hoặc implementation riêng. Java ưu tiên class > interface, specific > general.` },
  { q: 'Khi nào inheritance phù hợp hơn composition?',
    a: `**A:** Inheritance phù hợp khi có quan hệ **"is-a" rõ ràng** và subclass thực sự là specialization của parent — không phải chỉ muốn reuse code. Ví dụ: \`Dog extends Animal\`, \`AdminUser extends User\`. Composition phù hợp hơn khi: muốn reuse behavior mà không có "is-a" relationship, muốn swap behavior runtime, tránh tight coupling với parent implementation. Rule: **favor composition over inheritance** (GoF). Composition linh hoạt hơn, testable hơn.` },
  { q: 'Liskov Substitution Principle có ý nghĩa gì trong thực tế?',
    a: `**A:** LSP: object của subtype phải có thể thay thế object của supertype mà không làm hỏng chương trình. Thực tế: (1) Subclass không nên strengthen precondition (yêu cầu input chặt hơn parent). (2) Subclass không nên weaken postcondition (return ít đảm bảo hơn parent). (3) Ví dụ vi phạm: \`Square extends Rectangle\` — setWidth trên Square cũng change height → code expect Rectangle behavior bị hỏng. Vi phạm LSP thường xuất hiện khi inheritance được dùng cho code reuse thay vì "is-a" relationship.` },
]),

'integration-test': qa([
  { q: 'Sự khác biệt giữa @SpringBootTest và @DataJpaTest?',
    a: `**A:** **\`@SpringBootTest\`**: load **full ApplicationContext** — tất cả beans, auto-configuration, web layer. Chậm hơn nhưng test real integration. Dùng cho end-to-end test. **\`@DataJpaTest\`**: load **chỉ JPA slice** — entity, repository, JPA config, in-memory DB (H2 default) — không load service, controller, security. Nhanh hơn nhiều. Tương tự: \`@WebMvcTest\` (MVC slice), \`@DataMongoTest\`, \`@DataRedisTest\`. Principle: dùng slice test khi chỉ cần test một layer.` },
  { q: 'Tại sao ưu tiên TestContainers hơn H2 cho JPA test?',
    a: `**A:** H2 là in-memory DB khác với PostgreSQL/MySQL về: (1) **SQL dialect**: H2 không support tất cả syntax (window function, JSON, specific type). (2) **Behavior**: H2 có thể pass test nhưng fail production (constraint handling, sequence behavior). (3) **Migration**: Flyway/Liquibase script cho production DB có thể syntax error trong H2. TestContainers chạy **actual Docker container** của production DB — test chính xác hơn, tránh "works in test, fails in prod".` },
  { q: 'Slice test cải thiện CI speed thế nào?',
    a: `**A:** \`@SpringBootTest\` load full context mất 10-30s mỗi test class. Slice test load partial context mất 1-3s. Với 100 test class: full = 1000s-3000s; slice = 100s-300s. Ngoài ra, Spring **cache ApplicationContext** — test class dùng cùng config tái sử dụng context. \`@MockBean\` phá cache (tạo context mới). Tip: nhóm test dùng cùng mock setup vào cùng class, minimize \`@MockBean\` để maximize context reuse, dùng \`@DirtiesContext\` chỉ khi thực sự cần.` },
]),

'interface-vs-abstract-class': qa([
  { q: 'Có thể thêm method mới vào interface mà không phá vỡ implementation hiện tại không?',
    a: `**A:** **Có** — dùng **default method** (Java 8+): existing implementation không bị break, tự động nhận implementation mặc định. \`interface Shape { default double perimeter() { return 0; } }\` — tất cả existing Shape implementation không cần sửa. Tuy nhiên: nếu implementation muốn customize → override. Cẩn thận: nếu hai interface cùng có default method trùng tên → class implement cả hai phải override để resolve conflict.` },
  { q: 'Abstract method và default method trong Java 8 khác nhau thế nào?',
    a: `**A:** **Abstract method**: không có body, subclass **bắt buộc** phải implement — không implement → compile error. **Default method**: có body, implementation có thể override hoặc không — inherit mặc định nếu không override. Abstract method define contract (must implement); default method provide backward-compatible API evolution. Static method trong interface (Java 8+): utility method, không override được, gọi qua \`Interface.method()\`.` },
  { q: 'Khi nào bạn chọn abstract class thay vì interface trong codebase lớn?',
    a: `**A:** Abstract class trong codebase lớn khi: (1) Muốn **template method pattern** — define algorithm skeleton với hook methods subclass override — ví dụ Spring \`AbstractController\`, \`AbstractMessageConverter\`. (2) Muốn **shared state** (fields) và protected helper methods giữa nhiều subclass. (3) Muốn enforce **constructor contract** — abstract class có constructor, interface không. Interface khi muốn define capability/role mà nhiều class không liên quan có thể implement.` },
]),

'java-i-o': qa([
  { q: 'Sự khác biệt giữa java.io và java.nio là gì?',
    a: `**A:** **java.io (blocking I/O)**: stream-oriented, blocking — thread block khi đọc/ghi. Đơn giản, dễ dùng, phù hợp throughput thấp. **java.nio**: buffer-oriented, non-blocking — channel + buffer model, Selector cho multiplexed I/O. Một thread có thể xử lý nhiều channel đồng thời qua Selector. NIO phức tạp hơn nhưng hiệu quả hơn khi cần xử lý nhiều concurrent connection với ít thread. Java 21 Virtual Threads làm blocking I/O scale như NIO mà code đơn giản hơn.` },
  { q: 'Khi nào nên dùng NIO thay vì Blocking I/O?',
    a: `**A:** Dùng **NIO** khi: (1) Cần xử lý **hàng nghìn concurrent connection** với ít thread (chat server, game server, proxy). (2) Cần non-blocking operation với timeout. (3) Memory-mapped file cho file I/O performance cao. NIO phức tạp: ByteBuffer flip/clear, Selector event loop. **Blocking I/O** phù hợp khi: concurrent connection ít, code đơn giản hơn quan trọng, hoặc dùng Virtual Threads (Java 21+) — blocking code scale như NIO.` },
  { q: 'Selector trong Java NIO có vai trò gì?',
    a: `**A:** **Selector** là multiplexer: một thread monitor **nhiều Channel** cùng lúc. Register channel với selector (kèm interest ops: OP_READ, OP_WRITE, OP_CONNECT, OP_ACCEPT). \`selector.select()\` block cho đến khi có channel ready — return set of \`SelectionKey\`. Duyệt keys, xử lý từng ready channel. Pattern: event loop trong một thread thay vì thread-per-connection. Nền tảng của Netty, Tomcat NIO connector, WebSocket server.` },
]),

'jmeter-gatling-k6': qa([
  { q: 'Sự khác biệt giữa virtual user và request per second là gì?',
    a: `**A:** **Virtual User (VU)**: simulated concurrent user — mỗi VU thực hiện scenario tuần tự (login → browse → checkout → logout). Số VU = concurrent session. **RPS (Request Per Second)**: throughput — số request/s hệ thống xử lý. Mối quan hệ: RPS = VU × (1/response_time) theo Little's Law. 100 VU với avg 1s response → 100 RPS. Tăng VU → tăng RPS cho đến khi system saturate. k6 dùng VU model; Gatling dùng scenario injection; JMeter dùng thread (tương đương VU).` },
  { q: 'Làm thế nào để parameterize test với credential user khác nhau?',
    a: `**A:** Đọc data từ CSV file: (1) **JMeter**: CSV Data Set Config → điền username/password từ file vào variables. (2) **Gatling**: \`csv("users.csv").circular()\` → inject từng user vào scenario. (3) **k6**: \`SharedArray\` đọc JSON/CSV, iterate theo VU index. Best practice: mỗi VU dùng credential riêng để simulate real multi-user scenario, tránh cache warm-up bias từ một user duy nhất. Đảm bảo file test data đủ lớn cho số VU.` },
  { q: 'Think time mô phỏng gì trong load test?',
    a: `**A:** **Think time** là pause giữa các request trong một VU scenario — simulate user đọc trang, điền form, suy nghĩ trước khi click. Không có think time: VU liên tục gửi request → RPS quá cao, không realistic. Ví dụ: user browse shop, dừng 3-5 giây xem product → add to cart → dừng 2 giây → checkout. Think time làm test realistic hơn: cùng số VU nhưng có think time → RPS thấp hơn, latency profile gần thực tế hơn. Dùng random think time trong range (không fixed) để tránh synchronized requests.` },
]),

'joins': qa([
  { q: 'Sự khác biệt giữa LEFT JOIN và INNER JOIN là gì?',
    a: `**A:** **INNER JOIN**: chỉ trả về row có match ở cả hai table. **LEFT JOIN** (LEFT OUTER JOIN): trả về tất cả row từ table bên trái; nếu không có match bên phải → column bên phải là NULL. Ví dụ: \`SELECT u.name, o.id FROM users u LEFT JOIN orders o ON u.id=o.user_id\` → trả về tất cả user kể cả user chưa có đơn hàng (order_id = NULL). INNER JOIN = "chỉ user có đơn hàng". Dùng LEFT JOIN khi muốn giữ tất cả record của table chính.` },
  { q: 'Làm thế nào để tìm hàng trong Bảng A không có khớp trong Bảng B?',
    a: `**A:** Dùng **LEFT JOIN + IS NULL** pattern:\n\`\`\`sql\nSELECT a.* FROM table_a a\nLEFT JOIN table_b b ON a.id = b.a_id\nWHERE b.a_id IS NULL;\n\`\`\`\nHoặc \`NOT EXISTS\`:\n\`\`\`sql\nSELECT * FROM table_a a\nWHERE NOT EXISTS (SELECT 1 FROM table_b b WHERE b.a_id = a.id);\n\`\`\`\nHoặc \`NOT IN\` (cẩn thận: nếu subquery có NULL → NOT IN trả về empty). LEFT JOIN + IS NULL thường được optimizer tối ưu tốt nhất.` },
  { q: 'Tích Descartes là gì và khi nào có thể vô tình xảy ra?',
    a: `**A:** Tích Descartes (Cartesian product): kết hợp mỗi row của table A với mỗi row của table B — N×M rows. Vô tình xảy ra khi: (1) Quên ON condition trong JOIN: \`FROM a, b\` hoặc \`FROM a JOIN b\` không có ON — cross join tất cả. (2) JOIN condition sai/không đủ selective: \`ON a.year = b.year\` khi nhiều row có cùng year. (3) Aggregate nhiều JOIN: mỗi 1-to-many JOIN nhân rows — dùng \`SUM\` có thể bị double-count (aggregate join anti-pattern).` },
]),

'jpa-hibernate': qa([
  { q: 'Sự khác biệt giữa EAGER và LAZY fetching là gì?',
    a: `**A:** **EAGER**: quan hệ được load **cùng lúc** khi load entity — luôn có data, nhưng có thể load data không cần thiết (N+1 problem, unnecessary JOIN). **LAZY**: quan hệ chỉ được load **khi truy cập** — proxy được inject, SQL issue khi access. Vấn đề LAZY: nếu truy cập ngoài transaction (LazyInitializationException). JPA default: \`@ManyToOne\`, \`@OneToOne\` = EAGER; \`@OneToMany\`, \`@ManyToMany\` = LAZY. Best practice: tất cả LAZY, fetch explicitly khi cần bằng JOIN FETCH hoặc EntityGraph.` },
  { q: 'Dirty checking trong Hibernate là gì?',
    a: `**A:** Khi entity được load trong persistence context (managed state), Hibernate giữ **snapshot** của trạng thái ban đầu. Khi flush (commit hoặc explicit flush), Hibernate so sánh current state với snapshot — nếu khác → tự động generate UPDATE SQL. Không cần gọi \`save()\` hay \`update()\` cho managed entity. Overhead: so sánh tất cả field của tất cả managed entity trước flush. Tối ưu: \`@DynamicUpdate\` chỉ UPDATE changed column; hạn chế số managed entity trong session.` },
  { q: 'JPA first-level cache hoạt động thế nào?',
    a: `**A:** **First-level cache** (L1) là **persistence context** — map từ entity ID đến entity instance. Trong cùng transaction, \`em.find(User.class, 1L)\` lần đầu → hit DB; lần hai → return từ cache, không query DB. Cache scope: một transaction/EntityManager — không share giữa transaction. Hệ quả: trong cùng transaction, modify entity → close entity manager → next transaction thấy DB state (không thấy modification nếu không commit). L2 cache (optional, EHCache/Caffeine) share giữa transaction.` },
]),

'junit-5-annotations': qa([
  { q: 'Sự khác biệt giữa @BeforeEach và @BeforeAll?',
    a: `**A:** **\`@BeforeEach\`**: chạy **trước mỗi test method** trong class — mỗi test có fresh state. **\`@BeforeAll\`**: chạy **một lần trước tất cả test** trong class — phải là \`static\` method (vì instance chưa tạo). Dùng \`@BeforeEach\` cho setup cần fresh per test (mock setup, DB state). Dùng \`@BeforeAll\` cho expensive setup chạy một lần (start server, load test data file). Tương tự: \`@AfterEach\` và \`@AfterAll\`.` },
  { q: '@ExtendWith hoạt động thế nào?',
    a: `**A:** \`@ExtendWith\` đăng ký **Extension** cho JUnit 5 — thay thế JUnit 4 \`@RunWith\`. Extension hook vào lifecycle: \`BeforeAllCallback\`, \`BeforeEachCallback\`, \`AfterEachCallback\`, parameter resolution (\`ParameterResolver\`). Ví dụ: \`@ExtendWith(MockitoExtension.class)\` → tự động init \`@Mock\`, \`@InjectMocks\`; \`@ExtendWith(SpringExtension.class)\` → load Spring context. \`@SpringBootTest\` đã include \`SpringExtension\` ngầm. Nhiều extension có thể stack: \`@ExtendWith({A.class, B.class})\`.` },
  { q: 'Khi nào @TestInstance(PER_CLASS) hữu ích?',
    a: `**A:** Mặc định JUnit 5 tạo instance mới cho mỗi test method (PER_METHOD) — \`@BeforeAll\` phải static. \`@TestInstance(Lifecycle.PER_CLASS)\`: dùng chung một instance cho tất cả test trong class. Hữu ích khi: (1) \`@BeforeAll\` muốn access instance field (không thể static). (2) Muốn share state giữa test (controversial — test nên independent). (3) Kotlin: companion object không cần cho static member. Trade-off: test có thể leak state sang nhau, order dependency.` },
]),

'jvm-flags-cheatsheet': qa([
  { q: '-Xms và -Xmx tại sao nên đặt bằng nhau trong production?',
    a: `**A:** Khi \`-Xms < -Xmx\`, JVM mở rộng heap khi cần — heap resize là **Stop-The-World operation** và tốn thời gian. Đặt bằng nhau (ví dụ \`-Xms2g -Xmx2g\`): JVM cấp phát toàn bộ ngay từ đầu, không resize, memory footprint predictable cho K8s resource limits. Nhược điểm: container chiếm memory ngay kể cả khi idle. Trong production, stability > memory efficiency.` },
  { q: 'Khi nào dùng ZGC thay vì G1GC?',
    a: `**A:** Chọn **ZGC** (Java 17+) khi cần pause time < 1ms bất kể heap size — trading, gaming, real-time streaming, HFT. G1GC đủ tốt cho hầu hết microservice với pause target 200ms. ZGC dùng colored pointers và load barriers cho concurrent marking/compaction, không stop app thread lâu. Trade-off: ZGC tốn CPU nhiều hơn G1GC cho concurrent work. Chạy benchmark với workload thực tế trước khi quyết định.` },
  { q: '-XX:+UseContainerSupport làm gì?',
    a: `**A:** \`-XX:+UseContainerSupport\` (default ON từ JDK 10): cho phép JVM đọc **container resource limits** (Docker/K8s CPU và memory limit) thay vì đọc host machine resource. Không có flag này (JDK < 10): JVM thấy host có 32GB RAM → set heap = 25% × 32GB = 8GB → OOMKilled khi container chỉ limit 512MB. Với flag: JVM thấy container limit 512MB → set heap hợp lý. Trong K8s: luôn set memory limit và để JVM tự calculate heap từ container limit.` },
]),


'lazy-loading': qa([
  { q: 'Nguyên nhân LazyInitializationException và cách sửa là gì?',
    a: `**A:** Xảy ra khi truy cập LAZY association **ngoài persistence context** (sau transaction đã close). Ví dụ: \`user.getOrders().size()\` trong REST controller khi transaction đã kết thúc. Cách sửa: (1) **JOIN FETCH** trong query: \`SELECT u FROM User u JOIN FETCH u.orders WHERE u.id=:id\`. (2) **@EntityGraph**: \`@EntityGraph(attributePaths={"orders"})\` trên repository method. (3) Đổi sang EAGER (không khuyên — ảnh hưởng tất cả query). (4) DTO projection thay vì entity cho REST response.` },
  { q: 'Open Session in View anti-pattern là gì?',
    a: `**A:** **OSIV**: giữ Hibernate session/EntityManager mở **suốt request** (kể cả rendering view/controller) — giải quyết LazyInitializationException bằng cách session vẫn active khi render. Anti-pattern vì: (1) DB connection bị giữ từ đầu đến cuối request — pool exhaustion. (2) N+1 queries xảy ra âm thầm trong view. (3) Logic DB leak sang tầng presentation. Spring Boot enable OSIV mặc định — tắt bằng \`spring.jpa.open-in-view=false\`, dùng DTO/projection thay thế.` },
  { q: 'Khi nào bạn dùng @EntityGraph thay vì JPQL JOIN FETCH?',
    a: `**A:** \`@EntityGraph\` khi: (1) Muốn reuse đặc tả fetch plan mà không viết lại JPQL: đặt \`@EntityGraph\` trên nhiều repository method. (2) Muốn fetch theo attribute path phức tạp (nested): \`attributePaths={"orders.items"}\`. (3) Spring Data JPA method query không thể viết JOIN FETCH. **JOIN FETCH** khi: (1) Query có WHERE condition phức tạp cần tùy chỉnh. (2) Cần \`DISTINCT\` để tránh row duplication trong 1-to-many. (3) Kiểm soát fetch type per query một cách explicit.` },
]),

'locking': qa([
  { q: 'Sự khác biệt giữa optimistic và pessimistic locking là gì?',
    a: `**A:** **Optimistic locking**: assume conflict ít xảy ra — không lock khi đọc, check version khi write; nếu version không khớp → throw exception, client retry. Không có lock overhead, phù hợp read-heavy. **Pessimistic locking**: assume conflict xảy ra — lock row khi đọc (\`SELECT FOR UPDATE\`), hold lock đến commit/rollback. Đảm bảo không bị concurrent modify, phù hợp write-heavy. Optimistic: tốt cho low-contention scenario; Pessimistic: tốt cho high-contention critical section.` },
  { q: 'Deadlock trong DB có thể xảy ra khi nào và DB giải quyết thế nào?',
    a: `**A:** Deadlock: Transaction A lock row 1, chờ row 2; Transaction B lock row 2, chờ row 1 — circular wait. DB detect bằng **wait-for graph** — khi phát hiện cycle → chọn một transaction làm victim (thường transaction nhẹ hơn), abort nó với error code. Application phải catch \`DeadlockLoserDataAccessException\` và retry. Phòng tránh: luôn lock theo thứ tự cố định (always lock row A trước B trong cả hai transaction); giữ transaction ngắn; index đúng để lock range nhỏ hơn.` },
  { q: '@Version implement optimistic locking trong JPA thế nào?',
    a: `**A:** \`@Version\` field (int/long/Timestamp) được Hibernate tự quản lý: mỗi UPDATE increment version. Khi update, Hibernate check: \`UPDATE ... WHERE id=? AND version=?\`; nếu 0 rows affected (version không khớp — concurrent update) → throw \`OptimisticLockException\`. Client nhận lỗi → đọc lại entity (mới nhất) → reapply change → retry. Spring Data \`save()\` tự động dùng \`@Version\` nếu có. Không cần explicit lock, không có DB lock overhead.` },
]),

'mapper-xml-mapping': qa([
  { q: 'Rủi ro khi dùng ${} thay vì #{} trong MyBatis?',
    a: `**A:** \`#{}\` → PreparedStatement parameter: giá trị được escape, ngăn **SQL injection**. \`\${}\` → string substitution trực tiếp vào SQL — **SQL injection vulnerability**: nếu user input, attacker có thể inject SQL. Dùng \`\${}\` chỉ cho column name hoặc table name trong dynamic SQL (không phải giá trị user input): \`ORDER BY \${columnName}\` với column name whitelist validate. Không bao giờ dùng \`\${}\` cho user-controlled input.` },
  { q: 'Lấy primary key tự sinh sau INSERT thế nào?',
    a: `**A:** Trong MyBatis XML:\n\`\`\`xml\n<insert id="insert" useGeneratedKeys="true" keyProperty="id">\n  INSERT INTO users (name, email) VALUES (#{name}, #{email})\n</insert>\n\`\`\`\n\`useGeneratedKeys="true"\`: dùng JDBC getGeneratedKeys(). \`keyProperty="id"\`: set generated key vào field \`id\` của parameter object. Sau gọi \`mapper.insert(user)\`, \`user.getId()\` có giá trị mới. Cho DB không support getGeneratedKeys: dùng \`<selectKey>\` tag với \`keyOrder="AFTER"\`.` },
  { q: 'Namespace trong XML mapper file liên hệ với Mapper interface thế nào?',
    a: `**A:** Namespace trong \`<mapper namespace="com.example.UserMapper">\` phải **khớp chính xác** với fully-qualified name của Mapper interface. MyBatis scan interface methods và lookup tương ứng trong namespace: method \`UserMapper.findById(Long)\` → lookup \`<select id="findById">\` trong namespace \`com.example.UserMapper\`. Mismatch namespace → \`BindingException\`. Annotation \`@Mapper\` hoặc \`MapperScan\` để MyBatis detect interface tự động.` },
]),

'metaspace': qa([
  { q: 'Sự khác biệt giữa PermGen và Metaspace là gì?',
    a: `**A:** **PermGen** (Java 7-): cố định size trong heap (default 64-256MB), lưu class metadata, static data, interned strings. Dễ gây \`OutOfMemoryError: PermGen space\`. **Metaspace** (Java 8+): native memory thay vì heap — size chỉ giới hạn bởi system memory (hoặc \`-XX:MaxMetaspaceSize\`). Class metadata vẫn ở đây; interned strings chuyển sang heap. Không còn PermGen OOM vì config; nhưng nếu không set MaxMetaspaceSize, có thể dùng hết native memory.` },
  { q: 'Nguyên nhân nào gây ra OutOfMemoryError: Metaspace?',
    a: `**A:** (1) **Class loader leak**: ClassLoader không được GC (vẫn có strong reference) → tất cả class nó load vẫn trong Metaspace. Thường xảy ra với framework dynamic class generation (CGLIB, reflection heavy code). (2) **Dynamic class generation không kiểm soát**: Groovy, CGLIB, ByteBuddy tạo quá nhiều class. (3) **MaxMetaspaceSize quá nhỏ** cho ứng dụng thực sự cần nhiều class. Debug: \`jcmd <pid> VM.class_stats | sort -k2 -rn\` để xem class count.` },
  { q: 'Spring AOP ảnh hưởng đến Metaspace như thế nào?',
    a: `**A:** Spring AOP tạo **CGLIB proxy** cho mỗi bean cần proxy (\`@Transactional\`, \`@Cacheable\`, \`@Async\`, custom aspect). Mỗi proxy là một class mới trong Metaspace. Với ứng dụng lớn (500+ bean được proxy), Metaspace usage tăng đáng kể. JDK proxy (chỉ cho interface) nhẹ hơn CGLIB (generate subclass). \`proxyTargetClass=false\` prefer JDK proxy khi có thể. Theo dõi: \`/actuator/metrics/jvm.memory.used?tag=area:nonheap\`.` },
]),

'mocking': qa([
  { q: 'Sự khác biệt giữa mock, stub và spy?',
    a: `**A:** **Stub**: trả về giá trị cố định, không verify interaction. **Mock**: verify interaction — kiểm tra method có được gọi không, với argument nào, bao nhiêu lần. **Spy**: wrap real object, gọi real method mặc định, override một số method. Mockito: \`mock()\` tạo mock (tất cả method trả về default). \`spy()\` wrap real object. Stub ≈ mock trong Mockito (dùng mock nhưng chỉ setup return, không verify = functionally stub).` },
  { q: 'Khi nào KHÔNG nên mock?',
    a: `**A:** (1) **Simple value object/POJO**: không cần mock \`User\`, \`Order\` — tạo instance thực. (2) **Third-party library infrastructure**: mock \`HttpClient\`, \`JdbcTemplate\` che giấu behavior thực — dùng WireMock, TestContainers thay thế. (3) **Class đang test**: mock the class under test = không test gì cả. (4) **Tất cả dependency**: over-mocking tạo test chỉ verify mock behavior, không verify real integration. Rule: mock external dependencies, không mock value/domain object.` },
  { q: 'ArgumentCaptor dùng để làm gì?',
    a: `**A:** \`ArgumentCaptor\` capture argument được pass vào mock method để inspect sau:\n\`\`\`java\nArgumentCaptor<EmailRequest> captor = ArgumentCaptor.forClass(EmailRequest.class);\nverify(emailService).send(captor.capture());\nEmailRequest captured = captor.getValue();\nassertEquals("user@example.com", captured.getTo());\n\`\`\`\nHữu ích khi argument là object được tạo trong method (không accessible từ test). Thay thế: \`ArgumentMatchers.argThat()\` nếu chỉ cần check condition, không cần toàn bộ object.` },
]),

'mockito-mock-spy-captor': qa([
  { q: 'Sự khác biệt giữa spy() và mock()?',
    a: `**A:** \`mock()\`: tạo object giả — tất cả method return default value (null, 0, false, empty list). Không gọi real method. \`spy()\`: wrap **real object** — method không override thì gọi real implementation; có thể stub một số method để override. Ví dụ: \`spy\` trên \`ArrayList\` → \`add()\`, \`size()\` dùng real ArrayList behavior; chỉ stub \`isEmpty()\` để return false. Dùng spy khi cần test real behavior nhưng override một vài method cụ thể.` },
  { q: 'Tại sao dùng doReturn() thay vì when().thenReturn() với spy?',
    a: `**A:** Với \`spy\`, \`when(spy.method())\` **gọi real method** trước khi stub — nếu real method ném exception hoặc có side effect, test fail. \`doReturn().when(spy).method()\` **không gọi real method** — an toàn hơn với spy. Ví dụ: \`when(spyList.get(0))\` throws \`IndexOutOfBoundsException\` nếu list empty; \`doReturn("value").when(spyList).get(0)\` không gọi real \`get()\`. Rule: với spy, prefer \`doReturn/doThrow/doAnswer\`.` },
  { q: '@InjectMocks inject mock thế nào?',
    a: `**A:** \`@InjectMocks\` tạo instance của class đang test và inject \`@Mock\`/\`@Spy\` field vào nó. Mockito thử inject theo thứ tự: (1) **Constructor injection**: tìm constructor nhận nhiều mock nhất. (2) **Setter injection**: gọi setter method. (3) **Field injection**: set field trực tiếp bằng reflection. Nếu inject fail: Mockito silent (không throw), field có thể null → NullPointerException trong test. Require \`@ExtendWith(MockitoExtension.class)\` hoặc \`MockitoAnnotations.openMocks(this)\`.` },
]),

'mongodb': qa([
  { q: 'Khi nào bạn embed vs reference document trong MongoDB?',
    a: `**A:** **Embed** (sub-document): khi data thường được truy cập cùng nhau, data ít thay đổi, quan hệ 1-1 hoặc 1-ít. Ví dụ: address trong user, items trong order. Ưu điểm: single read, atomic update. **Reference** (DBRef/manual): khi data được reuse bởi nhiều document, data lớn, quan hệ many-to-many, hoặc sub-document thay đổi thường xuyên. Ví dụ: user reference trong comment (user thông tin cần update một nơi). MongoDB không enforce referential integrity — phải handle trong app.` },
  { q: 'MongoDB aggregation pipeline là gì?',
    a: `**A:** Pipeline là chuỗi **stage** xử lý document tuần tự: \`\$match\` (filter), \`\$group\` (aggregate), \`\$sort\`, \`\$project\` (reshape), \`\$lookup\` (join), \`\$unwind\` (flatten array), \`\$limit\`, \`\$skip\`. Ví dụ: \`[\{$match: {status:"A"}\}, {\$group: {_id:"\$city", total:{$sum:"\$amount"}}}, {\$sort: {total:-1}}]\` → sum amount by city cho active records. Mạnh hơn find() cho analytics — chạy trên server, không transfer raw data về client.` },
  { q: 'MongoDB xử lý transaction thế nào?',
    a: `**A:** MongoDB 4.0+ hỗ trợ **multi-document ACID transaction** (trước đó chỉ single-document atomic). Cú pháp tương tự: \`session.startTransaction()\` → operation → \`session.commitTransaction()\`. Giới hạn: chỉ trong replica set hoặc sharded cluster; transaction duration tối đa 60s mặc định; overhead đáng kể — tránh transaction dài. Best practice: thiết kế schema để tận dụng single-document atomicity trước (embed); dùng multi-document transaction chỉ khi thực sự cần.` },
]),

'monitoring': qa([
  { q: 'Ba trụ cột của observability là gì?',
    a: `**A:** (1) **Metrics**: số đo định lượng theo thời gian — RPS, latency p99, error rate, CPU, memory. Prometheus + Grafana. Câu hỏi: "Hệ thống đang hoạt động thế nào?" (2) **Logs**: sự kiện text có timestamp và context — request log, error log, audit. ELK stack, Loki. Câu hỏi: "Chuyện gì đã xảy ra?" (3) **Traces**: theo dõi request qua nhiều service — thấy latency của từng step. Jaeger, Zipkin, Tempo. Câu hỏi: "Chậm ở đâu?" Ba trụ cột bổ sung nhau: metrics alert, logs explain, traces locate.` },
  { q: 'Bốn Golden Signal của Google là gì?',
    a: `**A:** (1) **Latency**: thời gian xử lý request — cả thành công lẫn lỗi. (2) **Traffic**: load của hệ thống — RPS, message/s. (3) **Errors**: tỷ lệ request fail — 5xx rate, exception rate. (4) **Saturation**: mức độ "đầy" của resource — CPU%, memory%, thread pool queue depth, disk I/O. Nếu chỉ monitor 4 metric này, bạn đã có coverage tốt cho hầu hết incident. Dashboard chuẩn: latency histogram (p50/p95/p99), error rate %, RPS, CPU/memory.` },
  { q: 'Micrometer tích hợp với Prometheus thế nào?',
    a: `**A:** Micrometer là **metrics facade** — abstract layer giống SLF4J cho logging. Spring Boot Actuator dùng Micrometer để collect metrics. Thêm \`micrometer-registry-prometheus\` dependency → Micrometer export metrics theo format Prometheus. Endpoint \`/actuator/prometheus\` expose tất cả metrics dạng text. Prometheus cấu hình scrape endpoint này theo interval (15s). Grafana query Prometheus để visualize. Custom metric: \`Counter.builder("order.created").tag("status", "success").register(meterRegistry).increment()\`.` },
]),


'mybatis': qa([
  { q: '#{} và ${} trong MyBatis khác nhau thế nào?',
    a: `**A:** \`#{param}\` → PreparedStatement parameter (\`?\`) — JDBC escape, an toàn SQL injection. \`\${param}\` → string substitution trực tiếp vào SQL — nguy hiểm SQL injection với user input. Dùng \`\${}\` chỉ cho column name/table name (dynamic SQL với whitelist validate): \`ORDER BY \${column}\`. Ví dụ: \`WHERE id = #{userId}\` (safe) vs \`WHERE \${field} = #{value}\` (unsafe nếu field là user input).` },
  { q: 'MyBatis ngăn SQL injection thế nào so với nối chuỗi?',
    a: `**A:** String concatenation: \`"SELECT * FROM users WHERE id = " + userId\` — attacker inject \`1 OR 1=1\` → trả về tất cả user. MyBatis với \`#{userId}\`: generate \`SELECT * FROM users WHERE id = ?\` và bind parameter qua JDBC PreparedStatement — DB xử lý giá trị là data, không phải SQL syntax. PreparedStatement cũng có performance benefit: DB cache execution plan cho parameterized query.` },
  { q: 'Khi nào chọn MyBatis thay vì JPA/Hibernate?',
    a: `**A:** Chọn **MyBatis** khi: (1) Cần kiểm soát SQL hoàn toàn — complex query, stored procedure, DB-specific optimization. (2) Legacy DB với schema không phù hợp ORM convention. (3) DBA viết SQL, Java dev mapping kết quả. (4) Report/analytics query phức tạp. Chọn **JPA/Hibernate** khi: domain model phức tạp với nhiều quan hệ, muốn tự động dirty checking, cần database-agnostic code, team quen với ORM pattern. Kết hợp cả hai trong cùng project là valid.` },
]),

'mybatis-vs-jpa': qa([
  { q: 'N+1 query trong JPA do đâu và fix thế nào?',
    a: `**A:** N+1: load 1 parent entity list (1 query), rồi access LAZY collection của từng entity → N queries. Ví dụ: 100 Order → access \`order.getItems()\` mỗi cái → 100 thêm query = 101 total. Fix: (1) **JOIN FETCH**: \`SELECT o FROM Order o JOIN FETCH o.items\`. (2) **@EntityGraph**: \`@EntityGraph(attributePaths="items")\` trên repository method. (3) **Batch fetching**: \`@BatchSize(size=20)\` — load items của 20 order một lần. (4) **DTO projection** với constructor query.` },
  { q: 'Dùng cả MyBatis và Spring Data JPA trong cùng Spring Boot project được không?',
    a: `**A:** **Có** — hoàn toàn valid. Config hai DataSource hoặc một DataSource với hai transaction manager (chú ý transaction boundary). MyBatis Mapper bean và JPA Repository bean tồn tại song song. Use case: JPA cho domain entity CRUD; MyBatis cho complex report query hoặc batch operation. Dependency: \`mybatis-spring-boot-starter\` và \`spring-boot-starter-data-jpa\` cùng trong pom.xml. Chỉ cần đảm bảo \`@Primary\` transaction manager đúng.` },
  { q: 'Khi nào recommend MyBatis cho project mới?',
    a: `**A:** Recommend MyBatis cho project mới khi: (1) **SQL-first team**: DBA/BA viết SQL, dev binding kết quả; SQL là source of truth. (2) **Financial system**: audit requirement — muốn thấy chính xác SQL nào chạy. (3) **Complex reporting**: window function, CTE, DB-specific feature không support tốt trong JPQL. (4) **Performance-critical**: cần fine-tune từng query, không muốn JPA query generation overhead. Không recommend khi: team nhỏ, schema sạch, muốn rapid CRUD development.` },
]),

'mysql-deep-dive': qa([
  { q: 'Clustered index là gì và InnoDB implement thế nào?',
    a: `**A:** Clustered index: table data được **sắp xếp vật lý** theo index key — một table chỉ có một clustered index. **InnoDB**: tự động dùng **Primary Key** làm clustered index; table data pages chứa actual row data được tổ chức theo PK order. Nếu không có PK → dùng UNIQUE NOT NULL; nếu cũng không có → tạo hidden 6-byte row ID. Hệ quả: secondary index leaf node chứa PK value (không phải row pointer) → secondary index lookup phải đọc clustered index (two-lookup).` },
  { q: 'type=ALL trong EXPLAIN có nghĩa gì?',
    a: `**A:** \`type=ALL\` là **full table scan** — đọc tất cả row trong table. Thường là dấu hiệu missing index. EXPLAIN type từ tốt đến xấu: \`system > const > eq_ref > ref > range > index > ALL\`. \`type=ALL\` acceptable khi: table nhỏ (<1000 rows), không có selective WHERE condition. Cần fix khi: table lớn, query chậm. Kiểm tra \`Extra\` column: "Using where" = filter sau full scan; "Using filesort" = sort không dùng index.` },
  { q: 'Tune HikariCP pool size thế nào?',
    a: `**A:** Công thức HikariCP: \`pool_size = Tn × (Cm - 1) + 1\` (Tn = max threads, Cm = max concurrent query per thread) nhưng thực tế đơn giản hơn. Rule: \`maximumPoolSize = (CPU cores × 2) + disk_spindle\` (PostgreSQL recommendation). Thực chiến: bắt đầu nhỏ (10-20), monitor \`hikaricp.pending.threads\` — nếu luôn > 0 → tăng pool. Tăng pool không phải lúc nào cũng giúp: nếu DB là bottleneck, thêm connection chỉ thêm contention. Tối ưu query trước.` },
]),

'network-logs': qa([
  { q: 'Kiểm tra process nào đang dùng port 8080 thế nào?',
    a: `**A:** \`lsof -i :8080\` → hiện PID, command, user đang dùng port. Hoặc \`ss -tlnp | grep 8080\` (Linux, cần \`ss\` thay \`netstat\`). Hoặc \`netstat -tulpn | grep 8080\` (cũ hơn). Trên macOS: \`lsof -nP -iTCP:8080\`. Sau khi có PID: \`kill <PID>\` để dừng, hoặc \`ps aux | grep <PID>\` để xem chi tiết process. Trong Docker: \`docker ps\` để xem container nào expose port.` },
  { q: 'Nhiều TIME_WAIT connection trong ss -s cho thấy gì?',
    a: `**A:** **TIME_WAIT**: sau khi connection đóng, OS giữ 2×MSL (Maximum Segment Lifetime, thường 60s) để ensure delayed packet không làm confused connection mới. Nhiều TIME_WAIT (hàng nghìn): (1) **Bình thường** nếu xử lý nhiều short-lived connection (HTTP/1.1 without keep-alive). (2) **Vấn đề** nếu gần exhausting local port range (65K ports). Fix: \`net.ipv4.tcp_tw_reuse=1\` (Linux) cho phép reuse TIME_WAIT socket; dùng HTTP keep-alive; tăng local port range \`net.ipv4.ip_local_port_range=1024 65535\`.` },
  { q: 'Xem live log nhưng chỉ filter dòng ERROR thế nào?',
    a: `**A:** \`tail -f app.log | grep ERROR\` — stream log, filter realtime. Tốt hơn với \`grep --line-buffered\` tránh buffering issue. Nếu dùng journald: \`journalctl -f -u myapp | grep ERROR\`. Với kubectl: \`kubectl logs -f deployment/myapp | grep ERROR\`. Highlight thêm: \`tail -f app.log | grep --color=always -E "ERROR|WARN|"\`. Nếu muốn context xung quanh error: \`tail -f app.log | grep -A 5 ERROR\` (5 dòng sau).` },
]),

'networking-volumes': qa([
  { q: 'Sự khác biệt giữa Docker volume và bind mount là gì?',
    a: `**A:** **Docker volume**: managed bởi Docker daemon (\`/var/lib/docker/volumes/\`), portable, tối ưu cho performance, không phụ thuộc OS path, dễ backup và migrate. **Bind mount**: map trực tiếp host directory/file vào container — phụ thuộc host path, không portable, nhưng hữu ích trong dev (live reload code). Production: dùng **named volume** (\`docker volume create mydata\`). Development: bind mount source code vào container để hot reload. Volume persist khi container xóa; bind mount không quản lý bởi Docker.` },
  { q: 'Container trên cùng Docker network giao tiếp thế nào?',
    a: `**A:** Container trong cùng **user-defined network** (bridge hoặc overlay) có thể communicate qua **container name** làm hostname. Docker DNS tự resolve. \`docker network create mynet\` → \`docker run --network mynet --name db postgres\` → container app gọi \`db:5432\`. Default bridge network không hỗ trợ DNS (dùng IP thay thế). Docker Compose tự tạo network cho mỗi project: tất cả service trong compose file trong cùng network, gọi nhau bằng service name.` },
  { q: 'Điều gì xảy ra với dữ liệu trong container khi container bị xóa?',
    a: `**A:** Dữ liệu ghi vào **writable container layer** bị xóa vĩnh viễn khi container bị remove (\`docker rm\`). Dữ liệu ghi vào **volume** (mounted) được preserve — volume tồn tại độc lập với container lifecycle. Dữ liệu ghi vào **bind mount** (host path) được preserve trên host. Quy tắc: DB data, user upload, log cần persist phải dùng volume. Stop container (\`docker stop\`) không xóa data; Remove (\`docker rm\`) mới xóa container layer.` },
]),

'nio-2-path-files': qa([
  { q: 'Khác nhau giữa Files.readAllLines() và Files.lines()?',
    a: `**A:** **\`Files.readAllLines()\`**: đọc toàn bộ file vào \`List<String>\` trong memory — đơn giản nhưng tốn RAM cho file lớn. **\`Files.lines()\`**: trả về **lazy Stream<String>** — đọc từng dòng khi cần (streaming), phù hợp file lớn không fit RAM. Quan trọng: \`Files.lines()\` mở file resource — phải dùng trong try-with-resources hoặc \`Stream.close()\` để tránh resource leak:\n\`\`\`java\ntry (Stream<String> lines = Files.lines(path)) {\n    lines.filter(l -> l.contains("ERROR")).forEach(System.out::println);\n}\n\`\`\`` },
  { q: 'Xử lý file log 10 GB không bị OutOfMemoryError thế nào?',
    a: `**A:** Dùng **streaming approach** — không load cả file vào memory:\n\`\`\`java\ntry (Stream<String> lines = Files.lines(Paths.get("app.log"))) {\n    lines.filter(l -> l.contains("ERROR"))\n         .limit(1000)\n         .forEach(System.out::println);\n}\n\`\`\`\nHoặc dùng \`BufferedReader\` với \`readLine()\` trong loop. NIO2 \`Files.newBufferedReader()\` auto-detects charset. Avoid: \`Files.readAllBytes()\`, \`Files.readAllLines()\` — load toàn bộ vào heap. Nếu cần aggregate: dùng Stream reduce/collect với accumulator.` },
  { q: 'WatchService dùng để làm gì trong Java?',
    a: `**A:** \`WatchService\` monitor **filesystem events** (create, modify, delete) trên directory mà không cần polling. Dùng cho: config file hot reload, file upload trigger, build tool watch mode. Pattern:\n\`\`\`java\nWatchService watcher = FileSystems.getDefault().newWatchService();\npath.register(watcher, ENTRY_MODIFY, ENTRY_CREATE);\nWatchKey key;\nwhile ((key = watcher.take()) != null) {\n    key.pollEvents().forEach(e -> handleEvent(e.context()));\n    key.reset();\n}\n\`\`\`\nNative OS notification (inotify Linux, FSEvents Mac) — hiệu quả hơn polling.` },
]),

'nio-non-blocking': qa([
  { q: 'ByteBuffer.flip() có vai trò gì?',
    a: `**A:** ByteBuffer có hai mode: **write mode** (sau \`clear()\`: position=0, limit=capacity — dùng để write data vào) và **read mode** (sau \`flip()\`: limit=current_position, position=0 — dùng để read data đã write). \`flip()\` chuyển từ write sang read mode: đặt limit tại vị trí write dừng, reset position về 0. Không gọi \`flip()\` trước read → đọc từ position hiện tại đến capacity → có thể đọc garbage. Sau đọc xong: \`compact()\` (keep unread) hoặc \`clear()\` (reset) để quay về write mode.` },
  { q: 'Selector cho phép một thread xử lý hàng nghìn kết nối thế nào?',
    a: `**A:** Thay vì thread-per-connection (blocking), Selector model: (1) Register nhiều \`SocketChannel\` với một \`Selector\` kèm interest ops (OP_READ, OP_WRITE). (2) Một thread gọi \`selector.select()\` — block cho đến khi ít nhất một channel ready. (3) Iterate qua \`selectedKeys()\`, xử lý từng ready channel (đọc/ghi non-blocking). (4) Quay lại \`select()\`. OS dùng \`epoll\` (Linux) để notify efficiently — không scan tất cả connection mỗi lần. Nền tảng của Netty event loop.` },
  { q: 'Zero-copy là gì và FileChannel.transferTo() dùng nó thế nào?',
    a: `**A:** Normal file send: disk → kernel buffer → user space buffer → kernel socket buffer → network. **Zero-copy**: disk → kernel buffer → socket buffer — skip user space copy. \`FileChannel.transferTo(position, count, socketChannel)\` dùng OS \`sendfile()\` syscall: data không đi qua user space → giảm CPU copy, giảm context switch, tốc độ cao hơn nhiều cho file transfer. Dùng trong: static file server, file streaming. Kafka dùng zero-copy cho consumer fetch — đây là lý do Kafka có throughput cao.` },
]),

'nosql': qa([
  { q: 'Khi nào bạn chọn MongoDB thay vì PostgreSQL?',
    a: `**A:** Chọn **MongoDB** khi: (1) Schema thay đổi thường xuyên, không muốn migration. (2) Data là hierarchical JSON tự nhiên (document fits domain model). (3) Cần horizontal scale writes (sharding). (4) Read pattern là load whole document. Chọn **PostgreSQL** khi: (1) ACID transaction nhiều table. (2) Complex JOIN. (3) Strong consistency bắt buộc. (4) SQL là chuẩn của team. MongoDB 4.0+ có transaction nhưng overhead cao hơn PostgreSQL. PostgreSQL jsonb cũng support semi-structured data — không nhất thiết phải dùng Mongo.` },
  { q: 'BASE có nghĩa gì trong ngữ cảnh NoSQL?',
    a: `**A:** **B**asically Available: system luôn available, dù có thể trả về stale/partial data khi partition. **S**oft state: system state có thể thay đổi theo thời gian kể cả không có input mới — do replication propagation. **E**ventually consistent: sau khoảng thời gian không có update mới, tất cả replica sẽ hội tụ về cùng giá trị. BASE là trade-off để đạt được high availability và partition tolerance (AP trong CAP). NoSQL theo BASE: Cassandra, DynamoDB, Couchbase.` },
  { q: 'Cassandra đạt write throughput cao thế nào?',
    a: `**A:** Cassandra write path: (1) Write vào **commit log** (sequential disk write — nhanh). (2) Write vào in-memory **MemTable**. (3) Ack client ngay — không cần block chờ disk. (4) Khi MemTable đầy → flush xuống **SSTable** (immutable file). Background: **compaction** merge SSTable. Đặc điểm: (1) Sequential write (không random write) → disk I/O hiệu quả. (2) **Masterless** (peer-to-peer): write đến bất kỳ node nào → no write bottleneck. (3) Multi-datacenter replication. Kết quả: hàng triệu write/s linear scalable.` },
]),

'oc-explain-plan': qa([
  { q: 'type=ALL trong EXPLAIN có nghĩa gì?',
    a: `**A:** \`type=ALL\` = **full table scan** — MySQL đọc tất cả row trong table. Thường do: không có index phù hợp, WHERE condition không selective, query quá rộng. Xem cột \`rows\`: ước tính số row được scan — 10 triệu row × ALL = rất chậm. Fix: kiểm tra \`key\` column (null = không dùng index), thêm index cho WHERE columns, check nếu function wrap column cản trở index: \`WHERE YEAR(created_at)=2024\` → index không dùng được; sửa: \`WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31'\`.` },
  { q: 'Covering index là gì và verify thế nào trong EXPLAIN?',
    a: `**A:** Covering index: index chứa tất cả column cần thiết (WHERE + SELECT + ORDER BY) — không cần access table. Verify trong EXPLAIN: \`Extra\` column hiện \`Using index\` (MySQL) hoặc \`Index Only Scan\` (PostgreSQL) thay vì \`Using where\` + table lookup. Ví dụ: query \`SELECT name FROM users WHERE email=?\` với index \`(email, name)\` → covering index; nếu index chỉ có \`(email)\` → phải fetch \`name\` từ table (\`Using where\`).` },
  { q: 'Fix query có "Using filesort" trong Extra column thế nào?',
    a: `**A:** \`Using filesort\`: MySQL sort trong memory hoặc disk thay vì dùng index order — tốn kém. Fix: tạo index khớp ORDER BY clause. Ví dụ: \`ORDER BY created_at DESC\` → index \`(created_at)\`. Kết hợp WHERE + ORDER BY: \`WHERE user_id=? ORDER BY created_at\` → index \`(user_id, created_at)\`. Nếu query chọn ít row rồi sort: filesort có thể OK với ít data. Kết hợp với LIMIT: \`ORDER BY ... LIMIT 10\` với index sẽ không filesort toàn bộ result.` },
]),

'oop': qa([
  { q: 'Giải thích bốn trụ cột OOP kèm ví dụ từ codebase của bạn.',
    a: `**A:** (1) **Encapsulation**: ẩn internal state, expose qua method — \`private\` fields với getter/setter, validation trong setter. (2) **Inheritance**: reuse và extend — \`AdminUser extends User\`, Spring \`@Repository\` extends JPA pattern. (3) **Polymorphism**: cùng interface, behavior khác nhau — \`PaymentService.pay()\` với \`CreditCardPayment\` và \`PaypalPayment\` implementation. (4) **Abstraction**: hide complexity — \`OrderRepository\` interface ẩn JPA implementation, service chỉ biết repository interface.` },
  { q: 'Khi nào bạn chọn composition thay vì inheritance?',
    a: `**A:** **Composition** (has-a) thường tốt hơn **inheritance** (is-a) vì: (1) Linh hoạt hơn — swap behavior runtime bằng cách inject khác. (2) Tránh tight coupling với parent implementation — thay đổi parent không ảnh hưởng. (3) Tránh diamond problem và deep hierarchy. (4) Testable hơn — inject mock thay vì override. Inheritance hợp lý khi có "is-a" rõ ràng (không chỉ muốn reuse code) và subclass có thể thay thế parent (Liskov). Rule: "Favor composition over inheritance" (GoF principle).` },
  { q: 'Overloading và overriding khác nhau thế nào?',
    a: `**A:** **Overloading** (compile-time polymorphism): cùng class, cùng tên method, khác parameter type/count — compiler chọn version đúng dựa trên argument type lúc compile. **Overriding** (runtime polymorphism): subclass redefine method của parent với cùng signature — JVM chọn version dựa trên actual object type lúc runtime (\`invokevirtual\`). Overloading: \`log(String)\`, \`log(Exception)\`. Overriding: \`Animal.speak()\` được Dog override thành "Woof". \`@Override\` annotation giúp compiler kiểm tra overriding đúng không.` },
]),


'optimistic-pessimistic-locking': qa([
  { q: 'JPA ném exception nào khi xung đột optimistic lock?',
    a: `**A:** JPA ném \`javax.persistence.OptimisticLockException\` (hoặc \`jakarta.persistence.OptimisticLockException\` trong Jakarta EE). Spring Data JPA wrap thành \`ObjectOptimisticLockingFailureException\`. Hibernate ném \`StaleObjectStateException\` nếu version không khớp. Client cần catch và **retry**: đọc lại entity mới nhất → reapply thay đổi → save lại. Annotation \`@Retryable\` từ Spring Retry tự động retry khi gặp \`OptimisticLockingFailureException\`.` },
  { q: '@Version hoạt động nội bộ thế nào?',
    a: `**A:** Hibernate tự quản lý \`@Version\` field (int/long/Timestamp). Khi UPDATE entity: generate \`UPDATE entity SET ..., version=version+1 WHERE id=? AND version=?\`. Nếu 0 rows affected: version không khớp (concurrent update xảy ra) → throw \`OptimisticLockException\`. Khi đọc entity: load version vào snapshot. Khi INSERT: version=0 (hoặc 0L cho long). Lưu ý: chỉ so sánh version của **entity root**, không theo dõi version của collection item.` },
  { q: 'Khi nào pessimistic locking có thể gây deadlock?',
    a: `**A:** Deadlock xảy ra khi hai transaction lock theo **thứ tự ngược nhau**: T1 lock A → chờ B; T2 lock B → chờ A → circular wait. Ví dụ: T1 \`SELECT FOR UPDATE\` account A rồi B; T2 \`SELECT FOR UPDATE\` account B rồi A. Phòng tránh: (1) **Lock theo thứ tự cố định** — luôn lock account ID nhỏ trước lớn. (2) **Lock ít nhất có thể** — scope nhỏ nhất, transaction ngắn nhất. (3) **Lock timeout**: \`@Lock(PESSIMISTIC_WRITE)\` với timeout hint để không chờ mãi.` },
]),

'orchestration': qa([
  { q: 'Vai trò của orchestrator trong orchestration saga là gì?',
    a: `**A:** **Orchestrator** là central service điều phối các bước của saga: gọi từng service theo thứ tự, handle response, quyết định bước tiếp theo hoặc trigger compensating transaction khi fail. Orchestrator biết toàn bộ flow — là source of truth về trạng thái saga. Ví dụ: \`OrderOrchestrator\` → gọi PaymentService → nếu thành công gọi InventoryService → nếu fail gọi CancelPaymentService (compensating). Pattern: saga state machine trong orchestrator.` },
  { q: 'Temporal khác message queue cho saga orchestration thế nào?',
    a: `**A:** **Message queue** (RabbitMQ/Kafka): orchestrator gửi command, subscribe event — cần implement retry, timeout, state persistence manually. Code phức tạp khi saga có nhiều bước và compensating path. **Temporal.io**: workflow engine — code saga như sequential function nhưng durable (persist state tự động), built-in retry, timeout, compensation. Failure của worker process không mất state — Temporal replay lại workflow từ event history. Temporal đơn giản hóa saga orchestration code đáng kể.` },
  { q: 'Trade-off giữa orchestration và choreography là gì?',
    a: `**A:** **Orchestration**: central control, easy to debug (một nơi xem flow), easy to add step, risk single point of failure/coupling. **Choreography**: decentralized, services không biết nhau (loose coupling), không có single orchestrator, harder to debug (trace event qua nhiều service), harder to understand full flow. Chọn orchestration khi: complex flow với nhiều compensating path, cần visibility; choreography khi: simple few-step flow, muốn maximum decoupling giữa service.` },
]),

'ordering-guarantees': qa([
  { q: 'Kafka có thể đảm bảo thứ tự qua các partition không?',
    a: `**A:** **Không** — Kafka chỉ đảm bảo **thứ tự trong một partition**. Message trong partition P1 có thể được xử lý theo thứ tự; nhưng không có đảm bảo thứ tự *giữa* P1 và P2. Consumer group: mỗi partition được assign cho một consumer — thứ tự trong partition được giữ. Để đảm bảo thứ tự của một entity (user, order): route tất cả event của entity đó vào cùng partition bằng **message key** = entityId → same key → same partition → in-order.` },
  { q: 'Làm thế nào để đảm bảo tất cả event của một user được xử lý theo thứ tự?',
    a: `**A:** Set **message key = userId** khi produce vào Kafka. Kafka hash(key) % num_partitions → same userId luôn vào cùng partition → consumer xử lý in-order. Trong producer: \`ProducerRecord<>(topic, userId.toString(), eventData)\`. Consumer: một partition chỉ có một consumer (trong consumer group) → single-threaded processing trong partition → order đảm bảo. Cẩn thận: thêm partition → hash thay đổi → event của cùng user có thể vào partition khác trong thời gian transition.` },
  { q: 'Exactly-once semantics trong Kafka là gì và đạt được thế nào?',
    a: `**A:** **EOS** trong Kafka: mỗi message được xử lý đúng một lần end-to-end — không mất, không duplicate. Đạt được với: (1) **Idempotent producer** (\`enable.idempotence=true\`): dedup retry ở broker layer. (2) **Transactional API**: \`producer.beginTransaction() → produce → consumer.commitSync() → producer.commitTransaction()\`. Consumer với \`isolation.level=read_committed\`. Kafka Streams tự động EOS khi \`processing.guarantee=exactly_once_v2\`. Overhead: ~20% throughput reduction, latency tăng.` },
]),

'pact': qa([
  { q: 'Provider state trong Pact là gì?',
    a: `**A:** **Provider state**: precondition mà provider phải satisfy trước khi chạy verification — đảm bảo DB/service trong đúng trạng thái. Ví dụ trong pact: \`"given": "user 123 exists"\` → provider state handler tạo user 123 trong test DB trước khi verify. Provider side code:\n\`\`\`java\n@State("user 123 exists")\npublic void setupUser123() {\n    userRepository.save(new User(123L, "Alice"));\n}\n\`\`\`\nKhông có provider state → verification fail vì data chưa tồn tại.` },
  { q: 'can-i-deploy hoạt động thế nào?',
    a: `**A:** CLI tool: \`pact-broker can-i-deploy --pacticipant OrderService --version 2.1.0 --to production\` → query Pact Broker API, kiểm tra tất cả pact contract mà OrderService tham gia (consumer hoặc provider) đã được **verify thành công** với version tương ứng của counterpart. Nếu tất cả verified → exit 0 (deploy được). Nếu có contract chưa verified → exit 1 (không deploy). Tích hợp vào CD pipeline: block deploy nếu can-i-deploy fail.` },
  { q: 'Điều gì xảy ra khi provider thay đổi tên field API?',
    a: `**A:** Consumer pact contract có \`"name": "Alice"\` → provider đổi thành \`"fullName": "Alice"\`. Khi provider chạy verification → pact verification **fail**: expected field "name" không có trong response. Pact Broker ghi nhận failed verification. \`can-i-deploy\` của provider version mới → fail → provider không thể deploy. Flow đúng: (1) Thông báo consumer trước. (2) Consumer update pact (support cả "name" và "fullName" hoặc update expectation). (3) Publish pact mới. (4) Provider verify pact mới. (5) Deploy.` },
]),

'parameterized-tests': qa([
  { q: 'Khi nào dùng @MethodSource thay vì @CsvSource?',
    a: `**A:** **\`@CsvSource\`**: phù hợp data đơn giản (string, số, enum) inline trong annotation. **\`@MethodSource\`**: khi data phức tạp (object, collection, dynamically generated), muốn reuse data giữa nhiều test, cần logic tạo data. Ví dụ \`@MethodSource\`: test với \`User\` object không thể dùng CSV. Cú pháp: method trả về \`Stream<Arguments>\` và được đặt tên trong \`@MethodSource("provideTestCases")\`. Nếu method cùng class: \`@MethodSource("provideTestCases")\`; khác class: fully qualified method name.` },
  { q: 'Làm thế nào để đặt tên mô tả cho parameterized case?',
    a: `**A:** Dùng \`name\` attribute trong \`@ParameterizedTest\`:\n\`\`\`java\n@ParameterizedTest(name = "Input {0} should return {1}")\n@CsvSource({"1, odd", "2, even", "3, odd"})\nvoid testParity(int input, String expected) { ... }\n\`\`\`\nPlaceholders: \`{0}\`, \`{1}\`... cho arguments, \`{index}\` cho test index, \`{displayName}\` cho method name, \`{arguments}\` cho tất cả args joined. Custom name giúp đọc test report rõ ràng hơn thay vì default "[1] 1, odd".` },
  { q: 'Có thể parameterize với enum value không?',
    a: `**A:** Có — dùng \`@EnumSource\`:\n\`\`\`java\n@ParameterizedTest\n@EnumSource(Status.class)\nvoid testAllStatuses(Status status) {\n    assertNotNull(service.process(status));\n}\n\`\`\`\nTest chạy với tất cả enum values. Filter: \`@EnumSource(value=Status.class, names={"ACTIVE", "PENDING"})\` hoặc \`mode=EXCLUDE\`. Cũng có thể dùng \`@MethodSource\` trả về \`Arrays.stream(Status.values())\`.` },
]),

'performance-testing': qa([
  { q: 'Sự khác biệt giữa load test và stress test?',
    a: `**A:** **Load test**: test hệ thống tại **expected load** (hoặc vài lần expected) trong thời gian dài — verify behavior, latency, error rate tại normal + peak traffic. **Stress test**: tăng load **vượt capacity** cho đến khi hệ thống fail — tìm breaking point, behavior khi overload (graceful degradation hay crash). **Soak test**: load bình thường trong thời gian dài (24-72h) — phát hiện memory leak, resource exhaustion theo thời gian. **Spike test**: tăng load đột ngột — test autoscaler, circuit breaker.` },
  { q: 'Percentile nào (p50/p95/p99) quan trọng nhất cho user experience?',
    a: `**A:** **p99** quan trọng nhất vì: user experience bị chi phối bởi **slowest requests**. Nếu p99 = 5s, 1% user chờ 5s mỗi operation — với 10K user, 100 người chờ 5s. SLO thường dùng p99. **p50** (median): response time typical, không đại diện cho tail latency — median 100ms không nói lên được nếu p99 = 10s. **p95** balance giữa representative và outlier. Rule: alert trên p99 cho real user impact; p50 cho overall throughput health. "99th percentile is the 1% that matters most" (Jeff Atwood).` },
  { q: 'Làm thế nào để tích hợp performance test vào CI/CD?',
    a: `**A:** (1) Chạy lightweight load test (k6, Gatling) sau deploy lên staging environment. (2) Define **performance budget**: p95 latency < 500ms, error rate < 0.1%, RPS > 100. (3) CI pipeline fail nếu budget vi phạm. (4) Chạy full stress test định kỳ (nightly, weekly) thay vì mỗi commit (quá tốn thời gian). (5) Trend tracking: so sánh với baseline previous run — alert khi regression > 20%. Tools: k6 Cloud, Gatling Enterprise, GitHub Actions với threshold check.` },
]),

'performance-tuning': qa([
  { q: 'Mô tả cách chẩn đoán CPU cao trong ứng dụng Java.',
    a: `**A:** (1) \`top -H -p <pid>\` — tìm thread dùng CPU nhiều nhất (TID). (2) Convert TID decimal → hex. (3) \`jstack <pid> | grep -A 30 "nid=0x<hex>"\` — xem stack trace của thread đó. Thường thấy: infinite loop, busy wait, CAS spin. (4) Async-profiler (\`./profiler.sh -e cpu -d 30 -f cpu.html <pid>\`) — flame graph trực quan. (5) Check GC: nếu GC thread ngốn CPU → heap full, memory leak. (6) JIT compilation: warm-up phase có thể có CPU spike.` },
  { q: 'Heap dump và thread dump khác nhau thế nào?',
    a: `**A:** **Heap dump**: snapshot toàn bộ **object trong memory** tại một thời điểm — phân tích memory leak, xem object nào chiếm nhiều heap. Tạo: \`jcmd <pid> GC.heap_dump filename.hprof\` hoặc \`-XX:+HeapDumpOnOutOfMemoryError\`. Phân tích: Eclipse MAT, VisualVM. **Thread dump**: snapshot tất cả **thread states và stack trace** — phân tích deadlock, thread block, CPU spike. Tạo: \`jstack <pid>\` hoặc \`kill -3\`. Phân tích: TDA, fastthread.io. Heap dump: memory issue; Thread dump: concurrency issue.` },
  { q: 'Làm sao xác định method nào đang ngốn CPU nhất?',
    a: `**A:** **Async-profiler** là tool tốt nhất: \`./profiler.sh -e cpu -d 30 -f cpu.html <pid>\` → generate **flame graph** — chiều rộng của block tương ứng % CPU time. Nhìn vào block rộng nhất ở top → method hotspot. Không cần restart app. Alternative: **JFR (Java Flight Recorder)** + JMC: \`jcmd <pid> JFR.start duration=60s filename=recording.jfr\` → open trong JMC → Method Profiling tab. Dùng sampling-based profiler (không instrumentation) để minimize overhead.` },
]),

'phan-tich-heap-dump': qa([
  { q: 'Shallow heap và retained heap khác nhau thế nào?',
    a: `**A:** **Shallow heap**: memory của chính object đó — chỉ tính các field trực tiếp, không tính objects nó reference. \`String\` object: ~48 bytes. **Retained heap**: tổng memory sẽ được giải phóng nếu object này bị GC — bao gồm tất cả object mà object này **giữ duy nhất** (transitively reachable và không có GC root khác). \`String[] strings\` có retained heap = shallow(array) + sum(shallow(string_i)). Trong Eclipse MAT: retained heap của object lớn hơn shallow → object đó là root của memory leak.` },
  { q: 'Tìm memory leak bằng Eclipse MAT thế nào?',
    a: `**A:** (1) **Leak Suspects Report**: MAT tự detect object chiếm >1% heap. (2) **Dominator Tree**: liệt kê object theo retained heap giảm dần — tìm object "unexpected large" ở top. (3) **OQL** (Object Query Language): \`SELECT * FROM java.util.HashMap WHERE this.size > 10000\` — tìm collection quá lớn. (4) **Unreachable objects**: object không còn reachable nhưng chưa GC — dấu hiệu soft/weak reference issue. (5) So sánh hai heap dump (trước và sau) bằng \`Histogram\` → tìm class count tăng liên tục.` },
  { q: 'Kể ba nguyên nhân memory leak phổ biến trong Java.',
    a: `**A:** (1) **ThreadLocal không gọi remove()**: ThreadLocal trong thread pool không được clear → giữ object lâu dài theo thread lifetime. (2) **Static collection tăng không giới hạn**: \`static Map cache = new HashMap()\` được add mà không remove — không bị GC. (3) **Listener/Observer không deregister**: đăng ký listener nhưng không remove khi object không còn cần → listener giữ reference → object không được GC. Thêm: ClassLoader leak trong hot deploy, inner class ẩn giữ reference đến outer class.` },
]),

'phan-tich-thread-dump': qa([
  { q: 'Tương quan thread OS CPU cao với Java stack trace thế nào?',
    a: `**A:** (1) \`top -H -p <java_pid>\` → thấy TID (Linux thread ID, decimal) ngốn CPU cao. (2) Convert decimal → hex: TID 12345 → 0x3039. (3) \`jstack <java_pid> | grep -B 1 "nid=0x3039" -A 30\` → tìm Java thread với \`nid=0x3039\` (native id). (4) Xem stack trace của thread đó — top frame là code đang chạy. Thường thấy: vòng lặp trong business logic, CAS spin loop, GC thread. Shortcut: \`kill -3 <pid>\` print thread dump vào stdout.` },
  { q: 'BLOCKED trong thread dump có nghĩa gì?',
    a: `**A:** Thread ở trạng thái **BLOCKED**: đang chờ **monitor lock** (synchronized block/method) đang bị giữ bởi thread khác. Thread dump hiện: \`- waiting to lock <0x12345> (a com.example.Foo)\` → lock object. Tìm thread đang giữ lock đó: \`- locked <0x12345>\`. Nhiều thread BLOCKED trên cùng lock → contention. Khác với WAITING (chờ condition/timeout không liên quan đến lock). BLOCKED + nhiều thread = potential deadlock hoặc lock contention bottleneck.` },
  { q: 'Xác nhận deadlock từ thread dump thế nào?',
    a: `**A:** Thread dump tự động detect deadlock và print ở cuối: \`Found one Java-level deadlock:\`. Xem manual: (1) Tìm tất cả thread BLOCKED. (2) Với mỗi thread, xem \`waiting to lock <addr>\`. (3) Tìm thread đang giữ \`<addr>\` đó (grep "locked <addr>"). (4) Check thread đó có đang chờ lock khác không. Nếu có cycle → deadlock. Ví dụ: Thread A giữ lock 1 chờ lock 2; Thread B giữ lock 2 chờ lock 1 → deadlock. Fix: lock theo thứ tự cố định.` },
]),

'pipeline-stages': qa([
  { q: 'Giai đoạn nào mọi CI/CD pipeline production cần có?',
    a: `**A:** Minimum stages: (1) **Build**: compile, package artifact. (2) **Unit test**: fast, isolated, fail fast. (3) **Static analysis**: lint, type check, security scan (Snyk, SonarQube). (4) **Integration test**: test với real dependency (DB, message queue). (5) **Docker build + push**: build và tag image. (6) **Deploy to staging**: auto deploy. (7) **Smoke test**: verify critical path hoạt động. (8) **Deploy to production**: manual gate hoặc auto. Optional: performance test, E2E test, contract test.` },
  { q: 'Làm thế nào để ngăn secret bị lộ trong CI log?',
    a: `**A:** (1) Dùng CI **secret management** (GitHub Secrets, GitLab CI Variables, Jenkins Credentials) — không hardcode trong yaml. (2) Secret được inject vào env var, CI mask giá trị trong log. (3) Không print env var trong script (\`printenv\`). (4) Dùng \`--quiet\` flag cho tools có thể log secrets. (5) Scan trước commit với **pre-commit hooks** (gitleaks, detect-secrets). (6) Không log request/response payload chứa credential. (7) Rotate secret thường xuyên — rủi ro leak giảm theo time window.` },
  { q: 'Quality gate là gì và làm thế nào để implement?',
    a: `**A:** **Quality gate**: tập hợp threshold phải pass trước khi artifact được promote (merge, deploy). Ví dụ: code coverage > 80%, 0 critical vulnerability (SonarQube), p95 latency < 500ms (performance test), contract test pass. Implement: (1) SonarQube Quality Gate: config threshold, tích hợp vào CI — fail build nếu gate không pass. (2) k6 threshold: \`thresholds: { http_req_duration: ["p(95)<500"] }\` → CI fail nếu vi phạm. (3) GitHub branch protection: require status check pass trước merge.` },
]),


'pod-deployment-service': qa([
  { q: 'Service ClusterIP, NodePort, và LoadBalancer khác nhau thế nào?',
    a: `**A:** **ClusterIP** (default): chỉ accessible trong cluster — internal service-to-service communication. **NodePort**: expose service trên port cố định của mỗi Node (30000-32767) — accessible từ ngoài cluster qua \`NodeIP:NodePort\`. **LoadBalancer**: tạo cloud load balancer (AWS ALB/NLB, GCP LB) tự động — expose service ra internet với stable external IP. Cho production: dùng LoadBalancer hoặc Ingress controller (nginx, traefik) + ClusterIP service. NodePort thường chỉ dùng dev/test.` },
  { q: 'Deployment rollback hoạt động thế nào trong Kubernetes?',
    a: `**A:** \`kubectl rollout undo deployment/my-app\` → rollback về revision trước. \`kubectl rollout undo deployment/my-app --to-revision=2\` → rollback về revision cụ thể. Kubernetes giữ rollout history (default 10 revisions) — mỗi \`kubectl apply\` với template thay đổi tạo revision mới. Xem history: \`kubectl rollout history deployment/my-app\`. Theo dõi status: \`kubectl rollout status deployment/my-app\`. Rollback tức thì — K8s apply revision cũ vào Deployment spec và tạo lại Pods theo rolling update strategy.` },
  { q: 'Pod lifecycle từ Pending đến Running là gì?',
    a: `**A:** (1) **Pending**: Pod được tạo, scheduler tìm Node phù hợp (resource, affinity, taint). (2) **Scheduled**: Node được chọn, kubelet được thông báo. (3) **ContainerCreating**: kubelet pull image (nếu chưa có), create container. (4) **Running**: tất cả container đang chạy. (5) **readinessProbe**: nếu configured, K8s chờ probe pass trước khi add Pod vào Service endpoints. **livenessProbe**: nếu fail → restart container. Pod bị stuck Pending: check \`kubectl describe pod\` → Events section — thường do không đủ resource, image pull error, hoặc PVC không bound.` },
]),

'polymorphism': qa([
  { q: 'Compile-time và runtime polymorphism khác nhau thế nào?',
    a: `**A:** **Compile-time (static) polymorphism**: method overloading — compiler chọn method dựa trên số lượng và type của tham số tại compile time. \`add(int, int)\` vs \`add(double, double)\`. **Runtime (dynamic) polymorphism**: method overriding — JVM chọn method implementation dựa trên actual type của object tại runtime. \`Animal a = new Dog(); a.speak()\` → gọi \`Dog.speak()\` không phải \`Animal.speak()\`. Cơ chế: virtual dispatch table (vtable). Từ khóa: \`@Override\`. Runtime polymorphism là core của OOP — code against interface, behavior varies by concrete type.` },
  { q: '@Override annotation có bắt buộc không?',
    a: `**A:** Không bắt buộc về mặt compile — code vẫn chạy đúng nếu không có \`@Override\`. Nhưng **nên luôn dùng** vì: (1) Compiler verify method thực sự override method ở parent — nếu typo tên method hoặc sai signature, compiler báo lỗi thay vì silently tạo method mới. (2) Readable: intent rõ ràng cho người đọc. (3) IDE support tốt hơn (refactoring, navigation). Ví dụ bug: \`public boolean equals(Object o)\` đúng, nhưng \`public boolean equals(MyClass o)\` (sai signature) không override \`Object.equals\` — không có \`@Override\` → bug silent.` },
  { q: 'Method hiding trong static method là gì?',
    a: `**A:** Static method không thể bị override — chỉ có thể bị **hidden**. \`class Parent { static void method() {...} }\`, \`class Child extends Parent { static void method() {...} }\` → \`Child.method()\` hide \`Parent.method()\`. Khác runtime polymorphism: \`Parent p = new Child(); p.method()\` → gọi \`Parent.method()\` (compile-time type quyết định). Với instance method: gọi \`Child.method()\`. Static method binding là **early binding** (compile time) — không có dynamic dispatch. \`@Override\` trên static method → compiler error trong Java.` },
]),

'producer-consumer': qa([
  { q: 'BlockingQueue giải quyết bài toán producer-consumer thế nào?',
    a: `**A:** \`BlockingQueue\` là thread-safe queue với blocking operations: \`put()\` block nếu queue full (chờ consumer lấy đi), \`take()\` block nếu queue empty (chờ producer thêm vào). Tự động handle synchronization, wait/notify — không cần code thủ công. Ví dụ:\n\`\`\`java\nBlockingQueue<Task> queue = new LinkedBlockingQueue<>(100);\n// Producer: queue.put(task); // block if full\n// Consumer: Task t = queue.take(); // block if empty\n\`\`\`\n\`ArrayBlockingQueue\`: bounded, fair option. \`LinkedBlockingQueue\`: optionally bounded. \`SynchronousQueue\`: capacity=0, transfer trực tiếp từ producer sang consumer.` },
  { q: 'Sự khác biệt giữa LinkedBlockingQueue và ArrayBlockingQueue?',
    a: `**A:** **\`LinkedBlockingQueue\`**: linked list structure, optionally bounded (default \`Integer.MAX_VALUE\` — effectively unbounded), hai lock riêng biệt cho put và take → higher throughput khi concurrent producer và consumer. **\`ArrayBlockingQueue\`**: array structure, **bounded** (phải specify capacity khi tạo), một lock cho cả put và take → lower throughput nhưng predictable memory. Fair ordering option trong ArrayBlockingQueue (FIFO per thread). Chọn: LinkedBlockingQueue khi throughput quan trọng; ArrayBlockingQueue khi muốn strict bound và fair ordering.` },
  { q: 'Làm thế nào để gracefully stop consumer thread?',
    a: `**A:** Pattern phổ biến: **poison pill** — producer put sentinel value đặc biệt vào queue khi muốn shutdown. Consumer kiểm tra: \`if (task == POISON_PILL) break;\`. Multiple consumers: put N poison pills (một per consumer). Alternative: dùng \`ExecutorService.shutdown()\` + \`awaitTermination()\` — nhưng cần consumer check \`Thread.currentThread().isInterrupted()\`. Với \`BlockingQueue.poll(timeout)\` thay vì \`take()\` → consumer có thể check interrupted flag định kỳ. Best practice: combine poison pill + interrupt handling để robust shutdown.` },
]),

'profiles': qa([
  { q: 'Spring Profiles hoạt động thế nào?',
    a: `**A:** Spring Profiles cho phép đăng ký bean và config khác nhau per environment. Activate: \`spring.profiles.active=prod\` trong properties, env var \`SPRING_PROFILES_ACTIVE=prod\`, hoặc \`-Dspring.profiles.active=prod\`. \`@Profile("dev")\` trên \`@Configuration\`/\`@Bean\` → bean chỉ được tạo khi profile đó active. \`application-prod.properties\` tự động load khi prod profile active — override \`application.properties\`. Có thể combine: \`spring.profiles.active=prod,monitoring\`. Trong test: \`@ActiveProfiles("test")\`.` },
  { q: '@ConditionalOnProperty và Profile khác nhau thế nào?',
    a: `**A:** **Profile**: activate/deactivate toàn bộ group config/bean cho một environment. Use case: dev vs prod behavior khác nhau. **\`@ConditionalOnProperty\`**: conditional bean registration dựa trên specific property value. Use case: feature flag, optional component. Ví dụ: \`@ConditionalOnProperty(name="feature.payment.enabled", havingValue="true")\` → PaymentService chỉ được tạo nếu property true — có thể dùng trong bất kỳ profile nào. Profile = coarse-grained environment switch; ConditionalOnProperty = fine-grained feature toggle.` },
  { q: 'Test application.properties ưu tiên thế nào so với main?',
    a: `**A:** Spring Boot load properties theo thứ tự ưu tiên (cao hơn override thấp hơn): (1) Command line args. (2) System properties. (3) \`application-{profile}.properties\` trong classpath. (4) \`application.properties\` trong classpath. Trong test: \`src/test/resources/application.properties\` override \`src/main/resources/application.properties\`. \`@TestPropertySource(properties={"key=val"})\` override tất cả. \`@SpringBootTest(properties={...})\` cũng override. Best practice: test profile với \`@ActiveProfiles("test")\` + \`application-test.properties\` trong \`src/test/resources\`.` },
]),

'prototype': qa([
  { q: 'Prototype pattern và copy constructor khác nhau thế nào?',
    a: `**A:** **Copy constructor**: constructor nhận instance cùng type để copy — \`new User(existingUser)\`. Coupling chặt với concrete class — người dùng phải biết concrete type. **Prototype pattern**: interface có \`clone()\` method — \`existingUser.clone()\` không cần biết concrete class. Cho phép client code làm việc với interface: \`Cloneable obj; obj.clone()\`. Java \`Cloneable\` interface + \`Object.clone()\` implement shallow copy; cần override để deep copy. Prototype hữu ích khi: nhiều concrete type, cần clone through interface reference, clone expensive object (copy thay vì re-initialize từ đầu).` },
  { q: 'Deep copy trong prototype thực hiện thế nào?',
    a: `**A:** Java \`Object.clone()\` là **shallow copy** — reference fields trỏ cùng object. Deep copy: (1) Override \`clone()\` và manually clone từng mutable field. (2) Serialization: serialize → deserialize tạo completely independent copy (chậm hơn). (3) Copy constructor chaining: mỗi class có copy constructor gọi copy constructor của field class. Ví dụ:\n\`\`\`java\n@Override\npublic User clone() {\n    User clone = (User) super.clone(); // shallow\n    clone.address = this.address.clone(); // deep copy Address\n    clone.roles = new ArrayList<>(this.roles); // deep copy list\n    return clone;\n}\n\`\`\`` },
  { q: 'Spring bean scope prototype thế nào?',
    a: `**A:** Spring \`@Scope("prototype")\` trên bean: mỗi lần \`getBean()\` hoặc \`@Autowired\` → Spring tạo **instance mới**. Khác singleton (default): singleton tạo một lần, reuse. Dùng khi: bean có mutable state, không thread-safe, cần isolated state per use. Cẩn thận: inject prototype bean vào singleton → prototype chỉ được inject **một lần** (tại singleton init time). Fix: dùng \`ObjectProvider<MyBean>\` hoặc implement \`ApplicationContextAware\` để getBean() mỗi lần cần. Prototype bean không được destroyed bởi Spring — caller tự manage lifecycle.` },
]),

'proxy': qa([
  { q: 'JDK dynamic proxy và CGLIB proxy khác nhau thế nào trong Spring AOP?',
    a: `**A:** **JDK dynamic proxy**: tạo proxy implement cùng **interface** — target class phải implement interface. Proxy intercept tất cả method call qua interface. **CGLIB**: tạo subclass của **target class** — không cần interface. Spring dùng CGLIB khi class không có interface. Cả hai dùng cho \`@Transactional\`, \`@Cacheable\`, \`@Async\`. Chú ý: final class/method không thể proxy bằng CGLIB (không subclass được). Spring Boot 2.x default CGLIB cho \`@Configuration\`, JDK proxy cho interface-based bean. \`spring.aop.proxy-target-class=true\` force CGLIB.` },
  { q: 'Self-invocation vấn đề gì với Spring AOP?',
    a: `**A:** Spring AOP proxy wrap bean từ bên ngoài — khi \`this.method()\` được gọi trong cùng class, bypass proxy → AOP advice không được apply. Ví dụ: \`@Transactional\` method A gọi \`this.methodB()\` (cũng \`@Transactional\`) → methodB không có transaction mới vì bypass proxy. Fix: (1) Inject bean vào chính nó (\`@Autowired MyService self\`) — gọi qua proxy. (2) Dùng \`AopContext.currentProxy()\`. (3) Refactor: extract methodB vào service khác. Đây là limitation của proxy-based AOP.` },
  { q: 'Proxy pattern dùng để làm gì ngoài Spring AOP?',
    a: `**A:** Proxy pattern có nhiều use case: (1) **Lazy initialization**: tạo object thực sự khi cần (expensive resource — DB connection, large object). (2) **Access control**: check permission trước khi delegate (protection proxy). (3) **Caching**: cache kết quả, không gọi real object nếu cached. (4) **Remote proxy**: đại diện cho object ở remote system (RPC stub). (5) **Logging/monitoring**: log mọi method call không cần modify original. (6) **Smart reference**: GC tracking, ref counting. Spring AOP, Hibernate lazy loading, Java RMI đều dùng proxy pattern.` },
]),

'rabbitmq': qa([
  { q: 'Exchange types trong RabbitMQ là gì?',
    a: `**A:** (1) **Direct**: route message theo routing key exact match — queue bind với binding key, message chỉ đến queue có binding key = routing key. (2) **Topic**: routing key là pattern (word.word) với wildcards \`*\` (một word) và \`#\` (zero hoặc nhiều word) — \`logs.*.error\` match \`logs.app.error\`. (3) **Fanout**: broadcast tất cả message đến mọi bound queue — ignore routing key. (4) **Headers**: route theo header attributes thay vì routing key. Dùng: Direct cho task queue, Fanout cho pub/sub, Topic cho flexible routing.` },
  { q: 'Đảm bảo message không bị mất trong RabbitMQ thế nào?',
    a: `**A:** Ba lớp bảo vệ: (1) **Publisher confirms**: \`channel.confirmSelect()\` → broker ack khi message được persist. (2) **Durable queue + persistent message**: queue với \`durable=true\` survive broker restart; message với \`deliveryMode=2\` (persistent). (3) **Consumer ack**: \`autoAck=false\` → consumer gọi \`channel.basicAck()\` sau khi xử lý xong — nếu consumer die trước khi ack, message requeue. Không ack → message không bị xóa khỏi queue. **Dead Letter Exchange (DLX)**: message không xử lý được → route đến DLX queue để analyze.` },
  { q: 'Prefetch count ảnh hưởng consumer thế nào?',
    a: `**A:** \`channel.basicQos(prefetchCount)\` — giới hạn số message broker gửi trước khi consumer ack. Mặc định: không giới hạn → broker dump tất cả message vào consumer buffer → một consumer chậm nhận hết message, consumer khác idle. **prefetchCount=1**: broker chỉ gửi message mới khi consumer ack message trước — fair dispatch. **prefetchCount=10**: cân bằng giữa throughput và fair dispatch. Với multiple consumer: \`basicQos(10)\` cả hai consumers → mỗi consumer max 10 unacked message, load được balance tốt hơn.` },
]),

'race-condition': qa([
  { q: 'Race condition là gì và cho ví dụ thực tế?',
    a: `**A:** **Race condition**: behavior của code phụ thuộc vào **thứ tự/timing** thực thi của các thread — kết quả không deterministic. Ví dụ: hai thread cùng đọc \`balance = 100\`, cùng cộng 50, cùng write → balance = 150 thay vì 200 (mất 50). Ví dụ khác: check-then-act: \`if (file.exists()) file.delete()\` — giữa check và delete, thread khác có thể tạo file mới. Ví dụ thực tế: ticket booking — hai user book last ticket cùng lúc → oversell. Phát hiện: khó reproduce vì timing-dependent; dùng tools như ThreadSanitizer, helgrind.` },
  { q: 'Atomic operation giải quyết race condition thế nào?',
    a: `**A:** \`AtomicInteger\`, \`AtomicLong\`, \`AtomicReference\` dùng **CAS (Compare-And-Swap)** hardware instruction — atomic ở CPU level, không cần lock. \`atomicInt.incrementAndGet()\` là atomic — không có race condition. CAS loop: đọc current value, compute new value, so sánh và swap — nếu current đã đổi (race), retry. Không block → no deadlock, high throughput. Nhưng: CAS chỉ atomic cho **single variable** — nếu cần atomic update nhiều fields, cần \`synchronized\` hoặc \`StampedLock\`. \`AtomicReference<State>\` + immutable State object cho complex atomic update.` },
  { q: 'volatile không đủ để fix race condition, tại sao?',
    a: `**A:** \`volatile\` đảm bảo **visibility** — write visible đến tất cả thread ngay lập tức (không cached trong CPU register). Nhưng không đảm bảo **atomicity** của compound operations. \`volatile int count; count++\` vẫn có race vì \`++\` là read-modify-write (3 operations). \`volatile\` đủ cho: simple read/write của single variable mà chỉ một thread write (flag pattern: \`volatile boolean stopped\`). Cần \`synchronized\` hoặc \`Atomic\*\`: khi có read-modify-write, check-then-act, hoặc nhiều related variable cần update atomically.` },
]),

'redis-setnx-redlock': qa([
  { q: 'SETNX tại sao không đủ cho distributed lock?',
    a: `**A:** \`SETNX key value\` (Set if Not eXists) có vấn đề: không atomic với expiry. Pattern: \`SETNX lock 1\` rồi \`EXPIRE lock 30\` → nếu crash giữa hai lệnh → lock không có expiry → **deadlock permanent**. Fix bằng Redis 2.6+: \`SET key value NX EX 30\` — atomic set-with-expiry. Nhưng vẫn còn vấn đề: (1) Lock expire quá sớm khi task chạy lâu → hai client cùng có lock. (2) Client A expire → Client B lấy lock → Client A xong DELETE key của B (sai owner). Fix: value = unique token, chỉ delete nếu value match.` },
  { q: 'Redlock algorithm hoạt động thế nào?',
    a: `**A:** Redlock (Redis Distributed Lock) của Antirez — dùng **N independent Redis nodes** (khuyến nghị 5): (1) Client ghi timestamp \`T1\`. (2) Thử acquire lock trên **tất cả N nodes** tuần tự với timeout nhỏ. (3) Lock acquired nếu ≥ \`⌊N/2⌋ + 1\` nodes thành công (quorum). (4) Validity time = TTL - (T_now - T1) - clock drift. (5) Nếu không đủ quorum: release lock trên tất cả nodes. Đảm bảo: ngay cả khi minority nodes fail, lock vẫn đúng. Vẫn có tranh cãi (Martin Kleppmann): clock drift và GC pause có thể vi phạm safety. Dùng cho: non-critical distributed coordination.` },
  { q: 'Khi nào dùng Redis lock thay vì database lock?',
    a: `**A:** **Redis lock**: low latency (~1ms), không liên quan đến DB transaction, phù hợp cross-service coordination, distributed job scheduling (chỉ một instance chạy cron). **Database lock** (\`SELECT FOR UPDATE\`): strong consistency (ACID), tự động release khi transaction end (không cần manage expiry), phù hợp khi operation thực sự phải modify DB atomically. Chọn Redis: idempotent operations, performance critical, rate limiting, cache update coordination. Chọn DB lock: money transfer, inventory update — cần transaction guarantee cùng DB.` },
]),


'resilience4j': qa([
  { q: 'Cấu hình CircuitBreaker trong Resilience4j thế nào?',
    a: `**A:** \`CircuitBreakerConfig.custom().failureRateThreshold(50).waitDurationInOpenState(Duration.ofSeconds(30)).slidingWindowSize(10).build()\`. Key params: \`failureRateThreshold\` — % failures để open circuit. \`waitDurationInOpenState\` — thời gian OPEN trước khi thử HALF_OPEN. \`slidingWindowSize\` — số call cuối để tính failure rate. \`permittedNumberOfCallsInHalfOpenState\` — số call thử trong HALF_OPEN. Spring Boot: \`resilience4j.circuitbreaker.instances.myService.failure-rate-threshold=50\` trong \`application.yml\` + \`@CircuitBreaker(name="myService", fallbackMethod="fallback")\`.` },
  { q: '@Retry và @CircuitBreaker kết hợp thế nào?',
    a: `**A:** Dùng cả hai: Retry wrap bên trong, CircuitBreaker bên ngoài — đúng thứ tự. \`@CircuitBreaker(name="x") @Retry(name="x") public Result call() {...}\`. Flow: CircuitBreaker check → nếu OPEN → fail fast (không retry). Nếu CLOSED → gọi method → nếu fail → Retry thử lại (N lần) → nếu vẫn fail sau retry → CircuitBreaker record failure. Thứ tự annotation quan trọng: Spring AOP xử lý outer annotation trước. \`@RateLimiter\` + \`@CircuitBreaker\` + \`@Retry\`: RateLimiter → CircuitBreaker → Retry.` },
  { q: 'Fallback method trong Resilience4j nhận tham số nào?',
    a: `**A:** Fallback method phải có **cùng return type** và **cùng tham số** như original method, **thêm** exception parameter ở cuối. Ví dụ:\n\`\`\`java\n@CircuitBreaker(name="x", fallbackMethod="fallback")\npublic String callService(String userId) { ... }\n\nprivate String fallback(String userId, Exception e) {\n    log.warn("Fallback for userId={}", userId, e);\n    return "default response";\n}\n\`\`\`\nNếu fallback không match signature → Resilience4j throw \`NoSuchMethodException\`. Có thể có nhiều fallback method với exception type khác nhau — Resilience4j chọn fallback match exception type gần nhất.` },
]),

'rest-vs-grpc': qa([
  { q: 'gRPC có ưu điểm gì so với REST trong service-to-service communication?',
    a: `**A:** (1) **Protobuf binary**: nhỏ hơn JSON 3-10x, serialize/deserialize nhanh hơn. (2) **HTTP/2 multiplexing**: nhiều request trên cùng connection, không head-of-line blocking. (3) **Streaming**: bidirectional streaming (không chỉ request-response). (4) **Strict contract** (proto file): type-safe, code generation, breaking change detection. (5) **Lower latency**: binary + HTTP/2 + persistent connection. Nhược điểm: không human-readable (debug khó hơn), browser không native support (cần gRPC-Web), learning curve. Dùng gRPC: internal microservices cần performance; REST: public API, browser clients.` },
  { q: 'REST idempotency là gì và tại sao quan trọng?',
    a: `**A:** **Idempotent**: gọi N lần cho cùng result như gọi 1 lần. HTTP methods: \`GET\`, \`HEAD\`, \`OPTIONS\` — idempotent và safe. \`PUT\`, \`DELETE\` — idempotent (không safe). \`POST\`, \`PATCH\` — không idempotent (thường). Quan trọng với retry: nếu network fail sau server xử lý nhưng trước response → client retry. Idempotent endpoint: retry an toàn. \`POST /orders\` retry tạo duplicate order (vấn đề). Fix: idempotency key — \`POST /orders\` với header \`Idempotency-Key: uuid\` → server deduplicate bằng key.` },
  { q: 'HTTP/2 multiplexing giải quyết vấn đề gì của HTTP/1.1?',
    a: `**A:** HTTP/1.1 **Head-of-Line Blocking**: một connection chỉ có một request đang flight — request sau phải chờ request trước xong. Workaround: mở nhiều parallel connection (6-8 per origin) → resource overhead, TCP slow start mỗi connection. **HTTP/2 multiplexing**: nhiều **stream** trong một TCP connection — independent frames interleaved. Request A đang chờ response không block Request B. Kết quả: ít connections, không HOL blocking, header compression (HPACK), server push. gRPC xây trên HTTP/2 → inherit tất cả benefits này cho service communication.` },
]),

'resultmap': qa([
  { q: 'ResultMap trong MyBatis giải quyết vấn đề gì?',
    a: `**A:** ResultMap giải quyết mapping giữa SQL result set và Java object khi: (1) **Column name khác field name** — \`user_name\` → \`userName\`. (2) **Nested object** — JOIN result map thành object có object con (\`user\` + \`address\`). (3) **Collection** — one-to-many: \`user\` có \`List<Order> orders\`. (4) **Discriminator** — map sang subclass khác nhau dựa trên column value. Không có ResultMap: MyBatis dùng column name = field name (case-insensitive) — thất bại với underscore vs camelCase. \`mapUnderscoreToCamelCase=true\` setting auto-convert mà không cần ResultMap đơn giản.` },
  { q: 'Association và Collection trong ResultMap khác nhau thế nào?',
    a: `**A:** **\`<association>\`**: map many-to-one / one-to-one — nested object. \`User\` có \`Address address\`. \`<association property="address" javaType="Address">\`. **\`<collection>\`**: map one-to-many — list of objects. \`User\` có \`List<Order> orders\`. \`<collection property="orders" ofType="Order">\`. Cả hai hỗ trợ nested ResultMap (inline) hoặc \`resultMap="..."\ reference. Với JOIN: MyBatis tự group rows theo main entity ID — nhiều rows cùng userId tạo một User với many Orders. N+1 option: \`select\` attribute để lazy load — tránh JOIN, query riêng khi cần.` },
  { q: 'N+1 query problem trong MyBatis là gì và giải quyết thế nào?',
    a: `**A:** N+1: load 1 list (1 query) rồi load association của mỗi item (N queries). 100 users + load address của mỗi user = 101 queries. Giải pháp MyBatis: (1) **JOIN trong SQL + ResultMap**: một query lấy user + address join → map vào nested object. (2) **Lazy loading** (\`fetchType="lazy"\`): chỉ load khi access association — nhưng nếu access tất cả → vẫn N+1. (3) **\`fetchSize\`** không giúp N+1. (4) Tốt nhất: redesign query với explicit JOIN khi biết sẽ cần association. \`lazyLoadingEnabled=true\` trong config để lazy by default.` },
]),

'retry-strategies': qa([
  { q: 'Exponential backoff với jitter là gì?',
    a: `**A:** **Exponential backoff**: delay tăng theo lũy thừa sau mỗi retry — 1s, 2s, 4s, 8s, 16s... **Vấn đề**: nếu nhiều client đều retry sau 8s → thundering herd, spike tải vào server lúc recover. **Jitter**: thêm random delay — \`delay = min(cap, base * 2^attempt) + random(0, delay)\`. Kết quả: client retry ở thời điểm khác nhau → smooth tải. AWS SDK dùng exponential backoff + jitter mặc định. Spring Retry: \`@Retryable(backoff=@Backoff(delay=1000, multiplier=2, maxDelay=30000))\`. Công thức: \`delay = rand(0, min(cap, initial_delay * 2^attempt))\`.` },
  { q: 'Khi nào KHÔNG nên retry?',
    a: `**A:** Không retry khi: (1) **4xx errors** (400, 401, 403, 422): lỗi từ request của client — retry sẽ cùng fail. Chỉ 429 (rate limit) và 408 (timeout) nên retry. (2) **Non-idempotent operations**: \`POST /payment\` retry tạo duplicate charge — cần idempotency key trước. (3) **Circuit open**: đang open → fail fast, không retry. (4) **Business logic exception**: data validation fail. (5) **Deadline exceeded**: tổng thời gian đã vượt timeout cho caller. Retry đúng: chỉ với transient errors (503, 502, network timeout, connection refused) và idempotent operations.` },
  { q: 'Dead letter queue liên quan đến retry thế nào?',
    a: `**A:** Sau N retry thất bại, message không nên discard — route đến **Dead Letter Queue (DLQ)** để: (1) Analyze lý do fail, (2) Retry thủ công sau khi fix bug, (3) Alert/monitoring. RabbitMQ: \`x-dead-letter-exchange\` trên queue — nếu message reject hoặc expire → automatic route đến DLX. Kafka: DLQ là separate topic — consumer code catch exception sau max retry → produce đến \`topic.DLT\`. Spring Kafka \`@RetryableTopic\`: tự động create retry topics + DLT, handle backoff. DLQ pattern: không mất message, cho phép nhìn lại để debug.` },
]),

'routing-keys': qa([
  { q: 'Routing key trong RabbitMQ direct exchange là gì?',
    a: `**A:** Routing key là string label producer gắn vào message. Direct exchange so sánh routing key với binding key của queue (exact match). Queue binding: \`channel.queueBind(queue, exchange, bindingKey)\`. Producer publish: \`channel.basicPublish(exchange, routingKey, ..., body)\`. Nếu \`routingKey == bindingKey\` → message route đến queue đó. Một queue có thể bind với nhiều binding keys. Routing key khác binding key → message bị discard (hoặc route đến alternate exchange). Use case: \`error.order\`, \`info.order\` → route tới queue khác nhau.` },
  { q: 'Topic exchange routing pattern thế nào?',
    a: `**A:** Topic exchange dùng pattern matching với wildcards trong binding key: \`*\` match đúng **một word**, \`#\` match **zero hoặc nhiều word** (word = ký tự giữa các dấu chấm). Ví dụ binding keys: \`*.order.error\` match \`app.order.error\` nhưng không match \`order.error\`. \`logs.#\` match \`logs\`, \`logs.app\`, \`logs.app.error\`. Producer routing key: \`payment.order.failure\` → route đến queue bind với \`payment.#\` và \`*.order.*\`. Dùng: multi-level categorization — application + module + severity.` },
  { q: 'Headers exchange hoạt động thế nào?',
    a: `**A:** Headers exchange ignore routing key — route dựa trên **message headers** (key-value pairs). Queue binding specify \`x-match\` (\`all\` hoặc \`any\`) + header conditions. \`x-match=all\`: tất cả header điều kiện phải match. \`x-match=any\`: ít nhất một header match. Ví dụ: queue bind \`{x-match: all, format: pdf, type: report}\` → chỉ message có cả \`format=pdf\` và \`type=report\` được route. Linh hoạt hơn routing key nhưng overhead cao hơn (parse headers). Ít dùng hơn direct/topic trong thực tế.` },
]),

'routing-rate-limiting': qa([
  { q: 'API Gateway rate limiting dùng thuật toán nào?',
    a: `**A:** (1) **Token bucket**: bucket chứa N tokens, mỗi request consume 1 token, token refill theo tốc độ cố định — cho phép burst ngắn. (2) **Leaky bucket**: request vào queue, xử lý theo tốc độ cố định — smooth output, không cho burst. (3) **Fixed window**: đếm request trong window cố định (1 minute) — có edge case burst tại boundary. (4) **Sliding window log**: track timestamp của mỗi request — exact nhưng memory intensive. (5) **Sliding window counter**: kết hợp fixed window + weighted — balance accuracy vs memory. AWS API Gateway, Nginx dùng leaky bucket; Kong, Redis rate-limiting plugin dùng token bucket.` },
  { q: 'Làm thế nào để implement distributed rate limiting?',
    a: `**A:** Single instance: in-memory counter đơn giản. Distributed (nhiều API gateway instance): dùng **Redis** làm shared counter. Pattern với Redis:\n\`\`\`lua\n-- Lua script atomic trong Redis\nlocal count = redis.call('INCR', key)\nif count == 1 then redis.call('EXPIRE', key, 60) end\nreturn count\n\`\`\`\nTradeoff: Redis là single point (dùng Redis Cluster để HA). Alternative: sticky routing — same client → same gateway instance (đơn giản hơn nhưng không perfect). Redis sorted set cho sliding window log. Thư viện: Bucket4j (Java), Resilience4j RateLimiter.` },
  { q: 'Rate limit response trả về gì theo best practice?',
    a: `**A:** HTTP **429 Too Many Requests** với headers: \`Retry-After: 60\` (seconds until reset), \`X-RateLimit-Limit: 100\` (requests allowed per window), \`X-RateLimit-Remaining: 0\` (remaining in current window), \`X-RateLimit-Reset: 1735689600\` (Unix timestamp khi reset). Body: \`{"error": "rate_limit_exceeded", "message": "Too many requests. Retry after 60 seconds."}\`. Client behavior: đọc \`Retry-After\` header, wait, rồi retry với exponential backoff nếu vẫn rate limited. Không return 503 (Service Unavailable) cho rate limiting — đó là server error, không phải client error.` },
]),

'scalability': qa([
  { q: 'Horizontal scaling và vertical scaling khi nào dùng cái nào?',
    a: `**A:** **Vertical scaling** (scale up): thêm CPU/RAM vào một server — đơn giản, không cần code change, nhưng có ceiling, single point of failure, downtime khi upgrade. **Horizontal scaling** (scale out): thêm server — phức tạp hơn (load balancing, session, distributed state), không có ceiling lý thuyết, high availability. Chọn vertical: database server (stateful, sharding phức tạp), quick win trong ngắn hạn. Chọn horizontal: stateless web tier, API servers — easy với Kubernetes autoscaling. Best practice: design stateless từ đầu → horizontal scale dễ dàng.` },
  { q: 'Bottleneck phổ biến nhất khi scale là gì?',
    a: `**A:** (1) **Database**: thường là bottleneck đầu tiên — read replicas, connection pooling, caching, sharding. (2) **Session state**: in-memory session không scale — externalize ra Redis/Memcached. (3) **Single point of failure**: load balancer, auth service không HA. (4) **Synchronous blocking calls**: chain của synchronous calls tạo cascading latency — async messaging. (5) **Shared mutable state**: global cache, counter — distributed coordination overhead. Phương pháp: profile trước khi tối ưu — dùng APM (Datadog, Jaeger) để tìm bottleneck thực sự, không đoán.` },
  { q: 'Database read replica giúp scalability thế nào?',
    a: `**A:** Read replicas: secondary databases sync asynchronously từ primary. Read traffic (SELECT) route đến replicas — primary chỉ handle writes. Benefit: scale read throughput tuyến tính (thêm replica), giảm tải primary, replica có thể dùng cho reporting/analytics. Trade-off: **replication lag** — replica có thể lag primary vài ms-s. Không dùng replica để read ngay sau write (stale data). Pattern: read-your-own-writes — route read của user đến primary ngay sau write, fallback sang replica sau. Spring: \`@Transactional(readOnly=true)\` → datasource routing tới replica.` },
]),

'service-communication': qa([
  { q: 'Synchronous vs asynchronous communication trade-off là gì?',
    a: `**A:** **Synchronous** (REST, gRPC): simple request-response, caller block chờ result, easy debugging, tight coupling — caller phải available, latency tích lũy qua chain. **Asynchronous** (Kafka, RabbitMQ): caller không block, loose coupling, higher throughput, fault tolerance (message persist) — complexity cao hơn (eventual consistency, message ordering, idempotency). Chọn sync: cần immediate response (login, payment status query), simple CRUD. Chọn async: background jobs (email, notification), event broadcasting, high throughput ingestion, decoupling giữa services có SLA khác nhau.` },
  { q: 'Service mesh như Istio giúp gì cho service communication?',
    a: `**A:** Service mesh inject **sidecar proxy** (Envoy) vào mỗi Pod — intercept tất cả network traffic. Benefits: (1) **mTLS automatic**: encrypt và authenticate service-to-service traffic không cần code change. (2) **Traffic management**: retry, circuit breaking, canary routing tại proxy level. (3) **Observability**: distributed tracing, metrics tự động cho mọi service call. (4) **Load balancing**: advanced (least connections, locality-aware). Tradeoff: latency overhead (proxy hop), operational complexity, learning curve. Dùng khi: có nhiều service (>10), cần zero-trust security, muốn centralize cross-cutting concerns.` },
  { q: 'Request timeout nên set thế nào trong microservices?',
    a: `**A:** Nguyên tắc: timeout phải **nhỏ hơn** timeout của caller. Service chain A → B → C: nếu A timeout sau 3s, B phải timeout sau <3s, C phải timeout sau <B_timeout. Tránh timeout lớn hơn caller — resource bị giữ vô ích. **Aggressive timeout** (fast fail): 500ms-2s cho user-facing services — user experience quan trọng hơn eventual success. **Relaxed timeout**: 30s-60s cho background jobs, batch processing. Kết hợp: timeout + retry + circuit breaker. Sai lầm phổ biến: default timeout quá lớn (30s) → slow cascade failure khi downstream chậm.` },
]),

'service-deployment': qa([
  { q: 'Blue-green deployment hoạt động thế nào?',
    a: `**A:** Duy trì **hai production environment** identical: Blue (current live) và Green (new version). Deploy new version lên Green → test Green → switch load balancer để route 100% traffic sang Green → Blue trở thành standby. Rollback: switch LB về Blue (instant). Không cần downtime. Trade-off: tốn chi phí double infrastructure. Giải quyết: database migration phải backward compatible (Blue phải đọc được DB schema sau migration). Kubernetes: Blue/Green với service selector switch: \`kubectl patch service myapp -p '{"spec":{"selector":{"version":"green"}}}'\`.` },
  { q: 'Canary deployment khác blue-green thế nào?',
    a: `**A:** **Canary**: route **percentage nhỏ** traffic (1-5%) đến new version, tăng dần nếu không có vấn đề. Không cần double infrastructure — cả hai version chạy song song, traffic split theo weight. **Blue-green**: switch 100% traffic instant. Canary tốt hơn cho: phát hiện vấn đề với real user traffic trước khi full rollout, giảm blast radius. Blue-green tốt cho: cần instant rollback, không muốn split traffic. Kubernetes canary: dùng Argo Rollouts hoặc Flagger tự động tăng traffic % khi metrics OK. Istio: \`VirtualService\` với weight routing.` },
  { q: 'Làm thế nào để handle database migration trong deployment?',
    a: `**A:** Nguyên tắc: migration phải **backward compatible** — old code phải chạy được với schema mới (và ngược lại). Expand-Contract pattern: (1) **Expand**: thêm column mới (nullable hoặc có default), giữ column cũ — old code ignore column mới. (2) Deploy new code (read cả cũ và mới). (3) **Migrate data**. (4) **Contract**: drop column cũ sau khi tất cả traffic đã dùng new code. Không rename column trực tiếp — thêm column mới, copy data, update code, drop cũ. Flyway/Liquibase: version migration, tích hợp vào deploy pipeline.` },
]),

'service-discovery': qa([
  { q: 'Client-side và server-side service discovery khác nhau thế nào?',
    a: `**A:** **Client-side**: client query registry (Eureka) để lấy danh sách instances, tự chọn instance (load balance). Ví dụ: Spring Cloud + Ribbon. Client nhận danh sách IPs, tự decide. Ưu: client control load balancing algorithm. Nhược: mỗi client cần tích hợp registry client library. **Server-side**: client gọi load balancer/API gateway → LB query registry → forward request. Client không cần biết registry. Ví dụ: Kubernetes Service (kube-proxy), AWS ALB. Đơn giản hơn cho client, nhưng LB là hop thêm. Kubernetes dùng DNS-based server-side discovery.` },
  { q: 'Kubernetes Service DNS hoạt động thế nào?',
    a: `**A:** Kubernetes tạo DNS record cho mỗi Service: \`<service-name>.<namespace>.svc.cluster.local\`. CoreDNS trong cluster resolve tên này đến ClusterIP của Service. Service → route đến Pod endpoints qua kube-proxy (iptables/IPVS). \`my-service.default.svc.cluster.local\` → ClusterIP → Pod IP. Trong cùng namespace: có thể dùng \`my-service\` ngắn gọn. Headless Service (\`clusterIP: None\`): DNS return trực tiếp Pod IPs thay vì ClusterIP — client tự load balance. StatefulSet + Headless: \`pod-0.my-service.default.svc.cluster.local\` — stable DNS per pod.` },
  { q: 'Health check ảnh hưởng service discovery thế nào?',
    a: `**A:** Service registry cần biết instance nào healthy để route traffic. Cơ chế: **Heartbeat** — instance gửi heartbeat định kỳ đến registry (Eureka: 30s); nếu miss 3 heartbeats → deregister. **Active health check** — registry poll \`/health\` endpoint của instance. Kubernetes: \`readinessProbe\` quyết định Pod có được add vào Service endpoints không (non-ready Pod không nhận traffic). \`livenessProbe\` restart container nếu fail. Best practice: readinessProbe cho service discovery (ready to serve); livenessProbe cho restart detection (alive but stuck).` },
]),

'sizing-thread-pool': qa([
  { q: 'Công thức tính thread pool size là gì?',
    a: `**A:** **CPU-bound tasks**: \`N_threads = N_cpus + 1\` (một thread thêm để tận dụng khi thread khác tạm dừng). **I/O-bound tasks**: \`N_threads = N_cpus × (1 + wait_time / service_time)\`. Wait time/service time ratio: nếu task block 90% (9ms wait, 1ms compute) → ratio = 9 → \`N_threads = N_cpus × 10\`. **Thực tế**: đo bằng load testing, tìm throughput plateau — thêm thread không tăng throughput → đã đủ. Little's Law: \`N = λ × W\` (N = concurrent users, λ = request rate, W = response time). Virtual threads (Java 21): không cần size — JVM manage.` },
  { q: 'Thread pool quá ít thread dẫn đến vấn đề gì?',
    a: `**A:** Quá ít thread: **thread starvation** — tất cả threads bận, request mới phải chờ trong queue. Hậu quả: latency tăng vọt, timeouts, queue overflow nếu bounded. Đặc biệt nguy hiểm: nếu thread A đang chờ kết quả từ task B (cũng trong cùng pool) → **deadlock** vì thread để execute B không có. Spring Boot default Tomcat: 200 threads — với blocking I/O và slow DB, 200 concurrent requests → thread exhaustion. Triệu chứng: high CPU idle (threads waiting on I/O) nhưng response time cao.` },
  { q: 'Tại sao thread pool quá nhiều thread cũng là vấn đề?',
    a: `**A:** (1) **Memory**: mỗi platform thread có stack 512KB-1MB → 1000 threads = 500MB-1GB chỉ cho stack. (2) **Context switch overhead**: OS scheduler phải switch giữa nhiều threads — chi phí save/restore CPU state. Với CPU-bound: nhiều thread hơn CPU cores → thrashing (context switch nhiều hơn actual work). (3) **Thundering herd**: tất cả threads wake up cùng lúc cạnh tranh lock. Optimal: CPU-bound = N_cores+1, I/O-bound = measure và test. Virtual threads giải quyết vấn đề này cho I/O-bound — platform thread count = N_cores, virtual thread count = number of concurrent tasks.` },
]),

'sliding-window': qa([
  { q: 'Sliding window rate limiting so sánh với fixed window thế nào?',
    a: `**A:** **Fixed window**: count requests trong window cố định (ví dụ 1 minute). Vấn đề: burst tại ranh giới — 100 request cuối window + 100 request đầu window tiếp = 200 request trong 2s (burst 2x). **Sliding window log**: track timestamp của mỗi request, đếm trong cửa sổ trượt [now-60s, now]. Chính xác nhưng O(n) memory. **Sliding window counter**: chia window thành sub-windows, weighted average — balance accuracy vs memory. Resilience4j CircuitBreaker: \`COUNT_BASED\` (N calls) và \`TIME_BASED\` (N seconds) sliding windows để tính failure rate.` },
  { q: 'Implement sliding window counter với Redis thế nào?',
    a: `**A:** Dùng Redis sorted set: key = \`rate:{userId}\`, score = timestamp (unix ms), value = request UUID. Pipeline: \`MULTI → ZADD key timestamp uuid → ZREMRANGEBYSCORE key 0 (now-window_ms) → ZCARD key → EXPIRE key window_secs → EXEC\`. Sau transaction: so sánh count với limit. Atomic bằng Lua script:\n\`\`\`lua\nlocal key = KEYS[1]\nlocal now = tonumber(ARGV[1])\nlocal window = tonumber(ARGV[2])\nredis.call('ZREMRANGEBYSCORE', key, 0, now - window)\nlocal count = redis.call('ZCARD', key)\nif count < tonumber(ARGV[3]) then\n    redis.call('ZADD', key, now, now)\n    return 1\nend\nreturn 0\n\`\`\`` },
  { q: 'Sliding window trong Kafka Streams dùng để làm gì?',
    a: `**A:** Kafka Streams sliding window: aggregate events trong rolling time window. \`TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5))\` cho hopping window (non-overlapping). **Sliding window**: window move với mỗi event — mỗi event tạo window kết thúc tại event đó. Dùng cho: fraud detection (count transactions của user trong 5 phút trước mỗi transaction), anomaly detection. \`KStream.windowedBy(SlidingWindows.ofTimeDifferenceWithNoGrace(Duration.ofMinutes(5)))\`. Khác hopping window: sliding tạo many overlapping windows; hopping tạo discrete non-overlapping windows.` },
]),


'slow-query-log': qa([
  { q: 'Bật slow query log trong MySQL thế nào?',
    a: `**A:** Runtime (không cần restart): \`SET GLOBAL slow_query_log = ON; SET GLOBAL long_query_time = 1; SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';\`. Persistent trong \`my.cnf\`:\n\`\`\`ini\n[mysqld]\nslow_query_log = 1\nlong_query_time = 1\nlog_queries_not_using_indexes = 1\n\`\`\`\n\`long_query_time\`: seconds, có thể là float (0.1 = 100ms). \`log_queries_not_using_indexes\`: log tất cả query không dùng index dù nhanh. Check status: \`SHOW GLOBAL STATUS LIKE 'Slow_queries'\` — đếm tổng slow queries.` },
  { q: 'Phân tích slow query log bằng tool nào?',
    a: `**A:** **pt-query-digest** (Percona Toolkit): \`pt-query-digest /var/log/mysql/slow.log\` → group similar queries, hiện stats (count, total time, avg time, rows examined). Output: top queries theo total time + normalized query pattern. **mysqldumpslow** (built-in): \`mysqldumpslow -s t -t 10 slow.log\` → top 10 queries by time. **MySQLTuner**: script analyze overall MySQL health. Sau khi tìm slow query: dùng \`EXPLAIN\` để analyze execution plan — check type (ALL là full scan), key (index used), rows (estimated scan count).` },
  { q: 'rows_examined cao trong slow log có nghĩa gì?',
    a: `**A:** \`rows_examined\` là số rows MySQL scan để tìm kết quả. \`rows_sent\` là số rows trả về client. Nếu \`rows_examined >> rows_sent\` → inefficient query (scan nhiều nhưng return ít). Ví dụ: examine 1,000,000 rows, send 10 rows → ratio 100,000:1 → thiếu index hoặc index không selective. Action: \`EXPLAIN SELECT ...\` → check \`key\` column (NULL = không dùng index), \`type\` (ALL = full table scan). Thêm index phù hợp → \`rows_examined\` giảm đáng kể. Mục tiêu: \`rows_examined / rows_sent\` càng gần 1 càng tốt.` },
]),

'so-sanh-cac-mo-hinh-i-o': qa([
  { q: 'Blocking I/O và Non-blocking I/O khác nhau thế nào?',
    a: `**A:** **Blocking I/O**: thread gọi \`read()\` → block cho đến khi data available — thread bị "frozen", không làm gì khác được. 1000 concurrent connections → 1000 threads (tốn memory). **Non-blocking I/O**: \`read()\` return ngay — nếu không có data, return EAGAIN. Thread có thể làm việc khác, dùng event loop hoặc selector để check khi data ready. Ít threads, nhiều connections. Java: \`java.io\` = blocking; \`java.nio\` với Selector = non-blocking. Nginx, Node.js dùng non-blocking I/O — handle hàng nghìn connections với một thread event loop.` },
  { q: 'Sự khác biệt giữa đồng bộ (sync) và bất đồng bộ (async) I/O?',
    a: `**A:** **Sync I/O**: caller chịu trách nhiệm check data ready (blocking: chờ; non-blocking: poll) — caller actively involved trong waiting. **Async I/O**: OS notify khi data ready qua callback/signal/future — caller làm việc khác, OS gọi lại khi done. Java AIO (\`AsynchronousFileChannel\`, \`AsynchronousSocketChannel\`): submit operation → callback khi complete. **Tóm tắt**: Blocking sync (truyền thống), Non-blocking sync (poll loop), Async (callback/completion handler). Virtual threads (Java 21): blocking syntax nhưng non-blocking behavior — JVM unmount thread khi block.` },
  { q: 'Multiplexing I/O (select/epoll) hoạt động thế nào?',
    a: `**A:** **select/poll**: một thread monitor nhiều file descriptors (sockets) — \`select(fds, timeout)\` block cho đến khi ít nhất một FD ready → iterate để tìm FD nào ready → process. O(n) scan, max 1024 FDs. **epoll** (Linux): efficient version — \`epoll_ctl\` register FD, \`epoll_wait\` block chờ events, return chỉ FDs ready (not all). O(1) lookup, unlimited FDs. Nginx, Redis, Node.js dùng epoll. Java NIO Selector: abstraction trên epoll/kqueue. Pattern: một thread, nhiều connections, event-driven. Scalable cho I/O-heavy workloads.` },
]),

'spring-aop': qa([
  { q: 'Các loại advice trong Spring AOP là gì?',
    a: `**A:** (1) **@Before**: chạy trước method. (2) **@After**: chạy sau (kể cả exception). (3) **@AfterReturning**: chạy sau khi method return thành công — có thể access return value. (4) **@AfterThrowing**: chạy khi method throw exception — access exception object. (5) **@Around**: bao quanh method — powerful nhất, control có chạy method hay không, modify return value. Around: \`ProceedingJoinPoint.proceed()\` để chạy method gốc. Execution order trong cùng class: Around → Before → method → AfterReturning/AfterThrowing → After → Around (sau proceed).` },
  { q: 'Pointcut expression viết thế nào?',
    a: `**A:** \`execution(modifiers? return-type declaring-type? method-name(params) throws?)\`. Wildcards: \`*\` = bất kỳ (một word), \`..\` = bất kỳ package level hoặc params. Ví dụ:\n- \`execution(* com.example.service.*.*(..))\` — tất cả method trong package service\n- \`execution(public * *(..)))\` — tất cả public method\n- \`execution(* *Service.*(..)))\` — class tên kết thúc Service\n- \`@annotation(org.springframework.transaction.annotation.Transactional)\` — method có annotation\n- \`bean(userService)\` — chỉ bean tên userService. Combine: \`&&\`, \`||\`, \`!\`.` },
  { q: 'JoinPoint và ProceedingJoinPoint khác nhau thế nào?',
    a: `**A:** **\`JoinPoint\`**: read-only access — xem method signature, arguments, target object. Available trong @Before, @After, @AfterReturning, @AfterThrowing. Methods: \`getArgs()\`, \`getTarget()\`, \`getSignature()\`. **\`ProceedingJoinPoint\`**: extends JoinPoint — thêm \`proceed()\` để chạy method gốc (hoặc \`proceed(newArgs)\` để modify args). Chỉ dùng được trong \`@Around\`. Thiếu \`proceed()\` call trong @Around → method gốc không chạy — useful để short-circuit (caching, authorization check). Return value của \`proceed()\` là return value của method gốc.` },
]),

'spring-boot': qa([
  { q: '@SpringBootApplication annotation làm gì?',
    a: `**A:** \`@SpringBootApplication\` là meta-annotation kết hợp ba annotations: (1) **\`@Configuration\`**: class này là bean definition source. (2) **\`@EnableAutoConfiguration\`**: activate Spring Boot auto-configuration dựa trên classpath, beans, properties. (3) **\`@ComponentScan\`**: scan package hiện tại và sub-packages cho \`@Component\`, \`@Service\`, \`@Repository\`, \`@Controller\`. Auto-configuration: Spring Boot check classpath — nếu có \`spring-boot-starter-data-jpa\` → auto-configure DataSource, EntityManagerFactory, TransactionManager. Customize: \`@SpringBootApplication(exclude={DataSourceAutoConfiguration.class})\`.` },
  { q: 'Embedded server trong Spring Boot hoạt động thế nào?',
    a: `**A:** Spring Boot embed Tomcat (default), Jetty, hoặc Undertow vào fat JAR — không cần deploy WAR vào external server. Khi \`mvn package\` → JAR chứa tất cả dependencies + embedded server. \`java -jar app.jar\` → main class start embedded Tomcat → deploy app context vào đó. Benefit: deployment đơn giản (single JAR), version lock (Tomcat version gắn với app), container-friendly. Exclude Tomcat dùng Jetty: \`spring-boot-starter-web\` exclude \`tomcat\`, add \`spring-boot-starter-jetty\`. Config: \`server.port\`, \`server.tomcat.max-threads\` trong \`application.properties\`.` },
  { q: 'Auto-configuration cơ chế nào để không xung đột với bean user define?',
    a: `**A:** Spring Boot auto-configuration dùng \`@ConditionalOnMissingBean\` — chỉ tạo bean nếu **không** có bean cùng type đã được define bởi user. Ví dụ: \`DataSourceAutoConfiguration\` có \`@ConditionalOnMissingBean(DataSource.class)\` → nếu user define \`@Bean DataSource\`, auto-config không tạo. Thứ tự: user beans được đăng ký trước auto-config beans. Khác: \`@ConditionalOnProperty\` — chỉ tạo nếu property có giá trị cụ thể. \`@ConditionalOnClass\` — chỉ tạo nếu class tồn tại trên classpath. Mechanism: \`spring.factories\` / \`AutoConfiguration.imports\` list auto-config classes.` },
]),

'spring-core': qa([
  { q: 'IoC container là gì và tại sao quan trọng?',
    a: `**A:** **IoC (Inversion of Control) container** quản lý lifecycle và wiring của beans. Thay vì object tự tạo dependencies (\`new ServiceB()\`), container inject vào — "control" được invert từ object sang container. Lợi ích: (1) Loose coupling — code against interface, không concrete class. (2) Testability — inject mock dễ dàng. (3) Reusability — bean được share. (4) Lifecycle management — container handle initialization, destruction. Spring cung cấp \`BeanFactory\` (lazy) và \`ApplicationContext\` (eager, đầy đủ feature hơn). \`@Autowired\`, \`@Inject\`, constructor injection đều là cơ chế DI.` },
  { q: 'Spring Bean lifecycle từ creation đến destruction là gì?',
    a: `**A:** (1) Instantiate — constructor. (2) Populate properties — \`@Autowired\` field injection. (3) BeanNameAware, BeanFactoryAware — nếu implement. (4) BeanPostProcessor.postProcessBeforeInitialization. (5) **\`@PostConstruct\`** / InitializingBean.afterPropertiesSet(). (6) Custom init-method. (7) BeanPostProcessor.postProcessAfterInitialization. (8) Bean ready — vào scope. (9) **\`@PreDestroy\`** / DisposableBean.destroy() — khi context close. Dùng \`@PostConstruct\` để init sau inject (không phải constructor — vì constructor chưa inject). \`@PreDestroy\` để cleanup (close connection, flush).` },
  { q: 'ApplicationContext và BeanFactory khác nhau thế nào?',
    a: `**A:** \`BeanFactory\`: basic IoC container — lazy initialization, không có advanced features. \`ApplicationContext\`: extends BeanFactory, thêm: (1) Eager singleton initialization (fail-fast). (2) MessageSource (i18n). (3) ApplicationEventPublisher (event system). (4) ResourceLoader. (5) AOP integration. (6) Environment abstraction. Thực tế: luôn dùng \`ApplicationContext\`. Implementations: \`ClassPathXmlApplicationContext\`, \`AnnotationConfigApplicationContext\`, \`SpringApplication\` (Boot). \`WebApplicationContext\`: extends AC, thêm ServletContext — Spring MVC dùng.` },
]),

'spring-mvc': qa([
  { q: 'DispatcherServlet là gì và hoạt động thế nào?',
    a: `**A:** \`DispatcherServlet\` là **Front Controller** của Spring MVC — single entry point nhận tất cả HTTP request. Flow: (1) Request đến DispatcherServlet. (2) HandlerMapping tìm controller phù hợp theo URL. (3) HandlerAdapter gọi controller method. (4) Controller return ModelAndView (hoặc \`@ResponseBody\`). (5) ViewResolver resolve view name thành template. (6) View render HTML → response. Khi dùng \`@RestController\`: bỏ qua ViewResolver, dùng \`HttpMessageConverter\` (Jackson) convert object thành JSON trực tiếp.` },
  { q: '@RequestMapping và @GetMapping khác nhau thế nào?',
    a: `**A:** \`@RequestMapping(value="/users", method=RequestMethod.GET)\` = \`@GetMapping("/users")\`. \`@GetMapping\`, \`@PostMapping\`, \`@PutMapping\`, \`@DeleteMapping\`, \`@PatchMapping\` là shorthand annotations cho từng HTTP method. \`@RequestMapping\` ở class level define base path; method level define sub-path. Ví dụ: class \`@RequestMapping("/api/users")\`, method \`@GetMapping("/{id}")\` → full path \`/api/users/{id}\`. Prefer \`@GetMapping\` etc. cho clarity; dùng \`@RequestMapping\` ở class level cho common prefix.` },
  { q: '@PathVariable và @RequestParam khác nhau thế nào?',
    a: `**A:** **\`@PathVariable\`**: lấy từ URI path — \`GET /users/123\` → \`@PathVariable Long id\` = 123. Required by default. **\`@RequestParam\`**: lấy từ query string — \`GET /users?role=admin\` → \`@RequestParam String role\` = "admin". Optional với default: \`@RequestParam(defaultValue="USER") String role\`. **\`@RequestBody\`**: deserialize từ request body (JSON → Java object). \`@RequestHeader\`: lấy từ HTTP header. Principle: RESTful resources dùng path variable cho identifier (\`/users/{id}\`); filter/pagination dùng query param (\`?page=1&size=10\`).` },
]),

'spring-security': qa([
  { q: 'Spring Security filter chain hoạt động thế nào?',
    a: `**A:** Spring Security là \`Filter\` chain đặt trước DispatcherServlet. Mỗi request đi qua các filter theo thứ tự: \`SecurityContextPersistenceFilter\` (load SecurityContext) → \`UsernamePasswordAuthenticationFilter\` (nếu login request) → \`BasicAuthenticationFilter\` (Basic Auth) → \`BearerTokenAuthenticationFilter\` (JWT) → \`ExceptionTranslationFilter\` → \`AuthorizationFilter\`. Mỗi filter có thể: authenticate, authorize, modify request, hoặc short-circuit (return 401/403). Custom filter: \`addFilterBefore\`/\`addFilterAfter\` trong \`SecurityFilterChain\` config.` },
  { q: 'JWT authentication trong Spring Security thế nào?',
    a: `**A:** Flow: (1) Login request → \`/auth/login\` → verify credentials → generate JWT (HMAC hoặc RSA signed). (2) Client gửi \`Authorization: Bearer <token>\` trong header. (3) Custom filter (\`OncePerRequestFilter\`) intercept → extract token → validate signature + expiry → set \`SecurityContextHolder\`. Implement: \`JwtAuthenticationFilter extends OncePerRequestFilter\`, trong \`doFilterInternal\`: parse JWT với \`jjwt\` library → \`UsernamePasswordAuthenticationToken\` → \`SecurityContextHolder.getContext().setAuthentication(auth)\`. Config: \`http.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)\`.` },
  { q: '@PreAuthorize và @Secured khác nhau thế nào?',
    a: `**A:** **\`@Secured({"ROLE_ADMIN"})\`**: đơn giản, chỉ check role — không support SpEL expression. **\`@PreAuthorize("hasRole('ADMIN') and #user.id == authentication.principal.id")\`**: SpEL expression — flexible, có thể check method params (\`#param\`), authentication, custom security expressions. \`@PostAuthorize\`: check sau khi method return — dùng \`returnObject\` trong expression. Enable: \`@EnableMethodSecurity\` (Spring Security 6) hoặc \`@EnableGlobalMethodSecurity\` (deprecated). Best practice: dùng \`@PreAuthorize\` vì expressive hơn và support parameter-level security.` },
]),

'springboottest': qa([
  { q: '@SpringBootTest và @WebMvcTest khác nhau thế nào?',
    a: `**A:** **\`@SpringBootTest\`**: load **full application context** — tất cả beans, auto-configuration. Test gần giống production nhất. Chậm (load nhiều). Dùng khi: integration test cần nhiều layer. **\`@WebMvcTest(MyController.class)\`**: chỉ load **web layer** — Controller, Filter, ControllerAdvice. Không load Service, Repository. Service phải \`@MockBean\`. Nhanh. Dùng khi: test controller logic, request/response mapping, validation. **\`@DataJpaTest\`**: chỉ JPA layer — in-memory H2, Repository beans. **\`@JsonTest\`**: chỉ JSON serialization. Nguyên tắc: dùng slice annotation nhỏ nhất phù hợp với test mục đích.` },
  { q: 'MockMvc dùng để test gì và cách dùng?',
    a: `**A:** MockMvc: test Spring MVC controllers mà không cần start HTTP server — simulate request/response trong JVM. Setup: \`@WebMvcTest\` auto-configure. Ví dụ:\n\`\`\`java\n@Test\nvoid getUser_shouldReturn200() throws Exception {\n    given(userService.findById(1L)).willReturn(new User(1L, "Alice"));\n    \n    mockMvc.perform(get("/users/1")\n        .header("Authorization", "Bearer token"))\n        .andExpect(status().isOk())\n        .andExpect(jsonPath("$.name").value("Alice"));\n}\n\`\`\`\nVerify: status, headers, response body, redirects. Không test thực tế network — dùng \`@SpringBootTest + TestRestTemplate\` hoặc WebTestClient cho full integration test.` },
  { q: '@MockBean và @Mock khác nhau thế nào?',
    a: `**A:** **\`@Mock\`** (Mockito): tạo mock thuần Mockito — không tích hợp Spring context. Dùng với \`@ExtendWith(MockitoExtension.class)\`. **\`@MockBean\`** (Spring Test): tạo Mockito mock **và register nó vào Spring Application Context** — thay thế bean thực trong context. Dùng khi: test có \`@SpringBootTest\` hoặc \`@WebMvcTest\` cần mock một số bean. Ví dụ: \`@WebMvcTest\` + \`@MockBean UserService service\` → controller autowire mock service. \`@MockBean\` cause context reload (slow) — dùng \`@Mock\` khi không cần Spring context (unit test với constructor injection).` },
]),

'sql': qa([
  { q: 'Sự khác biệt giữa HAVING và WHERE?',
    a: `**A:** **\`WHERE\`**: filter rows **trước** khi GROUP BY — không dùng aggregate functions. **\`HAVING\`**: filter groups **sau** GROUP BY — có thể dùng aggregate functions (\`COUNT\`, \`SUM\`, \`AVG\`). Ví dụ: \`SELECT department, COUNT(*) FROM employees WHERE salary > 50000 GROUP BY department HAVING COUNT(*) > 5\`. WHERE lọc employee có salary > 50k trước; HAVING chỉ giữ department có hơn 5 employees sau group. Sai phổ biến: dùng HAVING thay WHERE (chậm hơn — WHERE filter sớm hơn, ít row hơn để group).` },
  { q: 'Giải thích LEFT JOIN và INNER JOIN với ví dụ.',
    a: `**A:** **INNER JOIN**: chỉ trả row có **match trong cả hai bảng**. **LEFT JOIN**: trả **tất cả row của bảng trái** + matched rows từ bảng phải (NULL nếu không match). \`SELECT u.name, o.total FROM users u LEFT JOIN orders o ON u.id = o.user_id\` → user không có order vẫn xuất hiện (order columns = NULL). INNER JOIN → user đó bị loại. Dùng LEFT JOIN: muốn tất cả users kể cả chưa có order. INNER JOIN: chỉ muốn user có order. RIGHT JOIN = LEFT JOIN reversed (ít dùng). FULL OUTER JOIN: tất cả rows từ cả hai bảng.` },
  { q: 'EXPLAIN output trong MySQL có nghĩa gì?',
    a: `**A:** Key columns: \`type\` — access method (tệ nhất → tốt nhất: ALL → index → range → ref → eq_ref → const). \`ALL\` = full table scan. \`key\` — index được dùng (NULL = không dùng index). \`rows\` — estimated rows scanned. \`Extra\` — thêm info: "Using filesort" (sort không dùng index — slow), "Using temporary" (temp table — slow), "Using index" (covering index — fast). Action: nếu \`type=ALL\` và rows nhiều → thêm index. Nếu "Using filesort" → thêm index trên ORDER BY column.` },
]),


'starvation': qa([
  { q: 'Thread starvation là gì và khác deadlock thế nào?',
    a: `**A:** **Starvation**: thread không thể tiến triển vì **liên tục không được cấp resource** (CPU, lock) — các thread khác với priority cao hơn liên tục chiếm. Thread vẫn alive, không bị block mãi, nhưng không được chạy đủ. **Deadlock**: hai hoặc nhiều thread **block nhau** — cả hai chờ resource của nhau → không ai tiến được. Cả hai đều gây progress failure, nhưng nguyên nhân khác: deadlock = circular wait; starvation = unfair scheduling. Phát hiện starvation: thread dump thấy thread ở WAITING/BLOCKED trong thời gian rất dài.` },
  { q: 'Fair lock giải quyết starvation thế nào?',
    a: `**A:** \`ReentrantLock(true)\` — **fair lock**: acquire theo thứ tự FIFO — thread chờ lâu nhất được ưu tiên. Không có starvation. Unfair lock (default): không đảm bảo thứ tự — mỗi thread đến có thể "barge in" (chiếm lock ngay cả khi thread khác đang chờ) → starvation có thể xảy ra. Trade-off: fair lock slower throughput (không exploit thread locality, không barge-in) nhưng đảm bảo fairness. \`synchronized\` không fair. \`Semaphore(permits, fair=true)\` tương tự. Dùng fair lock khi: starvation là concern thực sự; unfair khi throughput quan trọng hơn fairness.` },
  { q: 'Priority inversion là gì?',
    a: `**A:** **Priority inversion**: thread **priority thấp** giữ lock, thread **priority cao** phải chờ lock → effective priority của high-priority thread bị giảm xuống bằng low-priority. Tệ hơn: nếu medium-priority thread không cần lock cứ chiếm CPU → low-priority thread không chạy được → lock không release → high-priority thread chờ mãi. Classic case: Mars Pathfinder 1997 — reset liên tục vì priority inversion. Fix: **Priority inheritance** (OS feature) — low-priority thread giữ lock được tạm nâng priority bằng highest waiter. Java không built-in priority inheritance — dùng \`Lock.tryLock(timeout)\` để avoid indefinite wait.` },
]),

'stateless-services': qa([
  { q: 'Stateless service là gì và tại sao dễ scale hơn?',
    a: `**A:** **Stateless service**: không giữ session state trong memory giữa requests — mỗi request **self-contained** với tất cả cần thiết (token, data). **Stateful**: giữ session state trong memory → cùng user phải route tới cùng instance (sticky session) hoặc state phải sync giữa instances. Scale stateless: thêm instance → load balancer route bất kỳ request đến bất kỳ instance. Scale stateful: cần sticky session (limit flexibility) hoặc distributed session (complexity). Microservices best practice: stateless by design, externalize state ra Redis/DB.` },
  { q: 'Externalize session state thế nào với Spring?',
    a: `**A:** Spring Session: \`spring-session-data-redis\` — tự động store session trong Redis thay vì memory. Config: \`@EnableRedisHttpSession\` + Redis connection. Session ID trong cookie, state trong Redis. Mọi instance share session store → stateless instances. Alternative: JWT (không cần server-side session — token chứa claims, stateless hoàn toàn). JWT stateless: không cần lookup session → faster, nhưng không thể invalidate individual token (chỉ expire). Session + Redis: có thể invalidate bất kỳ session nào (logout force, security revoke).` },
  { q: 'Stateless nghĩa là không dùng database không?',
    a: `**A:** **Không** — stateless nghĩa là không giữ **per-request/session state trong service memory**. Database persist state là fine — đó là **durable shared state**, không phải per-instance state. Stateless service vẫn: read/write DB, read/write cache, call other services. Distinction: nếu restart instance, không có data loss (tất cả state ở DB/cache). Nếu có in-memory Map tích lũy user sessions → restart mất data → stateful. Shopping cart: stateless = store cart trong Redis/DB (persist across instances); stateful = store trong service memory (lost on restart/failover).` },
]),

'states-closed-open-half-open': qa([
  { q: 'Mô tả ba trạng thái của Circuit Breaker.',
    a: `**A:** **CLOSED** (bình thường): request được forward đến service. Đếm failures trong sliding window. Nếu failure rate vượt threshold → chuyển sang OPEN. **OPEN** (circuit trip): request fail ngay lập tức (fast fail) — không gọi service. Sau \`waitDurationInOpenState\` (ví dụ 30s) → chuyển sang HALF-OPEN. **HALF-OPEN** (probe): cho phép N request thử (\`permittedNumberOfCallsInHalfOpenState\`). Nếu success rate OK → CLOSED. Nếu failure vẫn cao → OPEN lại. Mục đích: tránh cascade failure, allow service time to recover.` },
  { q: 'Fallback và circuit breaker kết hợp thế nào?',
    a: `**A:** Circuit breaker OPEN → throw exception (CallNotPermittedException). Fallback method xử lý exception này — return degraded response thay vì propagate error đến user. Ví dụ: Product service down → CB OPEN → ProductFallback: return cached product list hoặc \`"Service temporarily unavailable"\`. Resilience4j:\n\`\`\`java\n@CircuitBreaker(name="product", fallbackMethod="getProductsFallback")\npublic List<Product> getProducts() { ... }\n\nprivate List<Product> getProductsFallback(Exception e) {\n    return cachedProducts; // or empty list\n}\n\`\`\`\nFallback cho phép partial functionality thay vì complete failure.` },
  { q: 'Khi nào circuit breaker không phù hợp?',
    a: `**A:** Circuit breaker không phù hợp khi: (1) **Synchronous critical path**: payment, authentication — không thể fallback với degraded response, cần real answer. (2) **Internal errors** (bugs, validation fail): CB không giúp vì không phải transient failure. (3) **Rare failures**: nếu service rất reliable (<0.1% fail), CB overhead không worth it. (4) **Retry là đủ**: nếu retry giải quyết được (network hiccup), không cần CB. (5) **Batch processing**: không có real-time user waiting → timeout / dead letter queue phù hợp hơn. CB hữu ích nhất cho: external service dependencies với uncertain reliability.` },
]),

'strong-consistency': qa([
  { q: 'Strong consistency đảm bảo gì?',
    a: `**A:** Strong consistency đảm bảo: sau khi write thành công, **mọi subsequent read** (từ bất kỳ node nào) sẽ thấy giá trị đã write — không bao giờ thấy stale data. Giống như single-machine behavior. Implement: (1) Single writer (primary/leader) — mọi write qua một node. (2) Synchronous replication — write không được ack cho đến khi tất cả replicas confirm. (3) Distributed consensus (Raft/Paxos) — majority quorum confirm write trước khi commit. Trade-off: latency cao (phải chờ replicas), availability giảm (network partition → reject write). Dùng: financial transactions, inventory system, leader election.` },
  { q: 'Linearizability và serializability khác nhau thế nào?',
    a: `**A:** **Linearizability**: consistency model cho **single operations** — mỗi operation appear to take effect atomically at a single point in time, results consistent with a sequential order. Real-time constraint: nếu op A hoàn thành trước op B start, A phải appear before B. **Serializability**: isolation level cho **transactions** — concurrent transactions execute as if some serial order. Không cần real-time constraint — serial order không phải wall-clock order. **Strict serializability** = Linearizability + Serializability. Spanner (Google): externally-consistent (strict serializable) distributed transactions.` },
  { q: 'Khi nào strong consistency gây performance problem?',
    a: `**A:** Strong consistency gây latency cao khi: (1) **Geographic distribution** — write phải wait cho remote replicas (Singapore → Frankfurt = 150ms RTT). (2) **High write contention** — many writers qua single leader. (3) **Network partition** — CAP theorem: CP system (strong consistency) sẽ reject requests khi partition xảy ra (availability sacrifice). Giải pháp: (1) Local reads từ nearest replica (compromise: đọc slightly stale). (2) Async replication + read-your-own-writes tracking. (3) Eventual consistency cho non-critical data, strong consistency chỉ khi really need.` },
]),

'structural': qa([
  { q: 'Adapter và Facade pattern khác nhau thế nào?',
    a: `**A:** **Adapter**: chuyển đổi interface **không tương thích** thành interface client expect — wrap existing class để "fit in". Ví dụ: \`OldPaymentProcessor\` có method \`processPayment(amount)\`, nhưng hệ thống mới cần \`pay(Money)\` → Adapter implement \`pay()\` gọi \`processPayment()\`. **Facade**: tạo interface **đơn giản hóa** cho subsystem phức tạp — hide complexity, không nhất thiết phải convert interface. Ví dụ: \`OrderFacade.placeOrder()\` internally gọi \`InventoryService\`, \`PaymentService\`, \`NotificationService\`. Adapter: incompatible interface → compatible. Facade: complex subsystem → simple interface.` },
  { q: 'Decorator pattern dùng thế nào trong Java?',
    a: `**A:** Decorator wrap object để add behavior tại runtime mà không modify class. Java I/O streams là ví dụ điển hình: \`new BufferedInputStream(new FileInputStream("file"))\` — Buffered decorate FileInputStream, thêm buffering. Implement:\n\`\`\`java\ninterface Coffee { double cost(); }\nclass SimpleCoffee implements Coffee { public double cost() { return 1.0; } }\nclass MilkDecorator implements Coffee {\n    Coffee wrapped;\n    public double cost() { return wrapped.cost() + 0.5; }\n}\n\`\`\`\nStack decorators: \`new MilkDecorator(new SugarDecorator(new SimpleCoffee()))\`. Khác inheritance: multiple independent decorators có thể combine, không class explosion.` },
  { q: 'Composite pattern dùng khi nào?',
    a: `**A:** Composite pattern khi cần treat **individual objects và groups of objects uniformly** — tree structure. Interface chung cho cả leaf và composite: \`Component { void render() }\`. \`Leaf implements Component\` (no children). \`Composite implements Component\` (has List<Component> children) — \`render()\` delegate to all children. Ví dụ: File system (File và Directory đều có \`size()\`, \`delete()\`), UI components (Button và Panel đều có \`draw()\`), Menu system (MenuItem và Menu đều có \`click()\`). Client code không cần biết đang deal với leaf hay composite.` },
]),

'synchronization': qa([
  { q: 'synchronized block và synchronized method khác nhau thế nào?',
    a: `**A:** **\`synchronized(this) {...}\`**: chỉ lock trong block scope — cho phép non-synchronized code chạy parallel. **\`synchronized method\`**: lock toàn bộ method, tương đương \`synchronized(this)\` cho instance method hoặc \`synchronized(ClassName.class)\` cho static method. Best practice: **synchronized block** hẹp hơn — chỉ bao quanh critical section, giảm contention. Lock object: instance method = this; static method = Class object. Dùng private lock object: \`private final Object lock = new Object(); synchronized(lock) {...}\` — tránh external code lock cùng object.` },
  { q: 'ReentrantLock có lợi thế gì so với synchronized?',
    a: `**A:** \`ReentrantLock\` features mà \`synchronized\` không có: (1) **\`tryLock()\`**: non-blocking attempt — return false nếu không acquire được (tránh deadlock). (2) **\`tryLock(timeout)\`**: wait tối đa timeout. (3) **Fair lock**: constructor \`new ReentrantLock(true)\`. (4) **Interruptible lock**: \`lockInterruptibly()\` — thread có thể interrupted khi waiting. (5) **Multiple conditions**: \`lock.newCondition()\` — nhiều wait sets. (6) **Non-block-structured unlock**: lock và unlock có thể ở different methods. Trade-off: phải manually unlock (dùng try-finally). \`synchronized\` simpler nhưng ít flexible hơn.` },
  { q: 'StampedLock là gì và khi nào dùng?',
    a: `**A:** \`StampedLock\` (Java 8): optimistic read lock — không block writers. Modes: (1) **Write lock**: exclusive. (2) **Read lock**: shared, block writers. (3) **Optimistic read**: \`stamp = lock.tryOptimisticRead()\` — không block, không acquire actual lock → read → \`validate(stamp)\` kiểm tra không có write trong khi đọc. Nếu validate fail → upgrade sang read lock và retry. Pattern:\n\`\`\`java\nlong stamp = lock.tryOptimisticRead();\nint x = this.x, y = this.y;\nif (!lock.validate(stamp)) {\n    stamp = lock.readLock();\n    try { x = this.x; y = this.y; }\n    finally { lock.unlockRead(stamp); }\n}\n\`\`\`\nTốt cho read-heavy workloads.` },
]),

'testcontainers': qa([
  { q: 'TestContainers giải quyết vấn đề gì trong integration testing?',
    a: `**A:** Integration test cần real dependency (DB, Redis, Kafka) — mock không đủ faithful. Options: (1) Shared dev database — data contamination, parallel test conflict. (2) H2 in-memory — không match production DB behavior (SQL dialect, features). (3) **TestContainers**: start **real Docker container** per test suite — isolated, real DB, tear down after test. Spring Boot 3.1+: \`@ServiceConnection\` annotation tự động configure connection đến container. Ví dụ:\n\`\`\`java\n@Container\nstatic PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");\n\`\`\`\nTest chạy chậm hơn H2 nhưng catch real issues.` },
  { q: 'Cách dùng TestContainers với Spring Boot 3.1+ thế nào?',
    a: `**A:** Spring Boot 3.1 tích hợp TestContainers với \`@ServiceConnection\`:\n\`\`\`java\n@SpringBootTest\n@Testcontainers\nclass UserRepositoryTest {\n    @Container\n    @ServiceConnection\n    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");\n    \n    @Autowired UserRepository repo;\n    \n    @Test\n    void testSave() {\n        repo.save(new User("Alice"));\n        assertThat(repo.count()).isEqualTo(1);\n    }\n}\n\`\`\`\n\`@ServiceConnection\` tự detect container type → auto-configure Spring DataSource. Không cần manually set URL/credentials. Dùng \`static\` container → shared across test methods trong class (faster).` },
  { q: 'TestContainers vs H2 in-memory: khi nào dùng cái nào?',
    a: `**A:** **H2 in-memory**: nhanh (không start Docker), đủ cho unit test logic, không cần Docker. Nhưng: behavior khác PostgreSQL/MySQL (type system, locking, specific functions). **TestContainers**: slower startup (pull image, start container), nhưng **real database** — test catch production issues. Chọn: H2 cho service unit test (mock repository); TestContainers cho repository/integration test cần production-like behavior. Rule: nếu test query phức tạp (window functions, JSON operations, specific index behavior) → TestContainers. Nếu đơn giản CRUD → H2 acceptable. Hybrid: H2 cho local rapid dev, TestContainers trong CI.` },
]),

'token-bucket': qa([
  { q: 'Token bucket algorithm hoạt động thế nào?',
    a: `**A:** Bucket chứa tối đa **N tokens**. Token được **refill theo tốc độ cố định** (ví dụ 100 tokens/giây). Mỗi request consume 1 token (hoặc nhiều cho weighted). Request được allow khi: có đủ tokens → consume → process. Request bị reject khi: không đủ tokens → 429 rate limited. Key property: cho phép **burst** — nếu ít request trong thời gian dài, bucket đầy token → burst ngắn được allow. Khác leaky bucket: leaky bucket smooth output, không cho burst. Bucket4j (Java): production-grade token bucket implementation hỗ trợ local và distributed (Redis) storage.` },
  { q: 'Tại sao token bucket phù hợp cho API rate limiting hơn fixed counter?',
    a: `**A:** **Fixed counter** (fixed window): đếm requests trong window — 100 req/minute. Vấn đề: 100 request trong giây cuối window + 100 request giây đầu window tiếp = 200 req trong 2 giây (burst). **Token bucket**: refill continuous (không per-window) → không có boundary burst issue. Burst controlled: chỉ burst đến bucket capacity. Smooth handling: client có thể burst ngắn hạn (legitimate) mà không bị penalize. API response: include \`X-RateLimit-Remaining\` (tokens left), \`X-RateLimit-Reset\` (khi nào refill đủ). Thực tế: Stripe, GitHub API dùng token bucket.` },
  { q: 'Làm thế nào để implement token bucket với Redis?',
    a: `**A:** Lua script atomic (đảm bảo atomicity):\n\`\`\`lua\nlocal tokens = tonumber(redis.call('GET', KEYS[1]) or ARGV[1])\nlocal now = tonumber(ARGV[2])\nlocal last = tonumber(redis.call('GET', KEYS[2]) or now)\nlocal rate = tonumber(ARGV[3])   -- tokens per second\nlocal capacity = tonumber(ARGV[1])\nlocal refill = math.min(capacity, tokens + (now - last) * rate)\nif refill >= 1 then\n    redis.call('SET', KEYS[1], refill - 1)\n    redis.call('SET', KEYS[2], now)\n    return 1  -- allowed\nend\nreturn 0  -- rejected\n\`\`\`\nKEYS[1]=tokens_key, KEYS[2]=last_time_key. Hoặc dùng Bucket4j với \`ProxyManager\` cho Redis integration.` },
]),

'topic-partition-offset': qa([
  { q: 'Topic, partition, và offset trong Kafka là gì?',
    a: `**A:** **Topic**: logical category/stream — ví dụ "orders", "payments". **Partition**: topic được chia thành N partitions — mỗi partition là append-only ordered log. Nhiều partitions cho phép parallel consumption. **Offset**: vị trí (sequential number) của message trong partition — bắt đầu từ 0, tăng dần. Consumer track offset đã đọc. Consumer group: mỗi partition được consume bởi **một consumer** (trong group) — offset per partition per consumer group được commit vào Kafka. Reread: set offset về trước (\`--reset-offsets\`) → reprocess messages. Retention: message giữ trong N ngày/hours dù đã consumed.` },
  { q: 'Tại sao nhiều partition trong Kafka quan trọng?',
    a: `**A:** (1) **Parallelism**: consumer group consume parallel — N partitions cho phép N consumers xử lý song song. 1 partition = 1 consumer max (bottleneck). (2) **Throughput**: producer write parallel vào nhiều partitions. (3) **Distribution**: partitions spread across brokers — no single broker bottleneck. Cân nhắc: nhiều partition quá → overhead (Zookeeper/KRaft, file handles, replication). Rule of thumb: target_throughput / single_partition_throughput. Rebalancing: thêm partition sau → cùng key có thể vào partition khác → break ordering per-key.` },
  { q: 'Consumer group offset commit thế nào?',
    a: `**A:** Consumer commit offset để mark "đã xử lý đến đây". \`enable.auto.commit=true\` (default): auto commit định kỳ (\`auto.commit.interval.ms=5000\`) — risk: commit trước khi xử lý xong → tắt process giữa chừng → message bị mất (committed nhưng chưa process). **Manual commit**: \`enable.auto.commit=false\` → sau khi xử lý thành công gọi \`consumer.commitSync()\` hoặc \`commitAsync()\`. At-least-once: commit sau xử lý. Exactly-once: transactional API. Spring Kafka \`@KafkaListener\` với \`AckMode=MANUAL\`: gọi \`acknowledgment.acknowledge()\` sau process.` },
]),


'treemap-linkedhashmap': qa([
  { q: 'TreeMap, LinkedHashMap, và HashMap khác nhau thế nào?',
    a: `**A:** **HashMap**: O(1) average get/put, **không đảm bảo thứ tự**. **LinkedHashMap**: O(1) get/put, giữ **insertion order** (hoặc access order nếu \`accessOrder=true\`). **TreeMap**: O(log n) get/put, sorted theo **natural order** của key (hoặc Comparator). Dùng: HashMap khi chỉ cần lookup nhanh. LinkedHashMap khi cần iteration theo insertion order (LRU cache với accessOrder=true). TreeMap khi cần key sorted (range query: \`subMap(fromKey, toKey)\`, \`headMap\`, \`tailMap\`). Cả ba không thread-safe — \`Collections.synchronizedMap\` hoặc \`ConcurrentHashMap\`/\`ConcurrentSkipListMap\`.` },
  { q: 'Implement LRU cache dùng LinkedHashMap thế nào?',
    a: `**A:** LinkedHashMap với \`accessOrder=true\` và override \`removeEldestEntry\`:\n\`\`\`java\npublic class LRUCache<K, V> extends LinkedHashMap<K, V> {\n    private final int capacity;\n    LRUCache(int capacity) {\n        super(capacity, 0.75f, true); // accessOrder=true\n        this.capacity = capacity;\n    }\n    @Override\n    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {\n        return size() > capacity;\n    }\n}\n\`\`\`\nEach get/put moves entry to tail → eldest (LRU) = head. Khi \`removeEldestEntry\` return true → oldest entry auto-removed. Thread-safe version: \`Collections.synchronizedMap(new LRUCache<>(...)))\`. Production: dùng Caffeine / Guava Cache với proper LRU/LFU.` },
  { q: 'TreeMap range query hoạt động thế nào?',
    a: `**A:** TreeMap implement \`NavigableMap\` — rich API cho range operations: \`subMap(fromKey, fromInclusive, toKey, toInclusive)\`: entries trong range. \`headMap(toKey)\`: entries < toKey. \`tailMap(fromKey)\`: entries >= fromKey. \`floorKey(key)\`: largest key ≤ given. \`ceilingKey(key)\`: smallest key ≥ given. \`firstKey()\`/\`lastKey()\`: min/max. Ví dụ: \`treeMap.subMap("2024-01-01", "2024-12-31")\` → tất cả entries trong năm 2024. Dùng cho: date range queries, alphabetical range, price range.` },
]),

'try-with-resources': qa([
  { q: 'Try-with-resources đảm bảo gì so với try-finally?',
    a: `**A:** Try-with-resources: \`try (Resource r = new Resource()) { ... }\` → \`r.close()\` tự động gọi khi exit block (normal hoặc exception). Đảm bảo close **ngay cả khi exception xảy ra trong block**. So với try-finally: (1) Không thể "forget" close. (2) Nếu cả body và close() throw exception → body exception được propagate, close exception được **suppressed** (accessible qua \`e.getSuppressed()\`). Với try-finally: close exception sẽ **swallow** body exception (mất thông tin). Multiple resources: \`try (A a = new A(); B b = new B())\` — close theo thứ tự **ngược lại** (B rồi A).` },
  { q: 'AutoCloseable và Closeable khác nhau thế nào?',
    a: `**A:** **\`Closeable\`** (Java 5): extends AutoCloseable, \`close()\` throws \`IOException\` — I/O resources (Stream, Reader, Writer). **\`AutoCloseable\`** (Java 7): \`close()\` throws \`Exception\` — broader, cho mọi resource. Try-with-resources hoạt động với bất kỳ class implement \`AutoCloseable\`. Implement custom: \`class DBConnection implements AutoCloseable { public void close() { conn.close(); } }\`. Idempotent close: best practice — gọi close() nhiều lần không gây error. \`Closeable\` contract: close() idempotent. \`AutoCloseable\` không require idempotent.` },
  { q: 'Có thể dùng try-with-resources với existing resource không?',
    a: `**A:** Không trực tiếp — try-with-resources chỉ close resource được **declare trong parentheses**. Nếu resource tạo trước block: wrap:\n\`\`\`java\nConnection conn = getExistingConnection();\ntry (conn) { // Java 9+ effective final variable\n    // use conn\n} // conn.close() called\n\`\`\`\nJava 9+ cho phép reference đến existing effectively-final AutoCloseable variable trực tiếp trong try-with-resources. Java 7-8: cần assign vào local: \`try (Connection c = conn) {...}\`. Cẩn thận: nếu outer code vẫn giữ reference → resource đã bị closed.` },
]),

'tuning-connection-pool': qa([
  { q: 'Cách tìm connection pool size phù hợp cho HikariCP?',
    a: `**A:** Formula từ PostgreSQL wiki: \`pool_size = (core_count × 2) + effective_spindle_count\`. Với SSD/NVMe: effective_spindle = 1. 8 cores → pool = 17. Nhưng đây là starting point — phải đo. Process: (1) Set pool size nhỏ (10), load test. (2) Monitor: \`hikaricp.connections.pending\` (waiting) và \`hikaricp.connections.usage\` (active). (3) Nếu pending > 0 thường xuyên → tăng. (4) Nếu DB CPU idle nhưng latency cao → bottleneck không phải pool size. HikariCP: \`maximumPoolSize\`, \`minimumIdle\`, \`connectionTimeout=30000\`.` },
  { q: 'Connection pool exhaustion dẫn đến gì?',
    a: `**A:** Tất cả connections đang dùng, request mới → chờ trong queue. Nếu chờ quá \`connectionTimeout\` (HikariCP default 30s) → \`SQLTimeoutException: Connection is not available, request timed out after 30000ms\`. Cascade: nhiều thread timeout → request queue backup → OutOfMemoryError. Triệu chứng: thread dump thấy nhiều thread blocked tại connection acquisition. Nguyên nhân thường: (1) Slow queries hold connection lâu. (2) Transaction không close đúng cách. (3) Pool size quá nhỏ cho load. Fix: increase pool size (short-term), fix slow queries, optimize transaction scope.` },
  { q: 'Leak detection trong HikariCP là gì?',
    a: `**A:** \`leakDetectionThreshold\` (HikariCP): nếu connection được hold lâu hơn threshold (ví dụ 2000ms = 2s) → log warning với stack trace của caller. Giúp phát hiện: connection không close, long-running transaction, forgetting to close ResultSet. Config: \`spring.datasource.hikari.leak-detection-threshold=2000\`. Trong test: đặt threshold nhỏ (200ms) để phát hiện leak. Không nên enable trong production với threshold quá thấp — false positive warning. Log: \`[HikariPool-1] Connection leak detection triggered for ... stack trace\`.` },
]),

'unit-test': qa([
  { q: 'Unit test tốt có những đặc điểm nào?',
    a: `**A:** **F.I.R.S.T** principles: **F**ast (run trong ms, không I/O), **I**solated (không depend vào external system, không shared state giữa tests), **R**epeatable (cùng result mỗi lần run, bất kể environment), **S**elf-validating (assert clearly pass/fail, không cần manual check), **T**imely (viết cùng lúc với code, không sau). Thêm: **one assertion per test** (hoặc ít nhất một concept per test), **descriptive name** (\`givenValidUser_whenSave_thenReturnId\`), **AAA pattern** (Arrange, Act, Assert). Test nhỏ, fast, không depend vào nhau.` },
  { q: 'Test coverage 100% có nghĩa là code không có bug không?',
    a: `**A:** **Không** — 100% line coverage chỉ nghĩa là mọi line được execute ít nhất một lần, không đảm bảo đúng behavior. Vấn đề: (1) Test không có meaningful assertion. (2) Branch coverage thấp — test một path nhưng không test branch khác. (3) Không test edge cases (null, empty, boundary values). (4) Integration issues không được cover bởi unit test. (5) Race conditions, memory leak, performance không được detect. Coverage là **necessary but not sufficient** — 70-80% meaningful coverage > 100% coverage với bad tests. Focus: mutation testing (PIT) để verify test quality.` },
  { q: 'Given-When-Then (GWT) pattern là gì?',
    a: `**A:** GWT (BDD-style) structure test để rõ ràng: **Given** (Arrange): setup preconditions, test data, mocks. **When** (Act): execute action under test. **Then** (Assert): verify expected outcome. Ví dụ:\n\`\`\`java\n@Test\nvoid givenInsufficientFunds_whenWithdraw_thenThrowException() {\n    // Given\n    Account account = new Account(50.0);\n    // When / Then\n    assertThrows(InsufficientFundsException.class,\n        () -> account.withdraw(100.0));\n}\n\`\`\`\nBenefit: test là executable documentation — đọc test biết behavior. Thay vì AAA comment, dùng GWT style cho BDD test với Cucumber/Serenity. Nhất quán hơn khi có tên test method follow "given_when_then".` },
]),

'visibility-ordering': qa([
  { q: 'Happens-before relationship là gì?',
    a: `**A:** Happens-before (HB) là **ordering guarantee** trong Java Memory Model: nếu action A HB action B → B sees effect của A — không bị reordering. HB rules: (1) Program order rule: statement trước HB statement sau trong cùng thread. (2) Monitor lock rule: unlock HB subsequent lock on same monitor. (3) Volatile rule: write to volatile HB subsequent read of same volatile. (4) Thread start rule: \`Thread.start()\` HB mọi action trong thread đó. (5) Thread join rule: mọi action trong thread HB return của \`Thread.join()\`. HB: nếu không có HB ordering → CPU/compiler có thể reorder → **visibility problem**.` },
  { q: 'Tại sao double-checked locking cần volatile?',
    a: `**A:** DCL pattern cho singleton:\n\`\`\`java\nprivate static volatile Singleton instance;\nstatic Singleton getInstance() {\n    if (instance == null) {\n        synchronized (Singleton.class) {\n            if (instance == null)\n                instance = new Singleton();\n        }\n    }\n    return instance;\n}\n\`\`\`\n**Tại sao volatile?** \`instance = new Singleton()\` là 3 bước: (1) alloc memory, (2) init object, (3) assign reference. Không volatile: JIT có thể reorder → assign reference trước khi init xong → thread khác thấy non-null instance nhưng object chưa init. \`volatile\` đảm bảo write complete trước khi visible. Java 5+: DCL với volatile là thread-safe.` },
  { q: 'Instruction reordering gây vấn đề gì trong concurrent code?',
    a: `**A:** CPU và JIT compiler reorder instructions để optimize — safe trong single-thread (không thay đổi observable behavior), nhưng gây issue trong multi-thread. Ví dụ: Thread A: \`data = 42; ready = true;\` → compiler reorder → \`ready = true; data = 42;\`. Thread B: \`if (ready) print(data);\` → thấy \`ready=true\` nhưng \`data\` chưa được write → print uninitialized value. Fix: \`volatile boolean ready\` → establish happens-before, prohibit reorder. Hoặc \`synchronized\`. \`volatile\` ngăn reorder với volatile field nhưng không ngăn reorder các write khác xung quanh nó (chỉ HB rule).` },
]),

'wait-notify': qa([
  { q: 'wait() và sleep() khác nhau thế nào?',
    a: `**A:** **\`Thread.sleep(ms)\`**: thread ngủ một khoảng thời gian, **giữ lock** — thread khác không access synchronized block được. Dùng cho delay/timing. **\`Object.wait()\`**: thread ngủ và **release lock** — thread khác có thể enter synchronized block. Phải call trong synchronized block (sinon \`IllegalMonitorStateException\`). Wait thường kết hợp với condition check + notify. \`wait()\` có thể return sớm hơn (spurious wakeup) → luôn check condition trong \`while\` loop:\n\`\`\`java\nsynchronized(lock) {\n    while (!condition) lock.wait();\n    // proceed\n}\n\`\`\`` },
  { q: 'notify() và notifyAll() khác nhau thế nào?',
    a: `**A:** **\`notify()\`**: wake up **một** thread đang wait trên object này — JVM chọn arbitrary. **\`notifyAll()\`**: wake up **tất cả** threads đang wait — tất cả wake up, compete lại cho lock, chỉ một win. Khi nào dùng notifyAll: (1) Nhiều loại condition khác nhau — producer/consumer có thể có producer wait và consumer wait khác nhau. \`notify()\` có thể wake up wrong thread. (2) Không chắc chắn ai cần được wake — safe default. notifyAll chậm hơn (wake nhiều thread, thrashing) nhưng correct hơn. Với \`Condition\` (ReentrantLock): \`condition.signal()\` và \`condition.signalAll()\` — có thể có **multiple conditions per lock**.` },
  { q: 'Spurious wakeup là gì và tại sao phải dùng while loop?',
    a: `**A:** **Spurious wakeup**: \`wait()\` return mà không bị \`notify()\`/\`notifyAll()\` gọi — do OS/hardware interrupt. POSIX spec explicitly allow this. Nếu dùng \`if (!condition) wait()\`: sau spurious wakeup → condition vẫn false → code tiếp tục với wrong state. **Giải pháp**: luôn dùng \`while\`:\n\`\`\`java\nwhile (!condition) {\n    object.wait();\n}\n\`\`\`\nSau mỗi wakeup (spurious hay real): re-check condition → nếu false → wait lại. Pattern đúng 100% theo Java docs và concurrency best practices. \`Condition.await()\` cũng có spurious wakeup — same rule.` },
]),

'when-to-mock': qa([
  { q: 'Khi nào nên mock và khi nào không nên?',
    a: `**A:** **Nên mock**: (1) External system (email service, payment API, SMS) — slow, side effects, cost. (2) Time-dependent code (\`LocalDateTime.now()\`) — inject \`Clock\` và mock. (3) Non-deterministic behavior (random, network latency). (4) Isolate SUT — test một class mà không cần init toàn bộ dependency graph. **Không nên mock**: (1) Value objects, DTOs — không có logic. (2) Repository → dùng \`@DataJpaTest\` với real DB thay vì mock. (3) Simple utility (Math, String) — overhead không worth it. (4) Khi mock phức tạp hơn actual impl — sign to use real object.` },
  { q: 'Over-mocking là gì và vấn đề gì?',
    a: `**A:** Over-mocking: mock quá nhiều dependencies → test brittle và không meaningful. Vấn đề: (1) Test verify implementation details (mock interactions) thay vì behavior — refactor làm test break dù behavior đúng. (2) False confidence: mock ≠ real behavior → test pass nhưng production fail. (3) Test maintenance burden: thay đổi internal implementation → phải update nhiều mock setup. (4) Test không catch integration issues. **Guideline**: prefer testing behavior over implementation. Nếu test phụ thuộc nhiều vào \`verify(mock.method()...)\` thay vì assert output → over-mocked. Prefer integration test hoặc narrower unit test.` },
  { q: 'Spy trong Mockito dùng khi nào?',
    a: `**A:** \`@Spy\` (partial mock): wrap real object, real methods được gọi mặc định — có thể stub specific methods. Dùng khi: muốn test class thực nhưng cần stub một method cụ thể (ví dụ method gọi external service). Ví dụ:\n\`\`\`java\n@Spy\nEmailService emailService = new EmailService();\n// Stub chỉ sendEmail để tránh thực sự gửi email\ndoReturn(true).when(emailService).sendEmail(any());\n// Các method khác vẫn gọi real implementation\n\`\`\`\nKhác \`@Mock\`: mock tất cả methods return default (null/0/false). Cẩn thận với spy: dùng \`doReturn()\` thay vì \`when().thenReturn()\` — khi stubbing spy, \`when()\` gọi real method trước khi stub.` },
]),

'when-to-use-nosql': qa([
  { q: 'Khi nào nên chọn NoSQL thay vì relational database?',
    a: `**A:** Chọn NoSQL khi: (1) **Schema flexible**: schema thay đổi thường xuyên, document structure vary per record (product catalog với different attributes). (2) **Horizontal scale write-heavy**: cần scale writes across nodes (RDBMS khó shard write). (3) **Specific data model**: graph data (Neo4j), time series (InfluxDB), full-text search (Elasticsearch). (4) **Very high throughput**: Redis cho caching, Cassandra cho IoT sensor data (write-heavy, time-ordered). (5) **Simple access pattern**: no complex JOIN. Tránh NoSQL khi: cần ACID transactions across documents, complex reporting với ad-hoc queries, data highly relational.` },
  { q: 'MongoDB khi nào phù hợp hơn PostgreSQL?',
    a: `**A:** MongoDB phù hợp: (1) **Document-oriented data**: mỗi document tự chứa related data (user profile + preferences + settings) — không cần JOIN. (2) **Nested/hierarchical data**: product catalog với deeply nested specs. (3) **Rapid iteration**: schema-less cho phép thêm field mà không migration. (4) **High write throughput with sharding**: Mongo built-in sharding. PostgreSQL phù hợp: relational data với nhiều JOINs, cần ACID full compliance, complex reporting, financial data. Thực tế: PostgreSQL có JSONB (document-like) — nhiều team dùng Postgres với JSONB thay vì MongoDB để tránh complexity.` },
  { q: 'Eventual consistency trong NoSQL ảnh hưởng thế nào đến application?',
    a: `**A:** Eventual consistency: sau write, read từ replica khác nhau có thể return stale data — data "eventually" consistent. Application phải handle: (1) **Read-your-own-writes**: sau user update profile, read có thể thấy old data → route read đến primary. (2) **Lost updates**: hai concurrent writes cùng document → last write wins (hoặc conflict) → implement optimistic concurrency. (3) **Non-monotonic reads**: read A thấy new value, read B thấy old value → confusing UX. Patterns: accept eventual consistency (social feed OK if slightly stale), use consistent read when needed (Mongo \`{readConcern: "linearizable"}\`), design for idempotency.` },
]),

'window-functions': qa([
  { q: 'Window function khác GROUP BY thế nào?',
    a: `**A:** **GROUP BY**: collapse nhiều rows thành **một row per group** — mất individual row data. **Window function** (OVER): tính aggregate **giữ nguyên individual rows** — mỗi row có thêm computed column dựa trên window. Ví dụ: \`SELECT name, salary, AVG(salary) OVER (PARTITION BY department) AS dept_avg FROM employees\` → mỗi employee row có thêm avg salary của department mình. GROUP BY: \`SELECT department, AVG(salary) FROM employees GROUP BY department\` → chỉ còn department rows. Dùng window function khi: cần so sánh row với aggregate của nhóm của nó.` },
  { q: 'PARTITION BY và ORDER BY trong OVER clause là gì?',
    a: `**A:** \`OVER (PARTITION BY col1 ORDER BY col2)\`: **PARTITION BY**: chia rows thành partitions — window function tính riêng trong mỗi partition (tương tự GROUP BY nhưng không collapse). **ORDER BY**: sắp xếp rows trong partition — quan trọng cho running total, rank, lag/lead. Ví dụ: \`ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC)\` → rank nhân viên trong mỗi department theo salary. \`SUM(salary) OVER (PARTITION BY department ORDER BY hire_date)\` → running total salary theo hire date trong mỗi department.` },
  { q: 'LAG và LEAD function dùng để làm gì?',
    a: `**A:** **\`LAG(col, offset, default)\`**: truy cập giá trị của row **trước đó** N rows trong window. **\`LEAD(col, offset, default)\`**: truy cập giá trị của row **tiếp theo** N rows. Default: giá trị trả về khi không có row (đầu/cuối window). Ví dụ: month-over-month growth:\n\`\`\`sql\nSELECT month, revenue,\n       LAG(revenue, 1, 0) OVER (ORDER BY month) AS prev_revenue,\n       revenue - LAG(revenue, 1, 0) OVER (ORDER BY month) AS growth\nFROM monthly_sales;\n\`\`\`\nDùng: time-series analysis (price change, velocity), compare with previous/next row, detect gaps.` },
]),

'write-through-write-behind': qa([
  { q: 'Write-through và write-behind (write-back) cache khác nhau thế nào?',
    a: `**A:** **Write-through**: write đến **cả cache và database đồng thời** — data luôn consistent giữa cache và DB. Mỗi write có latency của DB. **Write-behind (write-back)**: write chỉ đến **cache trước**, database được update **async sau** (batched) — faster writes, nhưng data loss nếu cache fail trước khi flush. Use case: write-through cho financial/critical data (consistency quan trọng). Write-behind cho high-write-throughput, loss-tolerant (analytics events, logs, leaderboard). Redis hỗ trợ cả hai qua custom logic — native write-behind qua Lua scripts hoặc Redis keyspace notifications.` },
  { q: 'Write-around cache là gì?',
    a: `**A:** Write-around: write trực tiếp vào **database**, bỏ qua cache hoàn toàn. Data được load vào cache khi có read request (read-through/cache-aside). Dùng khi: write-once, read-never (or rarely) data — ví dụ log events, historical records. Tránh "cache pollution" — không cache data hiếm khi được read. Benefit: giảm cache space cho data không cần thiết. Trade-off: read sau write không thấy trong cache → cache miss → read từ DB. Pattern: combine write-around với TTL-based eviction — eventual ly unused data expire khỏi cache.` },
  { q: 'Cache thundering herd trong write scenario là gì?',
    a: `**A:** Khi cache entry expire và nhiều request cùng lúc miss → tất cả race đến DB để load — **thundering herd** hay **cache stampede**. Với write-through: giảm thundering herd vì cache luôn warm sau write. Fix cho cache-aside: (1) **Mutex/lock**: chỉ một request fetch từ DB, other wait và reuse result. (2) **Probabilistic refresh**: refresh cache một khoảng thời gian trước expiry (random, theo XFetch algorithm). (3) **Stale-while-revalidate**: return stale data cho request đến trong khi refresh async. Redis solution: \`SET key value PX ttl NX\` để check-and-set atomically.` },
]),

};

for (const [key, newSection] of Object.entries(QA)) {
  const filePath = path.join(dir, `${key}.md`);
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    console.log(`SKIP (not found): ${key}.md`);
    continue;
  }
  if (content.includes('<details>')) {
    console.log(`SKIP (already done): ${key}.md`);
    continue;
  }
  const updated = replaceQA(content, newSection);
  if (!updated) {
    console.log(`SKIP (no Q section): ${key}.md`);
    continue;
  }
  writeFileSync(filePath, updated, 'utf8');
  console.log(`UPDATED: ${key}.md`);
}
