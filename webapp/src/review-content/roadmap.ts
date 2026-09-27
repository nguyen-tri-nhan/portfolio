// Hand-written — unlike topics.ts this file is NOT generated. Every `file` must
// exist in topics.ts; names are resolved from there so they never drift.

/** Pseudo file key the review page uses to show the roadmap instead of a markdown topic. */
export const ROADMAP_KEY = '__roadmap__'

export interface RoadmapTopic {
  file: string
  why: string
}

export interface RoadmapGroup {
  title: string
  topics: RoadmapTopic[]
}

export interface RoadmapStage {
  id: string
  level: string
  title: string
  duration: string
  goal: string
  groups: RoadmapGroup[]
  exitCriteria: string[]
  notYet: string[]
}

export interface RoadmapElective {
  title: string
  when: string
  files: string[]
}

export const ROADMAP_STAGES: RoadmapStage[] = [
  {
    id: 'stage-0',
    level: 'Fresher',
    title: 'Nền tảng — viết được 1 API chạy đúng',
    duration: '0 – 6 tháng',
    goal: 'Một ngôn ngữ, một framework, một database — hiểu đủ sâu để tự build và tự debug một CRUD service.',
    groups: [
      {
        title: 'Java cốt lõi',
        topics: [
          { file: 'oop', why: 'Mọi code review đều dựa trên việc bạn thiết kế class có hợp lý không.' },
          { file: 'interface-vs-abstract-class', why: 'Câu phỏng vấn fresher kinh điển, và là nền của DI trong Spring.' },
          { file: 'collections', why: 'Dùng hằng ngày — chọn sai List/Map là bug hoặc chậm.' },
          { file: 'java-generics', why: 'Đọc được chữ ký API của JDK/Spring: <? extends T>, <? super T>.' },
          { file: 'string-immutability', why: 'String Pool, == vs equals, StringBuilder — câu hỏi fresher gặp nhiều nhất.' },
          { file: 'equals-hashcode-contract', why: 'Sai hợp đồng equals/hashCode = HashSet chứa phần tử trùng, Map "mất" key.' },
          { file: 'hashmap-internals', why: 'Bucket, collision, treeify — câu hỏi HashMap kinh điển.' },
          { file: 'exception-handling', why: 'Phân biệt lỗi nghiệp vụ và lỗi hệ thống từ ngày đầu.' },
          { file: 'java-7-8', why: 'Lambda, Stream, Optional có trong mọi codebase Java hiện đại.' },
        ],
      },
      {
        title: 'Database cơ bản',
        topics: [
          { file: 'sql', why: 'ORM không thay được SQL — bạn vẫn phải đọc và viết query.' },
          { file: 'joins', why: 'Phần lớn query thực tế là JOIN.' },
          { file: 'group-by-having', why: 'Report, thống kê, dashboard đều cần.' },
          { file: 'b-tree-index', why: 'Biết index là gì trước khi học tối ưu query.' },
        ],
      },
      {
        title: 'Nền tảng khoa học máy tính',
        topics: [
          { file: 'big-o-complexity', why: 'Biết code có chịu nổi khi dữ liệu tăng 1000 lần không.' },
          { file: 'core-data-structures', why: 'Chọn đúng collection quan trọng hơn thuật toán thông minh.' },
          { file: 'algorithm-patterns', why: 'Vòng coding interview của hầu hết công ty.' },
          { file: 'http-fundamentals', why: 'Method, status code, idempotency — nền của mọi REST API.' },
        ],
      },
      {
        title: 'Spring Boot & REST',
        topics: [
          { file: 'dependency-injection', why: 'Không hiểu DI thì Spring chỉ là "phép màu".' },
          { file: 'ioc-container', why: 'Biết bean được tạo ra từ đâu khi app không start được.' },
          { file: 'spring-boot', why: 'Framework bạn sẽ dùng mỗi ngày.' },
          { file: 'request-flow', why: 'Debug được request đi qua filter → controller → service.' },
          { file: 'restful-design', why: 'Thiết kế URL, status code đúng chuẩn.' },
        ],
      },
      {
        title: 'Test & công cụ',
        topics: [
          { file: 'unit-test', why: 'PR không có test thường không được merge.' },
          { file: 'mockito-mock-spy-captor', why: 'Test service mà không cần DB thật.' },
          { file: 'git-fundamentals', why: 'Commit, branch, cứu dữ liệu bằng reflog — dùng từ ngày đầu.' },
          { file: 'file-process', why: 'SSH vào server xem log là việc tuần đầu tiên.' },
          { file: 'image-container-layer', why: 'Local dev ở hầu hết công ty đều chạy bằng Docker.' },
        ],
      },
    ],
    exitCriteria: [
      'Tự build được REST API CRUD với Spring Boot + PostgreSQL/MySQL, chạy bằng Docker',
      'Có unit test cho tầng service, dùng Mockito',
      'Giải thích được DI là gì và vì sao không tự new object trong service',
      'Giải thích được HashMap hoạt động thế nào và index giúp query nhanh hơn ra sao',
      'Đọc được stack trace và tự tìm ra dòng gây lỗi',
    ],
    notYet: [
      'Microservices, Kafka, Kubernetes — học khi chưa làm tốt monolith sẽ chỉ nhớ thuật ngữ',
      'JVM internals, GC tuning — chưa có vấn đề thật để áp dụng',
      'System design phân tán (sharding, CAP, consistent hashing)',
      'Học 2-3 framework cùng lúc (Spring + Quarkus + NestJS…)',
    ],
  },
  {
    id: 'stage-1',
    level: 'Junior',
    title: 'Tự chủ một feature — đúng, an toàn, không chậm',
    duration: '6 – 18 tháng',
    goal: 'Nhận một ticket và tự đưa nó lên production: xử lý transaction, bảo mật, concurrency và query chậm mà không cần người kèm.',
    groups: [
      {
        title: 'Database nghiêm túc',
        topics: [
          { file: 'transactions', why: 'Lỗi mất tiền/mất dữ liệu thường đến từ transaction sai.' },
          { file: 'isolation-levels', why: 'Hiểu vì sao 2 request đồng thời cho ra dữ liệu sai.' },
          { file: 'jpa-hibernate', why: 'ORM giúp nhanh nhưng dễ tạo query ẩn.' },
          { file: 'n-1-problem', why: 'Nguyên nhân chậm số 1 của app dùng JPA.' },
          { file: 'lazy-loading', why: 'LazyInitializationException — lỗi ai cũng gặp.' },
          { file: 'composite-index', why: 'Index sai thứ tự cột = không dùng được.' },
          { file: 'oc-explain-plan', why: 'Không đoán — đọc EXPLAIN để biết query chậm vì sao.' },
          { file: 'connection-pool-hikaricp', why: 'Pool cạn là nguyên nhân phổ biến của timeout.' },
          { file: 'flyway-migration', why: 'Schema được version hóa, review được, không dùng ddl-auto ở production.' },
        ],
      },
      {
        title: 'Concurrency cơ bản',
        topics: [
          { file: 'thread-lifecycle', why: 'Nền để hiểu mọi thứ phía sau.' },
          { file: 'race-condition', why: 'Bug chỉ xảy ra khi có tải — khó reproduce nhất.' },
          { file: 'synchronized-keyword', why: 'Công cụ đầu tiên để bảo vệ shared state.' },
          { file: 'volatile', why: 'Hiểu visibility trước khi học memory model.' },
          { file: 'executorservice', why: 'Không bao giờ tự new Thread trong production.' },
          { file: 'completablefuture', why: 'Gọi nhiều service song song.' },
          { file: 'deadlock', why: 'Nhận ra và tránh được trước khi nó xảy ra.' },
        ],
      },
      {
        title: 'Spring nâng cao & bảo mật',
        topics: [
          { file: 'transactional-deep-dive', why: '@Transactional không rollback, gọi nội bộ không có tác dụng — bug mất dữ liệu kinh điển.' },
          { file: 'exception-handling-controlleradvice', why: 'Trả lỗi nhất quán cho toàn bộ API.' },
          { file: 'authentication-vs-authorization', why: 'Nhầm hai khái niệm này là lỗ hổng bảo mật.' },
          { file: 'jwt', why: 'Cơ chế auth phổ biến nhất của REST API.' },
          { file: 'bean-scope', why: 'Singleton bean giữ state = bug concurrency.' },
          { file: 'api-best-practices', why: 'Pagination, versioning, idempotency của API.' },
          { file: 'openapi-swagger', why: 'Hợp đồng API với frontend/team khác.' },
        ],
      },
      {
        title: 'Chất lượng & vận hành',
        topics: [
          { file: 'integration-test', why: 'Unit test pass nhưng app vẫn hỏng — cần test tích hợp.' },
          { file: 'testcontainers', why: 'Test với DB thật thay vì mock.' },
          { file: 'solid-principles', why: 'Ngôn ngữ chung khi thảo luận thiết kế trong code review.' },
          { file: 'clean-code-code-review', why: 'Viết PR dễ review và review PR của người khác.' },
          { file: 'git-rebase-vs-merge', why: 'Làm việc trên branch chung mà không phá lịch sử của team.' },
          { file: 'networking-dns-tcp-tls', why: 'Phân biệt timeout, connection refused, lỗi certificate.' },
          { file: 'builder', why: 'Pattern gặp nhiều nhất trong code Java.' },
          { file: 'strategy', why: 'Thay if-else dài bằng thiết kế mở rộng được.' },
          { file: 'cache-aside', why: 'Pattern cache đầu tiên bạn sẽ dùng với Redis.' },
          { file: 'redis', why: 'Cache, session, rate limit — gần như công ty nào cũng có.' },
          { file: 'structured-logging', why: 'Log tìm được khi có incident lúc 2 giờ sáng.' },
          { file: 'java-17', why: 'Record, sealed class — Java hiện đại mà codebase mới dùng.' },
        ],
      },
    ],
    exitCriteria: [
      'Tìm và sửa được một query chậm bằng EXPLAIN, không đoán',
      'Phát hiện được N+1 query trong code review',
      'Viết được code an toàn khi 2 request cùng sửa một bản ghi',
      'Có integration test chạy với DB thật (Testcontainers)',
      'Tự thêm authentication + phân quyền cho một endpoint mới',
    ],
    notYet: [
      'Tự thiết kế kiến trúc microservices từ đầu',
      'Sharding, CQRS, Event Sourcing',
      'Tuning GC — chỉ cần biết đọc heap/thread dump khi có sự cố (giai đoạn sau)',
    ],
  },
  {
    id: 'stage-2',
    level: 'Mid-level',
    title: 'Hệ thống nhiều service — xử lý lỗi và tải thật',
    duration: '1.5 – 4 năm',
    goal: 'Làm việc với hệ thống phân tán: message, gọi service chéo, xử lý sự cố production và giải thích được trade-off.',
    groups: [
      {
        title: 'Messaging',
        topics: [
          { file: 'kafka', why: 'Xương sống event-driven của hầu hết hệ thống lớn.' },
          { file: 'consumer-group', why: 'Scale consumer và hiểu vì sao message bị xử lý 2 lần.' },
          { file: 'at-least-once-vs-exactly-once', why: 'Không có exactly-once miễn phí.' },
          { file: 'idempotency-deduplication', why: 'Điều kiện bắt buộc khi message có thể lặp.' },
          { file: 'retry-strategies', why: 'Retry sai = tự DDoS hệ thống của mình.' },
          { file: 'dead-letter-queue-dlq', why: 'Nơi message lỗi đi, thay vì chặn cả partition.' },
        ],
      },
      {
        title: 'Microservices & resilience',
        topics: [
          { file: 'service-communication', why: 'Sync hay async — quyết định kiến trúc đầu tiên.' },
          { file: 'circuit-breaker', why: 'Một service chết không kéo sập cả hệ thống.' },
          { file: 'retry-backoff', why: 'Kết hợp đúng với circuit breaker.' },
          { file: 'api-gateway', why: 'Cửa vào chung: auth, routing, rate limit.' },
          { file: 'saga-pattern', why: 'Transaction xuyên nhiều service.' },
        ],
      },
      {
        title: 'System design nền tảng',
        topics: [
          { file: 'stateless-services', why: 'Điều kiện để scale ngang.' },
          { file: 'horizontal-vs-vertical', why: 'Scale kiểu nào, khi nào.' },
          { file: 'load-balancing', why: 'Traffic được chia thế nào.' },
          { file: 'caching', why: 'Công cụ tăng tốc rẻ nhất — và dễ sai nhất.' },
          { file: 'read-replica', why: 'Bước scale database đầu tiên.' },
          { file: 'rate-limiting', why: 'Bảo vệ hệ thống khỏi tải bất thường.' },
          { file: 'cap-theorem', why: 'Ngôn ngữ chung khi bàn trade-off.' },
          { file: 'eventual-consistency', why: 'Chấp nhận dữ liệu trễ — thiết kế UX cho nó.' },
        ],
      },
      {
        title: 'JVM & vận hành production',
        topics: [
          { file: 'heap', why: 'Hiểu OOM đến từ đâu.' },
          { file: 'garbage-collection', why: 'GC pause giải thích nhiều spike latency.' },
          { file: 'memory-leaks', why: 'App chậm dần rồi chết sau vài ngày.' },
          { file: 'phan-tich-thread-dump', why: 'Công cụ chính khi app treo.' },
          { file: 'java-memory-model', why: 'Hiểu thật sự vì sao code concurrent sai.' },
          { file: 'optimistic-pessimistic-locking', why: 'Chọn chiến lược lock theo mức độ tranh chấp.' },
          { file: 'innodb-mvcc', why: 'Vì sao đọc không chặn ghi.' },
          { file: 'proxy-mechanism', why: 'Vì sao @Transactional gọi nội bộ không có tác dụng.' },
          { file: 'spring-boot-4-migration', why: 'Dẫn việc nâng cấp framework mà không làm vỡ production.' },
        ],
      },
      {
        title: 'Hạ tầng',
        topics: [
          { file: 'dockerfile-best-practices', why: 'Image nhỏ, build nhanh, an toàn.' },
          { file: 'pod-deployment-service', why: 'Đơn vị cơ bản khi deploy lên K8s.' },
          { file: 'configmap-secret', why: 'Tách cấu hình khỏi image.' },
          { file: 'pipeline-stages', why: 'Code đi từ commit tới production thế nào.' },
          { file: 'metrics-prometheus', why: 'Biết hệ thống đang khỏe hay không.' },
          { file: 'distributed-tracing', why: 'Tìm service chậm trong chuỗi 10 service.' },
        ],
      },
    ],
    exitCriteria: [
      'Thiết kế được luồng xử lý qua Kafka không mất và không trùng message',
      'Tham gia on-call: đọc metrics, trace, thread dump để tìm nguyên nhân sự cố',
      'Giải thích được trade-off của một quyết định (vd: sync vs async, cache vs không cache)',
      'Deploy được một service lên Kubernetes qua CI/CD',
      'Trả lời được một bài system design cơ bản (URL shortener, rate limiter) trong 45 phút',
    ],
    notYet: [
      'Event Sourcing/CQRS cho mọi thứ — chỉ dùng khi bài toán thật cần',
      'Tự viết Terraform cho toàn bộ hạ tầng công ty',
    ],
  },
  {
    id: 'stage-3',
    level: 'Senior',
    title: 'Dẫn dắt thiết kế — quyết định và chịu trách nhiệm',
    duration: '4 năm +',
    goal: 'Thiết kế hệ thống cho nhiều team, đánh giá rủi ro, viết design doc và dẫn dắt người khác.',
    groups: [
      {
        title: 'Dữ liệu phân tán',
        topics: [
          { file: 'outbox-pattern', why: 'Ghi DB và gửi event nhất quán.' },
          { file: 'event-sourcing', why: 'Khi cần lịch sử đầy đủ và audit.' },
          { file: 'cqrs', why: 'Tách mô hình đọc/ghi khi tải lệch.' },
          { file: 'sharding', why: 'Khi một database không còn đủ.' },
          { file: 'consistent-hashing', why: 'Chia dữ liệu mà không phải di chuyển hết khi thêm node.' },
          { file: 'redis-setnx-redlock', why: 'Distributed lock và những điểm nó không an toàn.' },
          { file: 'ordering-guarantees', why: 'Thứ tự message khi scale partition.' },
        ],
      },
      {
        title: 'Hiệu năng & sức chịu tải',
        topics: [
          { file: 'sizing-thread-pool', why: 'Con số có cơ sở thay vì đoán.' },
          { file: 'tuning-connection-pool', why: 'Pool lớn hơn không phải lúc nào cũng tốt hơn.' },
          { file: 'bulkhead-isolation', why: 'Cô lập để lỗi không lan.' },
          { file: 'capacity-planning', why: 'Chuẩn bị cho tải trước khi nó đến.' },
          { file: 'performance-testing', why: 'Chứng minh bằng số liệu.' },
        ],
      },
      {
        title: 'Kiến trúc & quy trình',
        topics: [
          { file: 'ddd-basics', why: 'Chia ranh giới service theo nghiệp vụ.' },
          { file: 'hexagonal-architecture', why: 'Tách domain khỏi framework.' },
          { file: 'contract-testing', why: 'Nhiều team đổi API mà không vỡ nhau.' },
          { file: 'blue-green-canary-deploy', why: 'Release an toàn, rollback nhanh.' },
          { file: 'hpa-rolling-update', why: 'Tự scale theo tải.' },
          { file: 'terraform-basics', why: 'Hạ tầng dưới dạng code, review được.' },
          { file: 'oauth2-oidc', why: 'SSO, tích hợp hệ thống bên ngoài.' },
          { file: 'owasp-top10', why: 'Chịu trách nhiệm bảo mật của cả thiết kế.' },
        ],
      },
      {
        title: 'Bài tập thiết kế',
        topics: [
          { file: 'solution-bulk-message', why: 'Áp dụng tổng hợp: scheduling, queue, rate limit.' },
          { file: 'solution-ecommerce', why: 'Bài toán end-to-end với nhiều trade-off.' },
        ],
      },
    ],
    exitCriteria: [
      'Viết design doc có phương án thay thế và lý do chọn',
      'Review thiết kế của người khác và chỉ ra rủi ro trước khi code',
      'Dẫn dắt xử lý một sự cố lớn và viết postmortem',
      'Mentor được fresher đi hết giai đoạn đầu của roadmap này',
    ],
    notYet: [],
  },
]

export const ROADMAP_ELECTIVES: RoadmapElective[] = [
  {
    title: 'Kotlin & Coroutines',
    when: 'Khi team dùng Kotlin — sau khi đã vững Java giai đoạn Junior',
    files: ['kotlin-vs-java', 'kotlin-null-safety', 'kotlin-coroutines-basics', 'kotlin-flow'],
  },
  {
    title: 'Quarkus',
    when: 'Khi cần startup nhanh / native image — sau khi đã vững Spring',
    files: ['quarkus-vs-spring', 'quarkus-basics', 'quarkus-native'],
  },
  {
    title: 'Frontend React',
    when: 'Khi làm fullstack hoặc micro-frontend',
    files: ['react-usestate-usereducer', 'react-useeffect', 'react-performance', 'react-context'],
  },
  {
    title: 'AI & Agents',
    when: 'Khi dự án có tích hợp LLM — cần nền backend trước',
    files: ['agentic-loop', 'function-calling', 'rag-pattern', 'mcp-overview'],
  },
  {
    title: 'API ngoài REST',
    when: 'Khi có nhu cầu cụ thể: gọi nội bộ hiệu năng cao, real-time',
    files: ['grpc-deep', 'graphql', 'websocket-sse'],
  },
  {
    title: 'Database & messaging thay thế',
    when: 'Khi công ty dùng stack này',
    files: ['mybatis-vs-jpa', 'mongodb', 'when-to-use-nosql', 'rabbitmq'],
  },
  {
    title: 'Python',
    when: 'Scripting, data, AI',
    files: ['python-data-types', 'python-async-await', 'python-fastapi'],
  },
  {
    title: '.NET / Ruby',
    when: 'Chỉ khi chuyển sang stack đó — so sánh với Java để học nhanh',
    files: ['csharp-vs-java', 'ruby-vs-java'],
  },
]
