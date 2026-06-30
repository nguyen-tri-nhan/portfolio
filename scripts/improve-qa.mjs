#!/usr/bin/env node
// Replaces ## Câu Hỏi Phỏng Vấn section in each MD file
// with expanded Q&A in collapsible <details> format.
// Safe to re-run: skips files already using <details> format.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../webapp/src/review-content');

// Helper to build the <details> Q&A section
function qa(pairs) {
  const items = pairs.map(({ q, a }) =>
    `<details>\n<summary><strong>${q}</strong></summary>\n\n${a}\n\n</details>`
  ).join('\n\n');
  return `## Câu Hỏi Phỏng Vấn\n\n${items}\n`;
}

// Replace ## Câu Hỏi Phỏng Vấn section in content string
function replaceQA(content, newSection) {
  const marker = '## Câu Hỏi Phỏng Vấn';
  const start = content.indexOf(marker);
  if (start === -1) return null; // section not found

  // Find end: next ## heading or end of file
  const afterStart = start + marker.length;
  const nextSection = content.indexOf('\n## ', afterStart);
  const end = nextSection !== -1 ? nextSection : content.length;

  return content.slice(0, start) + newSection + content.slice(end);
}

// ══════════════════════════════════════════════════════════════════════════════
// Q&A DATABASE — key = md filename without .md
// ══════════════════════════════════════════════════════════════════════════════
const QA = {

// ── GARBAGE COLLECTION ────────────────────────────────────────────────────────
'garbage-collection': qa([
  { q: 'Minor GC và Full GC khác nhau thế nào?',
    a: `**A:** Minor GC (Young GC) chỉ thu gom Young Generation (Eden + Survivor), thường dưới 50ms và xảy ra thường xuyên. Full GC thu gom toàn bộ Heap (Young + Old + Metaspace), là Stop-The-World và có thể mất vài giây — gây latency spike nghiêm trọng trong production. G1GC giảm thiểu Full GC bằng Mixed GC — thu gom Young + một phần Old region theo incremental, giữ pause time dự đoán được. Mục tiêu: giữ Full GC dưới 1 lần/ngày trong production.` },
  { q: 'Khi nào chọn ZGC thay vì G1GC?',
    a: `**A:** Chọn ZGC (Java 17+) khi service yêu cầu pause time dưới 1ms bất kể heap size — ví dụ: trading, gaming, real-time streaming. G1GC đủ tốt cho hầu hết microservice với mục tiêu 200ms pause. ZGC dùng colored pointers và load barriers để thực hiện concurrent marking và compaction mà không cần dừng app thread lâu. Trade-off: ZGC tốn CPU nhiều hơn G1GC một chút cho concurrent work.` },
  { q: 'Memory leak trong Java xảy ra như thế nào nếu GC tự quản lý bộ nhớ?',
    a: `**A:** GC chỉ thu gom object không còn *reachable* từ GC root. Leak xảy ra khi object vẫn có reference nhưng không còn cần thiết về mặt logic — ví dụ: static Map cache tăng không giới hạn, ThreadLocal không gọi \`remove()\` trong thread pool tái sử dụng, listener đăng ký nhưng không deregister. Kết quả: heap tăng dần đến OOM. Phát hiện bằng heap dump + Eclipse MAT: nhìn Dominator Tree để tìm object nào đang giữ retention heap lớn nhất.` },
  { q: 'Tại sao đặt -Xms bằng -Xmx trong production?',
    a: `**A:** Khi \`-Xms < -Xmx\`, JVM phải resize heap khi app tăng tải — resize là Stop-The-World và tốn thời gian. Đặt cả hai bằng nhau (ví dụ \`-Xms2g -Xmx2g\`) khiến JVM cấp phát toàn bộ heap ngay từ đầu: không overhead resize, memory footprint predictable, phù hợp Kubernetes resource limits. Nhược điểm: container luôn chiếm memory ngay cả khi idle, nhưng trong production điều này thường được chấp nhận để đổi lấy stability.` },
  { q: 'Giải thích quá trình promotion từ Young sang Old Generation.',
    a: `**A:** Object mới cấp phát vào Eden. Minor GC: copy object còn sống từ Eden + Survivor active sang Survivor passive, tăng age counter 1. Mỗi lần sống sót qua Minor GC = +1 age. Khi age đạt \`MaxTenuringThreshold\` (default 15) hoặc Survivor space đầy → object được promoted sang Old Gen. Object lớn hơn \`-XX:PretenureSizeThreshold\` được cấp phát thẳng vào Old Gen, bỏ qua Young hoàn toàn.` },
]),

// ── JVM INTERNALS ────────────────────────────────────────────────────────────
'jvm-internals': qa([
  { q: 'Các vùng nhớ chính của JVM là gì?',
    a: `**A:** Heap (Young + Old Gen — shared giữa threads, GC managed), Method Area / Metaspace (class metadata, static fields, constants — ngoài Heap từ Java 8), Stack (mỗi thread có riêng — stack frame per method call, local variables, operand stack), PC Register (địa chỉ instruction hiện tại per thread), Native Method Stack (cho JNI calls). OutOfMemoryError có thể xảy ra ở Heap, Metaspace, hoặc Stack (StackOverflowError).` },
  { q: 'JIT Compiler là gì và nó tối ưu code thế nào?',
    a: `**A:** JIT (Just-In-Time) Compiler biên dịch bytecode thành native machine code tại runtime — khác với interpreted execution từng instruction. JVM theo dõi "hot methods" (gọi nhiều lần) và compile chúng với C1 (client compiler, nhanh) rồi C2 (server compiler, optimize sâu hơn). Các tối ưu tiêu biểu: method inlining (inline body của method nhỏ vào caller), loop unrolling, escape analysis (object không escape method → cấp phát trên stack thay vì heap). \`-XX:+PrintCompilation\` để xem những gì đang được JIT-compile.` },
  { q: 'Class Loading trong JVM hoạt động thế nào?',
    a: `**A:** Ba bước: Loading (đọc .class file → tạo Class object), Linking (Verification → Preparation → Resolution), Initialization (chạy static initializer). Parent delegation model: ClassLoader con luôn delegate cho parent trước — Bootstrap → Extension → Application → Custom. Mục đích: bảo mật (không thể override java.lang.String), isolation (module system). Dùng custom ClassLoader cho hot-reload và plugin isolation.` },
]),

// ── HEAP ────────────────────────────────────────────────────────────────────
'heap': qa([
  { q: 'Có bao nhiêu loại OutOfMemoryError và nguyên nhân từng loại?',
    a: `**A:** Ba loại chính: (1) \`java.lang.OutOfMemoryError: Java heap space\` — heap đầy, object không được GC. (2) \`OutOfMemoryError: Metaspace\` — quá nhiều class được load (thường do class generation libraries như CGLIB, Groovy). (3) \`OutOfMemoryError: GC overhead limit exceeded\` — JVM dành >98% thời gian cho GC nhưng chỉ giải phóng <2% heap — dấu hiệu memory leak nghiêm trọng. Xử lý: tăng heap size và điều tra heap dump.` },
  { q: 'Heap dump là gì và lấy nó thế nào trong production?',
    a: `**A:** Heap dump là snapshot toàn bộ object trong JVM heap tại một thời điểm. Có thể lấy bằng: \`jmap -dump:live,format=b,file=heap.hprof <pid>\`, \`jcmd <pid> GC.heap_dump /path/heap.hprof\`, hoặc tự động khi OOM với flag \`-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/\`. Phân tích bằng Eclipse MAT: chạy "Leak Suspects Report", xem Dominator Tree sort theo Retained Heap để tìm root cause. Luôn bật \`HeapDumpOnOutOfMemoryError\` trong production.` },
  { q: 'Tại sao Object được tạo trên Heap chứ không phải Stack?',
    a: `**A:** Stack frame bị destroy khi method return — object tồn tại lâu hơn vòng đời method cần sống trên Heap để có thể share giữa các method và thread. JVM Escape Analysis có thể quyết định cấp phát object trên Stack nếu object không "escape" ra ngoài method — đây là optimization hiếm, không thể rely on. Primitive types và references (không phải object chúng trỏ vào) được lưu trên Stack.` },
]),

// ── STACK ───────────────────────────────────────────────────────────────────
'stack': qa([
  { q: 'StackOverflowError xảy ra khi nào và fix thế nào?',
    a: `**A:** StackOverflowError xảy ra khi call stack vượt quá kích thước tối đa do đệ quy không có base case hoặc đệ quy quá sâu. Default stack size: 256KB-1MB tùy JVM. Fix: (1) Thêm base case hoặc kiểm tra điều kiện dừng đúng, (2) Chuyển đệ quy thành iterative với explicit Stack, (3) Tăng stack size bằng \`-Xss2m\` (dùng nhiều memory hơn), (4) Dùng tail-call optimization (Java không hỗ trợ native, nhưng có thể simulate). Spring Stack trace dài không gây StackOverflow — chỉ là log.` },
  { q: 'Stack và Heap khác nhau thế nào về lifecycle và thread safety?',
    a: `**A:** Stack: per-thread (mỗi thread có stack riêng), thread-safe tự nhiên vì không shared, LIFO, tự động dealloc khi method return. Heap: shared giữa tất cả thread, cần synchronization khi access concurrent, GC-managed, linh hoạt hơn về lifetime. Local primitive variables (int, boolean...) và references lưu trên Stack. Object instances và arrays luôn trên Heap. "Stack vs Heap allocation" là thread-safety chứ không phải performance — cả hai đều nhanh với modern JVM.` },
]),

// ── CLASS LOADING ──────────────────────────────────────────────────────────
'class-loading': qa([
  { q: 'Parent delegation model là gì và tại sao quan trọng?',
    a: `**A:** Khi ClassLoader nhận yêu cầu load class, nó delegate cho parent trước khi tự load. Thứ tự: Bootstrap (rt.jar / jdk modules) → Platform (Extension) → Application → Custom. Kết quả: \`java.lang.String\` luôn được load bởi Bootstrap — không thể override bằng class cùng tên trong classpath. Bảo vệ tính toàn vẹn của core Java libraries. OSGi và Java Module System (JPMS) phá vỡ parent delegation model có kiểm soát để đạt module isolation.` },
  { q: 'Khi nào cần implement custom ClassLoader?',
    a: `**A:** Custom ClassLoader cần khi: (1) Hot reload — load class mới từ filesystem mà không restart JVM (dùng trong dev server như Spring DevTools), (2) Plugin isolation — mỗi plugin có ClassLoader riêng, class của plugin A không xung đột với plugin B (Tomcat webapps, IDE plugins), (3) Load bytecode từ nguồn khác (network, encrypted storage, database). Extend \`ClassLoader\`, override \`findClass()\` — không override \`loadClass()\` để giữ parent delegation.` },
]),

// ── MEMORY LEAKS ────────────────────────────────────────────────────────────
'memory-leaks': qa([
  { q: 'Ba pattern memory leak phổ biến nhất trong Java là gì?',
    a: `**A:** (1) **Static collection không có eviction**: \`static Map<K,V>\` tăng vô hạn — dùng Caffeine/Guava cache với max size + TTL. (2) **ThreadLocal trong thread pool**: thread pool tái sử dụng thread — ThreadLocal từ request trước bị leak sang request sau, rủi ro cả memory lẫn security. Fix: luôn gọi \`threadLocal.remove()\` trong finally. (3) **Unregistered listener/callback**: object đăng ký với EventBus/Observer nhưng không unregister khi không cần — EventBus giữ strong reference ngăn GC. Fix: weakReference-based EventBus hoặc explicit unregister.` },
  { q: 'Phân biệt Strong, Soft, Weak, Phantom reference.',
    a: `**A:** Strong: default, GC không thu gom khi còn strong reference. Weak (\`WeakReference\`): GC thu gom khi không còn strong reference, dù JVM không cần thêm memory — dùng trong cache và WeakHashMap. Soft (\`SoftReference\`): GC chỉ thu gom khi JVM thực sự cần memory — tốt cho memory-sensitive cache. Phantom (\`PhantomReference\`): không thể get() object, dùng với ReferenceQueue để biết khi object bị finalize — dùng cho cleanup resource. WeakHashMap: key là WeakReference → entry tự xóa khi key không còn strong reference.` },
]),

// ── ARRAYLIST VS LINKEDLIST ────────────────────────────────────────────────
'arraylist-vs-linkedlist': qa([
  { q: 'Khi nào nên chọn LinkedList thay vì ArrayList?',
    a: `**A:** Hầu như không bao giờ trong Java hiện đại. ArrayList có get(i) O(1) vs LinkedList O(n), và ArrayList có cache locality tốt hơn nhiều do array liên tục trong memory. LinkedList chỉ tốt hơn khi insert/delete ở đầu list rất thường xuyên (O(1) vs ArrayList O(n) shift). Nhưng trong thực tế, ArrayDeque tốt hơn LinkedList cho queue/deque operations. Rule of thumb: mặc định dùng ArrayList; chỉ xét LinkedList nếu profiling chứng minh ArrayList là bottleneck.` },
  { q: 'ArrayList resize hoạt động thế nào?',
    a: `**A:** ArrayList có backing array với capacity (default 10). Khi add element vượt capacity: tạo array mới với capacity = old × 1.5, copy tất cả elements. Amortized O(1) per add vì resize xảy ra ít dần. Nếu biết trước số lượng, khởi tạo với \`new ArrayList<>(initialCapacity)\` để tránh resize hoàn toàn. \`trimToSize()\` để giảm capacity về đúng size sau khi đã add xong — tiết kiệm memory.` },
]),

// ── HASHMAP INTERNALS ─────────────────────────────────────────────────────
'hashmap-internals': qa([
  { q: 'HashMap hoạt động thế nào? Giải thích put() và get().',
    a: `**A:** \`put(key, value)\`: tính \`hash = key.hashCode() ^ (hash >>> 16)\` (spread bits), tính \`index = hash & (capacity-1)\`. Nếu bucket[index] trống → tạo Node mới. Nếu có collision → thêm vào linked list hoặc Red-Black tree (khi bucket > 8 entries). \`get(key)\`: tính index tương tự, traverse bucket chain so sánh bằng \`equals()\`. Độ phức tạp trung bình O(1), worst case O(log n) với tree bucket.` },
  { q: 'HashMap không thread-safe vì sao? Chứng minh bằng ví dụ.',
    a: `**A:** Vì không có synchronization: (1) Resize race — hai thread cùng trigger resize, có thể tạo circular linked list (Java 7) gây infinite loop. (2) Visibility — một thread put() không đảm bảo thread khác thấy value mới (không có memory barrier). (3) Check-then-act race — \`if(!map.containsKey(k)) map.put(k,v)\` không atomic. Fix: \`ConcurrentHashMap\` cho concurrent access, \`Collections.synchronizedMap()\` cho synchronization thủ công (kém hơn), hoặc đảm bảo chỉ một thread access.` },
  { q: 'Tại sao HashMap yêu cầu key phải implement equals() và hashCode() nhất quán?',
    a: `**A:** Contract: nếu \`a.equals(b)\` thì \`a.hashCode() == b.hashCode()\`. Nếu vi phạm: \`put("key", v1)\` và \`get("key")\` có thể return null vì hash khác nhau dẫn đến bucket khác nhau. Ngược lại không bắt buộc: hai object khác nhau có thể cùng hashCode (collision) — HashMap xử lý bằng equals() so sánh. Java record tự generate equals/hashCode nhất quán. IDE cũng có thể generate, nhưng nếu manually implement cần test kỹ.` },
  { q: 'Treeify threshold (8) và untreeify threshold (6) tồn tại để làm gì?',
    a: `**A:** Khi bucket có > 8 entries → convert linked list sang Red-Black Tree: get() từ O(n) → O(log n). Khi entries giảm xuống < 6 (sau remove) → convert ngược lại sang linked list: tree có overhead memory lớn hơn (TreeNode vs Node). Hysteresis (8 và 6, không phải cùng threshold) tránh thrashing — liên tục convert qua lại khi size dao động quanh ngưỡng. Trong practice, nếu hash function tốt, bucket hầu như không bao giờ có > 8 entries.` },
]),

// ── CONCURRENTHASHMAP ────────────────────────────────────────────────────
'concurrenthashmap': qa([
  { q: 'ConcurrentHashMap Java 8 khác Java 7 thế nào?',
    a: `**A:** Java 7: Segment-based locking — 16 ReentrantLock segments, mỗi segment bảo vệ một phần của table. Java 8: Loại bỏ segments hoàn toàn. Write vào empty bucket: dùng CAS (lock-free). Write vào occupied bucket: \`synchronized(headNode)\` — granularity đến từng bucket thay vì 1/16 table. Read: luôn lock-free (volatile reads). Kết quả: Java 8 có throughput cao hơn đáng kể ở high concurrency, đặc biệt khi nhiều bucket khác nhau được access đồng thời.` },
  { q: 'Tại sao ConcurrentHashMap không cho phép null key/value?',
    a: `**A:** Trong multi-threaded context, \`map.get(key)\` trả về null có thể là: (a) key không tồn tại, hoặc (b) key tồn tại với value là null. Không thể phân biệt hai trường hợp mà không dùng \`containsKey()\` trong cùng atomic operation. Với HashMap (single-threaded), bạn có thể check \`containsKey()\` ngay sau. Nhưng với ConcurrentHashMap, giữa \`get()\` và \`containsKey()\` thread khác có thể modify map — race condition. Doug Lea (designer) quyết định cấm null để tránh ambiguity này.` },
]),

// ── THREAD LIFECYCLE ────────────────────────────────────────────────────
'thread-lifecycle': qa([
  { q: 'BLOCKED và WAITING khác nhau thế nào trong thread dump?',
    a: `**A:** BLOCKED: thread đang chờ acquire Java monitor lock (synchronized block/method) đang bị thread khác giữ. Thoát BLOCKED ngay khi lock được release — không cần notify. WAITING: thread đã acquire lock, tự nguyện release và chờ notification qua \`Object.wait()\`, \`LockSupport.park()\`, hoặc \`Thread.join()\`. Thoát WAITING chỉ khi có \`notify()\`/\`notifyAll()\`/\`unpark()\`. Nhiều thread BLOCKED → lock contention (bottleneck). Nhiều thread WAITING → thường là normal (thread pool idle, async processing).` },
  { q: 'Thread.sleep() và Object.wait() khác nhau thế nào?',
    a: `**A:** \`sleep(ms)\`: thread dừng N milliseconds, KHÔNG release lock đang giữ, không cần gọi từ synchronized block. \`wait()\`: thread release lock và đợi notify, phải gọi từ synchronized block (sinon IllegalMonitorStateException). \`sleep()\` dùng để delay execution. \`wait()\` dùng để coordinate giữa threads (producer-consumer pattern). Thread sau \`sleep()\` tự thức; thread sau \`wait()\` cần notify từ thread khác.` },
  { q: 'Virtual Threads (Java 21) khác platform threads thế nào?',
    a: `**A:** Platform thread: 1-1 với OS thread, ~1MB stack, tốn kém tạo và context-switch. Virtual thread: được schedule bởi JVM trên ForkJoinPool của carrier threads (OS threads), ~KB stack, hàng triệu virtual thread cùng lúc. Khi virtual thread block trên I/O → JVM unmount khỏi carrier thread, carrier thread free để chạy virtual thread khác. Code viết blocking style nhưng scale như NIO. Bật: \`spring.threads.virtual.enabled=true\` (Spring Boot 3.2+).` },
]),

// ── SYNCHRONIZED KEYWORD ────────────────────────────────────────────────
'synchronized-keyword': qa([
  { q: 'synchronized method và synchronized block khác nhau thế nào?',
    a: `**A:** \`synchronized method\` lock trên \`this\` (instance method) hoặc \`Class\` object (static method) — lock toàn bộ method. \`synchronized(lock) { ... }\` lock trên object bất kỳ, chỉ bảo vệ critical section nhỏ → throughput cao hơn. Ưu tiên synchronized block: lock granularity nhỏ hơn, dễ kiểm soát lock object, tránh lock leak khi dùng return hoặc exception (try-with-resources tự unlock không dùng được với synchronized — dùng ReentrantLock).` },
  { q: 'Reentrant lock là gì? synchronized có phải reentrant không?',
    a: `**A:** Reentrant: thread đang giữ lock có thể acquire cùng lock đó lại mà không bị deadlock — lock đếm số lần acquire. Java \`synchronized\` là reentrant — nếu \`methodA()\` synchronized gọi \`methodB()\` synchronized trên cùng object, không bị deadlock. \`ReentrantLock\` cũng reentrant và phải gọi \`unlock()\` đúng số lần \`lock()\`. Non-reentrant lock (hiếm) sẽ deadlock trong tình huống này.` },
  { q: 'Tại sao wait() phải gọi trong while loop chứ không phải if?',
    a: `**A:** Spurious wakeup: thread có thể wake up từ \`wait()\` mà không có \`notify()\` — đây là behavior được phép bởi JVM spec và xảy ra trên một số OS. Nếu dùng \`if\`: check condition một lần, spurious wakeup → tiếp tục execute dù condition chưa đúng. Nếu dùng \`while\`: check lại condition sau wakeup → đúng mới tiếp tục. Pattern chuẩn: \`while (!condition) { wait(); }\` — đây là best practice bắt buộc.` },
]),

// ── VOLATILE ──────────────────────────────────────────────────────────────
'volatile': qa([
  { q: 'volatile đảm bảo gì và KHÔNG đảm bảo gì?',
    a: `**A:** Đảm bảo: (1) **Visibility** — write từ thread này được visible ngay với tất cả thread khác (không cache stale trong CPU cache). (2) **Ordering** — không reorder instruction qua volatile read/write barrier. KHÔNG đảm bảo: **Atomicity** — \`i++\` trên volatile int vẫn là 3 operations (read → modify → write), không atomic. Dùng \`AtomicInteger\` cho compound operation. volatile đủ cho: flag boolean, published reference, singleton double-checked locking.` },
  { q: 'volatile có phải alternative cho synchronized không?',
    a: `**A:** Không hoàn toàn. volatile và synchronized đều đảm bảo visibility. Nhưng synchronized còn đảm bảo atomicity (mutual exclusion) — chỉ một thread execute critical section tại một thời điểm. volatile chỉ phù hợp khi: (1) chỉ một thread write, nhiều thread read, (2) operation là atomic by nature (assignment của reference, long/double trên 64-bit JVM). Nếu cần compound operation (check-then-act, read-modify-write) → phải dùng synchronized hoặc Atomic class.` },
]),

// ── CAS ──────────────────────────────────────────────────────────────────
'cas-compare-and-swap': qa([
  { q: 'ABA problem là gì và Java giải quyết thế nào?',
    a: `**A:** ABA: Thread 1 đọc value A, bị suspend. Thread 2 thay A → B → A. Thread 1 resume, CAS thấy value vẫn là A → thành công, nhưng có thể bỏ qua các thay đổi trung gian. Trong linked data structures, điều này nguy hiểm (node A bị free và realloc). Java fix: \`AtomicStampedReference<V>\` — lưu thêm stamp (version counter) cùng value, CAS kiểm tra cả value lẫn stamp. Hoặc \`AtomicMarkableReference\` cho single-bit mark.` },
  { q: 'Khi nào CAS tốt hơn synchronized?',
    a: `**A:** CAS tốt hơn khi: (1) Contention thấp — CAS spin loop nhanh, không cần OS context switch. (2) Operation ngắn — read-modify-write đơn giản như increment counter. Synchronized tốt hơn khi: (1) Contention cao — nhiều thread tranh chấp, CAS spin loop lãng phí CPU. (2) Critical section dài — spin lâu kém hơn OS sleep+wake. \`AtomicInteger\`, \`AtomicReference\` dùng CAS internaly. Biased locking trong JVM cũng tối ưu synchronized cho no-contention case.` },
]),

// ── DEADLOCK ─────────────────────────────────────────────────────────────
'deadlock': qa([
  { q: 'Bốn điều kiện cần thiết để deadlock xảy ra là gì?',
    a: `**A:** (1) **Mutual exclusion**: resource chỉ được giữ bởi một thread tại một thời điểm. (2) **Hold and wait**: thread giữ resource và đang chờ thêm resource. (3) **No preemption**: resource không thể bị lấy đi forcibly. (4) **Circular wait**: thread A chờ resource của B, B chờ resource của C, C chờ resource của A. Phá vỡ bất kỳ điều kiện nào là đủ để ngăn deadlock. Thực tế: hay dùng lock ordering (phá circular wait) hoặc tryLock với timeout (phá hold-and-wait).` },
  { q: 'Detect deadlock trong production Java app thế nào?',
    a: `**A:** Thread dump: \`jstack <pid>\` — JVM tự report "Found one Java-level deadlock" và liệt kê thread cùng lock chain. ThreadMXBean programmatically: \`ManagementFactory.getThreadMXBean().findDeadlockedThreads()\` — có thể schedule check định kỳ và alert. APM tools (Datadog, Dynatrace) tự detect deadlock từ thread dump. Phòng ngừa: enforce lock ordering nhất quán toàn codebase, prefer higher-level concurrent structures (ConcurrentHashMap) thay vì raw lock.` },
]),

// ── REENTRANTLOCK ────────────────────────────────────────────────────────
'reentrantlock': qa([
  { q: 'ReentrantLock có những ưu điểm gì so với synchronized?',
    a: `**A:** (1) **Timed tryLock**: \`lock.tryLock(100, MILLISECONDS)\` — tránh deadlock, có thể retry hoặc give up. (2) **Interruptible**: \`lockInterruptibly()\` — thread chờ lock có thể bị interrupt. (3) **Fairness**: \`new ReentrantLock(true)\` — FIFO ordering, tránh starvation (synchronized không đảm bảo fairness). (4) **Multiple Condition**: \`lock.newCondition()\` — có thể có nhiều wait set thay vì một như synchronized. (5) Trylock không block: test lock availability mà không chờ.` },
  { q: 'Tại sao phải gọi unlock() trong finally block?',
    a: `**A:** Nếu code giữa \`lock()\` và \`unlock()\` throw exception, \`unlock()\` không được gọi → lock bị giữ mãi mãi → deadlock hoặc starvation. Pattern chuẩn: \`lock.lock(); try { ... } finally { lock.unlock(); }\`. Khác với synchronized — JVM tự release monitor khi exception thoát khỏi synchronized block. Với ReentrantLock, responsibility thuộc về developer. Lỗi này phổ biến và rất khó debug trong production.` },
]),

// ── JAVA MEMORY MODEL ─────────────────────────────────────────────────────
'java-memory-model': qa([
  { q: 'happens-before relationship là gì?',
    a: `**A:** Nếu action A happens-before action B, thì tất cả write của A visible cho B và ordered trước B. Các quy tắc chính: volatile write happens-before volatile read trên cùng variable; synchronized unlock happens-before lock tiếp theo trên cùng monitor; \`Thread.start()\` happens-before mọi action trong thread đó; mọi action trong thread happens-before \`thread.join()\` return. Là nền tảng lý thuyết để biết khi nào code thread-safe mà không cần synchronization thêm.` },
  { q: 'Tại sao double-checked locking với singleton cần volatile?',
    a: `**A:** Không có volatile: \`instance = new Singleton()\` có thể được JVM reorder thành: (1) allocate memory, (2) assign reference, (3) call constructor — thay vì thứ tự (1)(3)(2) mà lý trí mong đợi. Nếu thread khác thấy non-null reference trước khi constructor hoàn thành → sử dụng object chưa initialized. volatile đảm bảo assignment chỉ visible sau khi constructor hoàn thành. Java 5+ memory model (JSR-133) fix vấn đề này với volatile. Holder pattern (static inner class) là cách khác tránh vấn đề này.` },
]),

// ── THREAD POOL ──────────────────────────────────────────────────────────
'thread-pool': qa([
  { q: 'Công thức tính corePoolSize cho I/O-bound service?',
    a: `**A:** \`N_threads = N_CPU × (1 + wait_time / compute_time)\`. Ví dụ: 4 cores, avg DB call 100ms, xử lý response 10ms → wait_ratio = 10 → pool = 44. Lý do: khi thread đang chờ I/O (blocked), CPU idle — có thể chạy thread khác. Với CPU-bound: pool = N_CPU + 1 (1 extra cho OS scheduling). Đây là starting point — fine-tune bằng load test. Dùng \`Runtime.getRuntime().availableProcessors()\` để lấy CPU count dynamically.` },
  { q: 'Tại sao Executors.newFixedThreadPool() không được khuyến khích trong production?',
    a: `**A:** \`newFixedThreadPool(n)\` dùng unbounded LinkedBlockingQueue — queue tăng vô hạn khi tasks arrive nhanh hơn xử lý, eventual OOM. \`newCachedThreadPool()\` tạo thread mới không giới hạn → có thể spawn hàng nghìn thread, OOM hoặc context-switch hell. Best practice: dùng \`ThreadPoolExecutor\` trực tiếp với bounded ArrayBlockingQueue và explicit rejection handler. Spring's \`ThreadPoolTaskExecutor\` cũng cho phép configure đầy đủ các parameter.` },
  { q: 'CallerRunsPolicy rejection handler hoạt động thế nào?',
    a: `**A:** Khi ThreadPool queue đầy và đạt maxPoolSize, thay vì throw exception hay drop task, CallerRunsPolicy khiến caller thread (thread submit task) tự execute task đó. Tác dụng: tự nhiên slow down producer — producer phải xử lý task trước khi submit task tiếp theo. Backpressure tự nhiên không cần mechanism riêng. Trade-off: caller thread bị block trong thời gian đó. Thích hợp cho batch processing. Với AbortPolicy (default): throw RejectedExecutionException — caller quyết định retry hoặc drop.` },
]),

// ── COMPLETABLEFUTURE ─────────────────────────────────────────────────────
'completablefuture': qa([
  { q: 'thenApply() và thenApplyAsync() khác nhau thế nào?',
    a: `**A:** \`thenApply(fn)\`: execute function trên thread hoàn thành stage trước — có thể là caller thread hoặc thread pool thread. \`thenApplyAsync(fn)\`: luôn submit function vào ForkJoinPool.commonPool() (hoặc Executor nếu specify). Không có Async suffix → có thể synchronous nếu stage đã complete. Với Async suffix → guaranteed async. Trong practice: dùng Async variant cho I/O operations để không block thread đang xử lý; non-Async cho simple transformation.` },
  { q: 'Tại sao không nên dùng ForkJoinPool.commonPool() cho I/O tasks?',
    a: `**A:** commonPool thread count = CPU cores - 1 (default). I/O task blocking trên commonPool thread khiến ForkJoinPool thiếu thread cho CPU-bound computation — toàn hệ thống chậm lại. Luôn truyền custom Executor cho I/O operations: \`CompletableFuture.supplyAsync(() -> callExternalAPI(), ioExecutor)\`. Tạo dedicated pool: \`Executors.newFixedThreadPool(20, namedThreadFactory("io"))\`. Đây là lỗi phổ biến gây mysterious slowdown trong microservice.` },
  { q: 'Handle error trong CompletableFuture chain thế nào?',
    a: `**A:** \`exceptionally(fn)\`: catch exception, return fallback value — chỉ trigger khi có exception. \`handle(fn)\`: luôn execute với (result, exception) — handle cả success lẫn failure. \`whenComplete(fn)\`: side effect (logging), không transform result. \`exceptionallyCompose(fn)\`: fallback trả về CompletableFuture khác (asynchronous fallback). Best practice: \`exceptionally\` ở cuối chain cho fallback, \`handle\` nếu cần transform cả hai trường hợp. Không để exception propagate silently — CompletableFuture swallow exceptions nếu không attach handler.` },
]),

// ── IOC CONTAINER ────────────────────────────────────────────────────────
'ioc-container': qa([
  { q: 'IoC và Dependency Injection khác nhau thế nào?',
    a: `**A:** IoC (Inversion of Control) là principle: control flow được đảo ngược — framework gọi code bạn, không phải bạn gọi framework. DI (Dependency Injection) là một implementation pattern của IoC: dependencies được "inject" từ bên ngoài vào object thay vì object tự tạo. Trong Spring: IoC Container quản lý object lifecycle và wiring. DI là cơ chế container dùng để wire dependencies (\`@Autowired\`, constructor injection). IoC có thể implement theo cách khác (Template Method, Event listener) không phải DI.` },
  { q: 'BeanFactory và ApplicationContext khác nhau thế nào?',
    a: `**A:** BeanFactory: lazy initialization (bean chỉ tạo khi getBean() được gọi), lightweight, chỉ cung cấp basic DI. ApplicationContext: extends BeanFactory, eager initialization (singleton beans tạo ngay khi container start), hỗ trợ thêm: i18n (MessageSource), event publishing (ApplicationEvent), AOP auto-proxy, @PropertySource. Trong production luôn dùng ApplicationContext (AnnotationConfigApplicationContext, SpringApplication). BeanFactory hiếm khi cần trực tiếp — chỉ cho extremely memory-constrained environment.` },
  { q: '@Component, @Service, @Repository khác nhau gì ngoài tên?',
    a: `**A:** Về function: đều là stereotype annotation đánh dấu class là Spring-managed bean. Khác nhau: @Repository tự động translate persistence exception (DataAccessException) — SQLException, Hibernate exception → Spring's DataAccessException hierarchy. @Service: semantic label cho business logic layer. @Component: generic stereotype. @Controller: thêm request mapping capability. Dùng đúng stereotype cho: (1) exception translation tự động với @Repository, (2) code readability và layer separation.` },
]),

// ── BEAN LIFECYCLE ──────────────────────────────────────────────────────
'bean-lifecycle': qa([
  { q: '@PostConstruct, afterPropertiesSet(), và init-method khác nhau thế nào?',
    a: `**A:** Tất cả đều chạy sau khi bean được inject đủ dependencies nhưng thứ tự: \`@PostConstruct\` → \`afterPropertiesSet()\` → \`init-method\`. \`@PostConstruct\` (JSR-250): annotation, không cần implement interface, portable. \`afterPropertiesSet()\` (InitializingBean): interface Spring-specific — coupling với Spring. \`init-method\`: configure trong XML/Java config — loosen coupling nhất, class không biết về Spring. Best practice: \`@PostConstruct\` cho modern Spring apps.` },
  { q: 'BeanPostProcessor là gì và dùng để làm gì?',
    a: `**A:** BeanPostProcessor intercept bean creation: \`postProcessBeforeInitialization()\` chạy trước @PostConstruct, \`postProcessAfterInitialization()\` chạy sau. Dùng cho: cross-cutting concerns mà không cần AOP, custom annotation processing, wrap bean trong proxy. Spring AOP tự implement bằng \`AbstractAutoProxyCreator extends BeanPostProcessor\` — đây là cách @Transactional, @Async, @Cacheable được apply. Custom BPP ít khi cần trực tiếp — @Aspect thường đủ.` },
]),

// ── BEAN SCOPE ──────────────────────────────────────────────────────────
'bean-scope': qa([
  { q: 'Singleton scope có thread-safe không?',
    a: `**A:** Không tự động. Singleton bean được share giữa tất cả request, nếu bean có mutable state → race condition. Spring singleton chỉ đảm bảo một instance trong container — không có synchronization mechanism. Fix: (1) Stateless bean — không có instance variable mutable (đây là best practice cho Service, Repository). (2) Nếu phải có state: dùng synchronized hoặc ThreadLocal. (3) Scope bean sang request/session scope nếu state per-request.` },
  { q: 'Inject request-scoped bean vào singleton bean thế nào?',
    a: `**A:** Không thể inject trực tiếp — singleton tồn tại lâu hơn request scope → NullPointerException hoặc stale reference. Fix: inject Proxy của request-scoped bean: \`@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)\`. Spring inject proxy vào singleton; proxy delegate đến instance thực theo request context tại thời điểm gọi. Hoặc inject \`ObjectProvider<RequestScopedBean>\` và call \`.getObject()\` khi cần.` },
]),

// ── DEPENDENCY INJECTION ────────────────────────────────────────────────
'dependency-injection': qa([
  { q: 'Constructor injection có ưu điểm gì so với field injection?',
    a: `**A:** (1) **Immutability**: dependencies final → thread-safe và rõ ràng về required dependencies. (2) **Testability**: instantiate class trực tiếp \`new Service(repo)\` mà không cần Spring container — unit test đơn giản hơn. (3) **Circular dependency detection**: Spring fail fast khi startup thay vì runtime. (4) **Explicit contract**: constructor signature rõ ràng về dependencies cần thiết. Field injection (\`@Autowired\` trên field) ẩn dependencies, cần Spring để instantiate, không thể mark final. Spring team recommend constructor injection.` },
  { q: 'Circular dependency xảy ra thế nào và Spring xử lý thế nào?',
    a: `**A:** A depends on B, B depends on A → circular. Với constructor injection: Spring throw \`BeanCurrentlyInCreationException\` at startup — fail fast là behavior tốt. Với field/setter injection: Spring resolve bằng cách tạo bean A trước (incomplete), inject vào B, rồi inject B vào A — có thể hoạt động nhưng che giấu design problem. Best fix: refactor để loại bỏ circular dependency — extract common logic sang bean C, hoặc dùng event-based communication (\`ApplicationEventPublisher\`).` },
]),

// ── AUTO CONFIGURATION ──────────────────────────────────────────────────
'auto-configuration': qa([
  { q: 'Spring Boot auto-configuration hoạt động thế nào?',
    a: `**A:** Spring Boot scan \`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports\` (Spring Boot 3) hoặc \`spring.factories\` (Boot 2) trong mỗi jar — liệt kê các AutoConfiguration class. Mỗi AutoConfiguration dùng \`@Conditional\` annotations để quyết định có activate không: \`@ConditionalOnClass\` (class có trong classpath?), \`@ConditionalOnMissingBean\` (bean chưa tồn tại?), \`@ConditionalOnProperty\` (property có set?). Ví dụ: \`DataSourceAutoConfiguration\` chỉ active khi H2/MySQL driver trong classpath và DataSource bean chưa có.` },
  { q: 'Disable một auto-configuration cụ thể thế nào?',
    a: `**A:** (1) Annotation: \`@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})\`. (2) Property: \`spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration\`. (3) Override bean: tạo \`@Bean DataSource\` của riêng mình — \`@ConditionalOnMissingBean\` trên auto-config sẽ skip. Cách 3 là idiomatic nhất — bạn cần DataSource nhưng muốn customize, không phải disable hoàn toàn. Debug auto-configuration: thêm \`--debug\` flag, Spring Boot print "CONDITIONS EVALUATION REPORT".` },
]),

// ── REQUEST FLOW ─────────────────────────────────────────────────────────
'request-flow': qa([
  { q: 'Filter và Interceptor khác nhau thế nào?',
    a: `**A:** Filter (javax.servlet): Servlet API, nằm ngoài Spring context, intercept trước khi request đến DispatcherServlet — dùng cho CORS, authentication (Spring Security), compression, request logging. Interceptor (HandlerInterceptor): Spring-aware, chạy trong DispatcherServlet sau HandlerMapping resolve handler, có access đến handler method thông tin. preHandle/postHandle/afterCompletion. Dùng Interceptor cho: authorization check có biết endpoint, audit logging với method info. Dùng Filter cho: low-level concerns (encoding, security headers).` },
  { q: '@ControllerAdvice hoạt động thế nào?',
    a: `**A:** \`@ControllerAdvice\` là global exception handler — apply cho tất cả controllers (hoặc subset nếu specify \`basePackages\`). \`@ExceptionHandler\` trong ControllerAdvice intercept exception từ bất kỳ controller nào. Spring scan ControllerAdvice beans và register exception handler; khi exception không handled trong controller → DispatcherServlet tìm matching @ExceptionHandler. Cần define hierarchy: specific exception trước generic — Spring pick most specific match. Combine với \`@ResponseStatus\` để set HTTP status code.` },
]),

// ── PROXY MECHANISM ──────────────────────────────────────────────────────
'proxy-mechanism': qa([
  { q: '@Transactional self-invocation không work vì sao?',
    a: `**A:** Spring AOP proxy wrap bean bên ngoài. Khi external caller gọi \`service.methodA()\` → proxy intercept → start transaction → call actual \`methodA()\`. Nếu \`methodA()\` gọi \`this.methodB()\` — \`this\` là actual object, không phải proxy → \`@Transactional\` trên \`methodB()\` bị bypass. Fix: (1) Inject \`self\`: \`@Autowired MyService self;\` rồi \`self.methodB()\`. (2) Tách ra service khác. (3) Dùng AspectJ weaving (load-time weaving, không dùng proxy). Đây là gotcha phổ biến nhất với Spring AOP.` },
  { q: 'Khi nào Spring dùng JDK proxy vs CGLIB?',
    a: `**A:** JDK Dynamic Proxy: khi bean implement ít nhất một interface VÀ \`proxyTargetClass=false\` (default trước Spring Boot). CGLIB: khi class không implement interface, hoặc \`@EnableAspectJAutoProxy(proxyTargetClass=true)\`. Spring Boot 2.0+: default CGLIB cho tất cả (proxyTargetClass=true). Reason: CGLIB tránh edge cases khi inject vào biến có type là concrete class thay vì interface. JDK proxy cần interface. CGLIB không thể proxy final class/method — đây là limitation cần biết.` },
]),

// ── JWT ──────────────────────────────────────────────────────────────────
'jwt': qa([
  { q: 'JWT stateless có nghĩa gì và ảnh hưởng gì đến security?',
    a: `**A:** Server không lưu session — mọi thông tin xác thực nằm trong token. Ưu điểm: horizontal scale dễ (không cần sticky session hay shared session store). Nhược điểm: không thể revoke token trước khi hết hạn — nếu token bị leak, valid đến hết exp. Mitigation: (1) Access token TTL ngắn (15 phút), refresh token dài hơn. (2) Refresh token rotation — mỗi lần refresh tạo pair mới, invalidate pair cũ. (3) Token blocklist trong Redis cho revocation (hy sinh stateless một phần).` },
  { q: 'HS256 và RS256 khác nhau thế nào? Khi nào dùng loại nào?',
    a: `**A:** HS256 (HMAC-SHA256): symmetric — cùng secret key cho sign và verify. Tất cả service verify token phải có secret → secret phải share. RS256 (RSA-SHA256): asymmetric — private key ký, public key verify. Public key có thể publish (JWKS endpoint) → service khác verify mà không có private key. Dùng HS256 khi chỉ có một service issue và verify (monolith). Dùng RS256 trong microservices — Auth Server giữ private key, các service chỉ cần public key từ JWKS endpoint.` },
  { q: 'Refresh token rotation là gì và tại sao cần?',
    a: `**A:** Mỗi khi dùng refresh token để lấy access token mới, server tạo refresh token mới và invalidate token cũ. Nếu refresh token bị steal: attacker dùng → rotate → victim dùng token cũ → server detect reuse → invalidate cả family token → cả attacker lẫn victim bị logout. Detect theft nhanh hơn. Implement: lưu refresh token family trong DB (Redis), khi detect reuse → revoke toàn bộ family. RFC 6749 recommends rotation nhưng không bắt buộc.` },
]),

// ── OAUTH2 ────────────────────────────────────────────────────────────────
'oauth2': qa([
  { q: 'Các OAuth2 grant type khác nhau khi nào dùng?',
    a: `**A:** Authorization Code: web app với backend, dùng kèm PKCE cho SPA/mobile. Implicit: deprecated — không dùng (token lộ trong URL fragment). Client Credentials: machine-to-machine (không có user), ví dụ: microservice gọi nhau. Device Code: TV/IoT không có browser. Resource Owner Password: legacy, tránh dùng (user nhập credential vào client app). Authorization Code + PKCE là recommendation hiện tại cho mọi client type (RFC 9700).` },
  { q: 'PKCE là gì và tại sao SPA cần nó?',
    a: `**A:** PKCE (Proof Key for Code Exchange): extension ngăn authorization code interception attack. SPA không thể giữ client_secret an toàn (JS bị inspect được). Với PKCE: client generate random \`code_verifier\`, hash thành \`code_challenge\` (SHA256), gửi challenge với authorization request. Khi đổi code lấy token, gửi kèm code_verifier. Auth server verify hash match — attacker có code nhưng không có verifier → không thể đổi token. Spring Authorization Server và Keycloak đều enforce PKCE cho public clients.` },
]),

// ── B-TREE INDEX ─────────────────────────────────────────────────────────
'b-tree-index': qa([
  { q: 'Clustered index và secondary index khác nhau thế nào trong InnoDB?',
    a: `**A:** Clustered index: B-tree sắp xếp theo PK, leaf nodes chứa **full row data**. Mỗi bảng InnoDB chỉ có một clustered index (thường là PRIMARY KEY). Secondary index: leaf nodes chứa **PK value** thay vì row data. Query qua secondary index cần thêm bước "bookmark lookup" — dùng PK để tìm row trong clustered index (trừ khi covering index). Vì vậy: query nhiều qua secondary index trên bảng lớn → double B-tree traversal → chọn PK nhỏ và sequential (BIGINT AUTO_INCREMENT).` },
  { q: 'Thứ tự columns trong composite index quan trọng thế nào?',
    a: `**A:** Rule: Leftmost prefix. Index (a, b, c) được dùng cho: \`WHERE a=?\`, \`WHERE a=? AND b=?\`, \`WHERE a=? AND b=? AND c=?\`. KHÔNG được dùng cho: \`WHERE b=?\` hoặc \`WHERE c=?\` (thiếu leftmost column). Thứ tự recommend: (1) equality columns trước, range columns sau; (2) high-selectivity columns trước (nhiều unique values). Ví dụ: \`WHERE status='ACTIVE' AND created_at > '2024-01'\` → index (status, created_at) tốt hơn (created_at, status).` },
  { q: 'Covering index là gì và benefit thế nào?',
    a: `**A:** Query được "covered" bởi index khi tất cả columns cần thiết (SELECT, WHERE, ORDER BY) đều nằm trong index — không cần touch data page. Benefit: chỉ traverse index B-tree (nhỏ hơn nhiều so với full table), IOPS giảm đáng kể. EXPLAIN hiển thị \`Extra: Using index\` (không phải "Using index condition"). Ví dụ: query \`SELECT user_id, status FROM orders WHERE created_at > ?\` → index (created_at, user_id, status) là covering. Đây là kỹ thuật optimization mạnh nhất cho read-heavy queries.` },
]),

// ── TRANSACTIONS ─────────────────────────────────────────────────────────
'transactions': qa([
  { q: 'ACID properties giải thích cụ thể trong context của DB?',
    a: `**A:** **Atomicity**: transaction là "all or nothing" — nếu bất kỳ operation nào fail, toàn bộ rollback. Implement bằng undo log. **Consistency**: transaction dẫn từ consistent state này sang consistent state khác — constraints (FK, UNIQUE) không bị vi phạm. **Isolation**: concurrent transactions không thấy intermediate state của nhau — implement bằng MVCC hoặc locking. **Durability**: committed transaction persist ngay cả khi crash — implement bằng redo log (WAL). Thực tế: C và I có trade-off với performance.` },
  { q: '@Transactional(readOnly=true) có tác dụng gì?',
    a: `**A:** (1) **Performance hint**: Hibernate flush mode set sang NEVER — không cần dirty checking, tiết kiệm CPU. (2) **Routing**: với DataSource routing (read replica), readOnly=true → route đến replica. (3) **Optimization**: InnoDB có thể skip lock acquisition cho consistent read. (4) **Fail-fast**: nếu code try write trong readOnly transaction → DataAccessException. Không bảo vệ khỏi stale read trong REPEATABLE READ. Luôn dùng readOnly=true cho service method chỉ SELECT.` },
]),

// ── ISOLATION LEVELS ─────────────────────────────────────────────────────
'isolation-levels': qa([
  { q: 'Dirty read, non-repeatable read, phantom read là gì? Ví dụ cụ thể.',
    a: `**A:** **Dirty read**: T1 đọc data chưa commit của T2. T2 rollback → T1 đã dùng data không bao giờ tồn tại. **Non-repeatable read**: T1 SELECT row → T2 UPDATE và COMMIT → T1 SELECT lại cùng row → giá trị khác. **Phantom read**: T1 SELECT COUNT WHERE age>18 → T2 INSERT user mới age=20 và COMMIT → T1 SELECT lại → count khác. InnoDB REPEATABLE READ ngăn cả phantom read bằng next-key lock — khác với SQL standard chỉ ngăn non-repeatable read.` },
  { q: 'Tại sao MySQL REPEATABLE READ là default thay vì READ COMMITTED?',
    a: `**A:** REPEATABLE READ là default trong MySQL InnoDB vì lý do lịch sử liên quan đến binlog-based replication. Với STATEMENT-based replication, READ COMMITTED có thể gây inconsistency giữa master và replica trong một số pattern. ROW-based replication (default MySQL 8) không có vấn đề này, nên nhiều app có thể safely dùng READ COMMITTED để giảm lock contention. PostgreSQL default là READ COMMITTED. Trong Spring: \`@Transactional(isolation = Isolation.READ_COMMITTED)\` để override.` },
]),

// ── INNODB & MVCC ────────────────────────────────────────────────────────
'innodb-mvcc': qa([
  { q: 'MVCC cho phép reader và writer không block nhau thế nào?',
    a: `**A:** Mỗi row InnoDB có hidden: DB_TRX_ID (transaction ID tạo/modify version này) và DB_ROLL_PTR (pointer đến undo log version cũ). Khi transaction bắt đầu, JVM ghi lại "read view" — snapshot của active transactions. Reader tìm row version có DB_TRX_ID < min active transaction ID (đã committed trước snapshot). Writer tạo version mới và append vào undo log chain, không overwrite. Kết quả: reader thấy consistent snapshot, writer không block reader và ngược lại.` },
  { q: 'Tại sao transaction dài gây vấn đề với undo log?',
    a: `**A:** Undo log lưu tất cả version cũ cho MVCC. Transaction dài (chạy hàng giờ) giữ read view tại thời điểm bắt đầu — MySQL không thể purge undo log của các version cũ hơn read view này. Kết quả: undo log tăng không giới hạn, ibdata1 (tablespace) phình to, query chậm hơn do phải traverse undo chain dài. InnoDB metrics: \`SHOW ENGINE INNODB STATUS\` — check "History list length". Rule: giữ transaction ngắn, không để open transaction qua user interaction.` },
]),

// ── N+1 PROBLEM ──────────────────────────────────────────────────────────
'n-1-problem': qa([
  { q: 'N+1 problem xảy ra thế nào? Ví dụ code cụ thể.',
    a: `**A:** Load 1 query lấy N Order objects, sau đó với mỗi Order, Hibernate lazy-load \`order.getItems()\` → thêm 1 query = tổng N+1 queries. Ví dụ: \`List<Order> orders = orderRepo.findAll();\` (1 query) rồi \`orders.forEach(o -> o.getItems().size())\` → 100 additional queries. Detect bằng Hibernate \`hibernate.show_sql=true\` hoặc p6spy. Ảnh hưởng: 100 orders → 101 queries thay vì 1.` },
  { q: 'Fix N+1 trong JPA/Hibernate bằng những cách nào?',
    a: `**A:** (1) **JOIN FETCH**: \`SELECT o FROM Order o JOIN FETCH o.items WHERE o.userId=:id\` — một query lấy tất cả. (2) **@EntityGraph**: \`@EntityGraph(attributePaths={"items"})\` trên repository method. (3) **Batch fetching**: \`@BatchSize(size=50)\` trên collection — Hibernate group N lazy loads thành batches của 50, không hoàn hảo nhưng giảm queries. (4) **DTO projection**: chỉ SELECT fields cần thiết, không load entity với lazy collection. (5) **MyBatis**: dùng ResultMap với JOIN — một query, không N+1 risk.` },
]),

// ── KAFKA ────────────────────────────────────────────────────────────────
'kafka': qa([
  { q: 'Kafka đảm bảo ordering ở mức nào?',
    a: `**A:** Kafka đảm bảo ordering **trong cùng partition** — messages với cùng partition key luôn đến consumer theo thứ tự. Không đảm bảo ordering **across partitions**. Ví dụ: tất cả events của userId=123 gửi với key="123" → luôn vào cùng partition → consumer thấy theo thứ tự. Nếu cần global ordering → dùng 1 partition (throughput thấp). Trade-off: nhiều partition = throughput cao = consumers nhiều = ordering không đảm bảo across partitions.` },
  { q: 'Exactly-once semantics trong Kafka đạt được thế nào?',
    a: `**A:** Cần kết hợp: (1) **Idempotent Producer**: \`enable.idempotence=true\` — mỗi message có sequence number, broker deduplicate retry. (2) **Transactional Producer**: \`transactional.id\` — atomic write across partitions và consumer offset. (3) **Consumer**: đọc với \`isolation.level=read_committed\` — chỉ thấy committed message. Exactly-once có overhead: latency tăng, throughput giảm. Kafka Streams hỗ trợ EOS natively. Trong practice, at-least-once + idempotent consumer thường đủ tốt và đơn giản hơn.` },
  { q: 'Consumer group rebalancing xảy ra khi nào và tác động gì?',
    a: `**A:** Rebalance trigger: consumer join/leave group, consumer heartbeat timeout, partition thay đổi (add/remove). Trong rebalance: tất cả consumer dừng consume (stop-the-world), group coordinator redistribute partitions. Tác động: latency spike, có thể duplicate processing (uncommitted offsets được reprocess). Minimize: tăng \`session.timeout.ms\`, dùng Static Membership (\`group.instance.id\`) — consumer reconnect với cùng assignment mà không trigger rebalance. Incremental Cooperative Rebalancing (Kafka 2.4+) chỉ reassign affected partitions.` },
]),

// ── CONSUMER GROUP ────────────────────────────────────────────────────────
'consumer-group': qa([
  { q: 'Tại sao số consumers trong group không vượt số partitions?',
    a: `**A:** Mỗi partition chỉ được assign cho một consumer trong group tại một thời điểm — để đảm bảo ordering và không duplicate processing. Nếu consumers > partitions: consumer thừa sẽ idle (không có partition nào để consume). Ví dụ: 3 partitions, 5 consumers → 3 consume, 2 idle. Scale consumer group: tăng partitions trước (không thể giảm), rồi tăng consumers. Với nhiều consumer group khác nhau (group A, group B): mỗi group nhận toàn bộ messages — Kafka multicast.` },
  { q: 'Consumer lag là gì và monitor thế nào?',
    a: `**A:** Consumer lag = khoảng cách giữa latest offset của partition và committed offset của consumer group — số messages chưa được process. Lag tăng = consumer không theo kịp producer. Monitor: \`kafka-consumer-groups.sh --describe --group myGroup\`, hoặc JMX metrics \`kafka.consumer:type=consumer-fetch-manager-metrics,client-id=*,records-lag-max\`. Alert khi lag tăng consistently (không phải spike ngắn). Fix: tăng consumers (và partitions nếu cần), optimize consumer processing, hoặc scale producer down.` },
]),

// ── DEAD LETTER QUEUE ────────────────────────────────────────────────────
'dead-letter-queue-dlq': qa([
  { q: 'DLQ (Dead Letter Queue) là gì và tại sao cần?',
    a: `**A:** DLQ là queue/topic nhận messages không xử lý được sau N lần retry — poison message không block queue chính. Không có DLQ: một message lỗi gây retry loop → block consumer → processing dừng toàn bộ. Với DLQ: message lỗi → retry 3 lần → gửi vào DLQ với metadata (original topic, exception, retry count) → queue chính tiếp tục. DLQ cần monitor (alert khi có message vào) và có process manual review/reprocess.` },
  { q: 'Retry strategy nào phù hợp cho Kafka consumer errors?',
    a: `**A:** (1) **In-memory retry**: \`DefaultErrorHandler\` với \`FixedBackOff(1000, 3)\` — retry 3 lần trong cùng consumer thread. Nhanh nhưng block partition. (2) **Retry topic**: gửi message sang \`order.RETRY.1\`, \`order.RETRY.2\` với delay (Kafka không native delay — dùng timestamp trong header). (3) **Exponential backoff**: tăng wait time giữa retries. Tránh retry vô hạn — classify errors: transient (network, DB connection → retry) vs permanent (validation error → DLQ ngay). Spring Kafka: \`SeekToCurrentErrorHandler` + `DeadLetterPublishingRecoverer\`.` },
]),

// ── IDEMPOTENCY ──────────────────────────────────────────────────────────
'idempotency-deduplication': qa([
  { q: 'Idempotent consumer implement thế nào?',
    a: `**A:** Cần unique message ID (Kafka offset + partition, hoặc business ID trong message header). Trước khi process: check xem ID đã process chưa (Redis, DB). Nếu đã xử lý → skip và ack. Nếu chưa → process → lưu ID → ack. Store: Redis SET với TTL (SET idempotency:{messageId} 1 EX 86400 NX) — NX chỉ set nếu chưa tồn tại. DB: unique constraint trên message_id column — duplicate INSERT throw exception → catch và ack. TTL phải đủ dài để cover retry window.` },
]),

// ── CIRCUIT BREAKER ──────────────────────────────────────────────────────
'circuit-breaker': qa([
  { q: 'Circuit Breaker giải quyết vấn đề gì mà retry không giải quyết được?',
    a: `**A:** Retry: "downstream fail → wait → thử lại" — tốt cho transient failures. Nhưng khi downstream consistently down: retry tích lũy → thread pool exhausted → gây cascade failure. Circuit Breaker: sau threshold failures, OPEN circuit → **fail immediately** mà không retry, giải phóng thread pool. Downstream có thời gian recover. HALF_OPEN: probe sau cooldown. Tóm lại: Retry giải quyết transient failures, Circuit Breaker ngăn cascade failures khi service down kéo dài.` },
  { q: 'Resilience4j configure Circuit Breaker thế nào?',
    a: `**A:** \`slidingWindowType=COUNT_BASED\` (N calls) hoặc \`TIME_BASED\` (N giây). \`failureRateThreshold=50\` — 50% failures trong window → OPEN. \`waitDurationInOpenState=30s\` — cooldown. \`permittedNumberOfCallsInHalfOpenState=5\` — 5 probe calls. \`slowCallDurationThreshold=2s\` + \`slowCallRateThreshold=80\` — slow calls cũng tính là failure. Combine với \`@Retry\` (retry trước) và \`@Bulkhead\` (limit concurrent calls): \`@Retry → @CircuitBreaker → @Bulkhead\` là full resilience stack.` },
]),

// ── SAGA PATTERN ─────────────────────────────────────────────────────────
'saga-pattern': qa([
  { q: 'Compensating transaction là gì? Ví dụ cụ thể.',
    a: `**A:** Khi một step trong saga fail, không thể rollback các step đã committed (distributed system không có 2PC atomic). Thay vào đó, chạy compensating transaction để undo effect: Order saga — \`createOrder\` → \`chargePayment\` → \`reserveInventory\`. Nếu \`reserveInventory\` fail → chạy \`refundPayment\` (compensate \`chargePayment\`) và \`cancelOrder\` (compensate \`createOrder\`). Compensating transaction là business operation, không phải DB rollback. Cần design idempotent — có thể gọi nhiều lần.` },
  { q: 'Choreography và Orchestration Saga có trade-off gì?',
    a: `**A:** Choreography (event-driven): services react to events, không có central coordinator. Ưu: loose coupling, resilient (không single point of failure). Nhược: flow khó trace, business logic phân tán khắp services, testing complex. Orchestration (centralized): Saga Orchestrator gọi services theo thứ tự, handle compensation. Ưu: flow rõ ràng, dễ debug, single place implement logic. Nhược: orchestrator là central dependency, có thể trở thành bottleneck. Chọn choreography cho simple flow ít steps; orchestration cho complex saga nhiều steps và compensation logic phức tạp.` },
]),

// ── CQRS ─────────────────────────────────────────────────────────────────
'cqrs': qa([
  { q: 'CQRS khác CQS (Command Query Separation) thế nào?',
    a: `**A:** CQS (Bertrand Meyer): method level — method hoặc là command (modify state, return void) hoặc query (return data, no side effect). CQRS: architecture level — separate models, separate handlers, thường separate storage cho reads và writes. CQS là lightweight principle áp dụng cho mọi class. CQRS là architectural pattern nặng hơn, phù hợp cho complex domain với read/write workload asymmetric (read nhiều hơn write nhiều lần). Không cần CQRS cho CRUD đơn giản.` },
  { q: 'Read model trong CQRS sync từ write model thế nào?',
    a: `**A:** Event-driven sync: write side publish domain events (OrderCreated, ItemAdded); event handler project events vào read model (denormalized view table, Elasticsearch index, Redis cache). Eventual consistency: read model có thể lag vài ms đến giây sau write. Query handler đọc từ read model. Nếu user cần read-your-writes: sau write, redirect đến URL có timestamp, query check timestamp để serve từ write DB cho request đó. Event sourcing complement CQRS — write side lưu events, rebuild read model bất cứ lúc nào bằng replay.` },
]),

// ── RATE LIMITING ────────────────────────────────────────────────────────
'rate-limiting': qa([
  { q: 'Token Bucket và Leaky Bucket khác nhau thế nào?',
    a: `**A:** Token Bucket: allow burst — nếu bucket có tokens tích lũy, nhiều requests có thể pass ngay. Refill tokens theo rate cố định. Burst friendly, average rate controlled. Leaky Bucket: smooth output rate — requests queue vào bucket, process ở rate cố định (leak out). Nếu bucket đầy → reject. Không allow burst, output rate uniform. Token Bucket: cho API rate limiting có burst provision (user có thể gửi 10 requests/giây burst, average 5/giây). Leaky Bucket: cho traffic shaping, network QoS.` },
  { q: 'Implement rate limiting distributed (nhiều app instance) thế nào?',
    a: `**A:** Mỗi instance tự track → không accurate với nhiều instances. Cần centralized counter: Redis. Pattern: \`INCR userId:window EX 60\` — atomic increment với expiry. Nếu result > limit → reject. Hoặc dùng Lua script cho atomic check-and-increment. Sliding window: ZSET với \`ZADD userId:requests now timestamp\` + \`ZREMRANGEBYSCORE\` để remove old entries + \`ZCARD\` đếm current. Bucket4j + Redis là library Java cho distributed rate limiting. API Gateway (Kong, AWS API Gateway) cũng cung cấp built-in distributed rate limiting.` },
]),

// ── LOAD BALANCING ─────────────────────────────────────────────────────
'load-balancing': qa([
  { q: 'Least Connections algorithm phù hợp khi nào?',
    a: `**A:** Phù hợp khi requests có response time khác nhau đáng kể — một số requests xử lý nhanh, một số chậm (database queries, file upload). Round Robin không tính đến việc server A đang có 100 slow connections trong khi server B chỉ có 2 — Round Robin vẫn phân phối đều. Least Connections route đến server ít active connections nhất → load thực tế cân bằng hơn. Weighted Least Connections: kết hợp số connections + server capacity. Nginx: \`least_conn;\` directive.` },
  { q: 'Layer 4 và Layer 7 load balancing khác nhau thế nào?',
    a: `**A:** L4 (Transport): route dựa trên IP + TCP/UDP port. Không inspect packet content, rất nhanh. Không thể route theo URL path hay HTTP header. Dùng cho: TCP traffic không phải HTTP, extremely high throughput. L7 (Application): inspect HTTP header, URL, cookie → route thông minh hơn. Ví dụ: \`/api/static\` → cache server, \`/api/search\` → search cluster. Hỗ trợ TLS termination, compression, WebSocket upgrade. AWS ALB là L7; NLB là L4. Nginx/HAProxy hỗ trợ cả hai.` },
]),

// ── CACHING ──────────────────────────────────────────────────────────────
'caching': qa([
  { q: 'Cache Stampede là gì và prevent thế nào?',
    a: `**A:** Cache key expire đồng thời, hàng trăm requests cùng lúc miss cache và đổ vào DB → DB quá tải. Prevent: (1) **Mutex/Lock**: chỉ một request rebuild cache, request khác chờ. Redis: \`SET lock:key 1 NX EX 10\` → chỉ winner proceed. (2) **Early Expiration**: background thread refresh trước khi expire (probabilistic early expiration). (3) **Stagger TTL**: \`TTL = base_ttl + random(0, variance)\` — các keys expire ở các thời điểm khác nhau. (4) **Promise/Future**: request đang rebuild trả về promise, request khác wait trên cùng promise.` },
  { q: 'Write-through và Write-behind caching khác nhau thế nào?',
    a: `**A:** Write-through: write vào cache và DB synchronously — consistency tốt nhưng write latency tăng (cả hai phải succeed). Write-behind (write-back): write vào cache, ACK client ngay; async flush vào DB sau. Write latency thấp nhưng nếu cache node crash trước khi flush → data loss. Read-through: cache tự load từ DB khi miss (thay vì app load). Cache-aside (lazy loading): app tự manage cache: miss → load từ DB → populate cache. Cache-aside là pattern phổ biến nhất trong Java với Spring @Cacheable.` },
]),

// ── DOCKER ───────────────────────────────────────────────────────────────
'docker': qa([
  { q: 'Docker layer caching hoạt động thế nào? Optimize Dockerfile thế nào?',
    a: `**A:** Mỗi instruction trong Dockerfile tạo một layer. Nếu instruction và context không thay đổi → Docker reuse cached layer (không rebuild). Principle: đặt ít thay đổi trước, nhiều thay đổi sau. Tối ưu Java Dockerfile: COPY pom.xml trước → RUN mvn dependency:go-offline (cache dependencies) → COPY src/ → RUN mvn package. Khi chỉ thay đổi source code: chỉ rebuild 2 layers cuối, không re-download dependencies. \`COPY . .\` ở đầu là anti-pattern — bất kỳ file nào thay đổi đều invalidate cache.` },
  { q: '.dockerignore và tại sao quan trọng?',
    a: `**A:** \`.dockerignore\` list files/directories không copy vào build context. Build context = tất cả files Docker daemon nhận trước khi build. Không có .dockerignore: \`COPY . .\` copy cả \`target/\`, \`.git/\`, \`node_modules/\` → build context hàng GB, slow build, layer thừa trong image. Nên ignore: \`target/\`, \`.git\`, \`*.log\`, \`.env\`, \`node_modules\`. Giữ image nhỏ: chỉ copy artifacts cần thiết (multi-stage build: build stage → copy .jar sang runtime stage).` },
]),

// ── KUBERNETES ───────────────────────────────────────────────────────────
'kubernetes': qa([
  { q: 'Pod và Container khác nhau thế nào?',
    a: `**A:** Container: isolated process với own filesystem, network namespace. Pod: smallest deployable unit trong K8s — một hoặc nhiều containers share cùng network namespace (cùng IP, port space) và storage volumes. Containers trong cùng Pod communicate qua localhost. Pod là ephemeral — không persist sau crash, Deployment tạo Pod mới. Multi-container Pod dùng cho: sidecar (logging agent, service mesh proxy), init containers (database migration trước khi main container start).` },
  { q: 'Liveness probe và Readiness probe khác nhau như thế nào?',
    a: `**A:** **Liveness**: kiểm tra app có đang running không. Fail → K8s restart container. Dùng cho: deadlock detection, hung process. Endpoint: \`/actuator/health/liveness\`. **Readiness**: kiểm tra app có sẵn sàng nhận traffic không. Fail → K8s remove pod khỏi Service endpoints (không route traffic). Dùng khi: app đang warmup, cache loading, DB connection không sẵn sàng. Endpoint: \`/actuator/health/readiness\`. Startup probe (K8s 1.16+): cho slow-starting app — disable liveness check trong startup period để tránh restart loop.` },
  { q: 'ConfigMap và Secret khác nhau thế nào?',
    a: `**A:** ConfigMap: non-sensitive configuration (app.properties, feature flags) — stored plaintext trong etcd. Secret: sensitive data (passwords, API keys, certificates) — base64 encoded (không encrypted by default). Để thực sự secure Secrets: bật etcd encryption at rest, dùng Sealed Secrets hoặc External Secrets Operator (pull từ AWS Secrets Manager / HashiCorp Vault). Secret inject vào Pod: environment variable (\`secretKeyRef\`) hoặc volume mount (file — prefer vì không expose trong \`kubectl describe pod\`).` },
]),

// ── SINGLETON PATTERN ────────────────────────────────────────────────────
'singleton': qa([
  { q: 'Enum singleton tốt hơn double-checked locking thế nào?',
    a: `**A:** Enum singleton: JVM guarantee lazy initialization, thread-safe, serialization-safe (không tạo extra instance khi deserialize). \`public enum Config { INSTANCE; public void doSomething(){} }\`. Double-checked locking: cần volatile (Java 5+ fix), complex code, serialization có thể break (cần implement \`readResolve()\`). Holder pattern: cũng tốt — \`private static class Holder { static final T INSTANCE = new T(); }\`. JVM class loading đảm bảo Holder chỉ initialized một lần, thread-safe.` },
  { q: 'Spring singleton bean và GoF Singleton pattern khác nhau thế nào?',
    a: `**A:** Spring singleton: một instance per ApplicationContext — nếu có 2 contexts (test + prod trong cùng JVM), có 2 instances của bean. GoF Singleton: một instance per ClassLoader (per JVM trong hầu hết cases). Spring singleton không enforce private constructor hay getInstance() — bất kỳ ai cũng có thể \`new MyService()\`. Spring singleton là container-managed scoping, không phải creational pattern. Trong Spring app: không cần implement GoF Singleton — để Spring quản lý bean lifecycle là đủ.` },
]),

// ── REDIS ─────────────────────────────────────────────────────────────────
'redis': qa([
  { q: 'Redis persistence options và khi nào dùng loại nào?',
    a: `**A:** **RDB (Snapshot)**: fork process, dump snapshot vào file định kỳ. Fast restart (load snapshot), nhưng mất data từ lần snapshot cuối đến lúc crash. Dùng cho: cache (mất data chấp nhận được), backup point-in-time. **AOF (Append Only File)**: log mọi write command, replay khi restart. \`appendfsync always\` (safe nhưng slow), \`everysec\` (1s durability, balance), \`no\` (OS decides). Dùng cho: cần durability cao hơn. **AOF + RDB**: dùng cả hai — best of both worlds. Redis 7+: RDB-AOF hybrid format.` },
  { q: 'Redis cluster và Redis Sentinel khác nhau thế nào?',
    a: `**A:** **Redis Sentinel**: high availability cho single master setup. Sentinel monitors master, tự động failover sang replica khi master down. Không hỗ trợ horizontal scaling — dữ liệu vẫn trên một master. Dùng khi: HA quan trọng nhưng dataset nhỏ. **Redis Cluster**: horizontal sharding — tự động chia data sang nhiều master nodes (16384 hash slots). Mỗi master có replica. Scale read và write. Dùng khi: dataset lớn hơn một server hoặc cần horizontal write scaling. Trade-off: Cluster không support multi-key operations qua shards.` },
]),

// ── SHARDING ────────────────────────────────────────────────────────────
'sharding': qa([
  { q: 'Hot spot problem trong sharding là gì và giải quyết thế nào?',
    a: `**A:** Hot spot: một shard nhận significantly nhiều traffic hơn các shard khác. Ví dụ: shard theo user_id range — user 1-1M (mostly inactive) vs user 1M-2M (active users). Hoặc: một celebrity account nhận 10M requests/day — nếu shard theo userId, shard đó bị overload. Fix: (1) **Virtual shards**: nhiều logical shards per physical shard, tái distribute khi cần. (2) **Consistent hashing** với virtual nodes. (3) **Compound key**: (userId, timestamp) thay vì chỉ userId. (4) **Cache hot data** tại layer trên.` },
  { q: 'Resharding là gì và tại sao phức tạp?',
    a: `**A:** Resharding = redistribute data khi thêm hoặc bớt shard node. Modulo sharding (hash % N): thêm node từ 3→4 → hầu hết keys map sang shard mới → phải move ~75% data — data migration expensive và có downtime risk. Consistent hashing: thêm node → chỉ move 1/N keys (keys của adjacent range) — minimal disruption. MongoDB, Cassandra, DynamoDB dùng consistent hashing với virtual nodes để online resharding. Luôn plan shard strategy trước — resharding production là một trong những riskiest operations.` },
]),

// ── CONSISTENT HASHING ───────────────────────────────────────────────────
'consistent-hashing': qa([
  { q: 'Tại sao consistent hashing tốt hơn simple modulo sharding?',
    a: `**A:** Modulo (hash(key) % N): thêm/bớt 1 node → N thay đổi → hầu hết keys map sang node khác → massive data movement. Consistent hashing: nodes placed on ring by hash; key routes to nearest node clockwise. Thêm 1 node: chỉ keys của adjacent section cần move (~1/N keys). Bớt 1 node: chỉ keys của node đó move sang successor. Consistent hashing dùng trong: Cassandra, DynamoDB, Memcached, Redis Cluster, Nginx upstream (consistent_hash).` },
  { q: 'Virtual nodes giải quyết vấn đề gì?',
    a: `**A:** Không có virtual nodes: 3 nodes → 3 points trên ring → uneven distribution (120° mỗi node lý tưởng, nhưng hash không uniform). Thêm node → một node chịu nhiều hơn (hotspot). Virtual nodes: mỗi physical node có V virtual positions trên ring (V thường = 100-200). Kết quả: phân phối đồng đều hơn, thêm node = nhận một phần đều từ tất cả existing nodes (không chỉ từ adjacent node). Cassandra: virtual nodes (vnodes) là core của data distribution.` },
]),

// ── STRUCTURED LOGGING ───────────────────────────────────────────────────
'structured-logging': qa([
  { q: 'Structured logging là gì và lợi ích so với text logging?',
    a: `**A:** Structured logging: log theo format machine-readable (JSON) thay vì free-text. Ví dụ: \`{"timestamp":"2024-01-15T10:30:00","level":"ERROR","traceId":"abc123","userId":"42","message":"Payment failed","errorCode":"INSUFFICIENT_FUNDS"}\`. Lợi ích: (1) Search/filter trong Elasticsearch/Splunk chính xác: \`errorCode:INSUFFICIENT_FUNDS AND userId:42\`. (2) Metrics từ logs: count bằng field cụ thể. (3) Correlation với traceId qua services. Text logging: \`"User 42 payment failed: insufficient funds"\` → phải parse regex để extract fields.` },
  { q: 'MDC (Mapped Diagnostic Context) là gì?',
    a: `**A:** MDC: thread-local key-value store để attach context vào tất cả log statements trong request. Ví dụ: \`MDC.put("traceId", "abc123"); MDC.put("userId", "42");\` → mọi log.info() trong request tự động include traceId và userId mà không cần pass vào từng method. Trong Spring Boot: Spring Security filter có thể set MDC, hoặc dùng Spring Cloud Sleuth/Micrometer Tracing tự động inject traceId/spanId vào MDC. Nhớ \`MDC.clear()\` sau request (thread pool reuse thread — MDC bị leak nếu không clear).` },
]),

// ── PROMETHEUS GRAFANA ────────────────────────────────────────────────────
'prometheus-grafana': qa([
  { q: 'Counter, Gauge, Histogram trong Prometheus khác nhau thế nào?',
    a: `**A:** **Counter**: chỉ tăng (reset về 0 khi restart). Dùng cho: request count, error count. Query: \`rate(http_requests_total[5m])\` — requests/giây trong 5 phút. **Gauge**: có thể tăng/giảm. Dùng cho: memory usage, active connections, queue size. Query: \`jvm_memory_used_bytes\`. **Histogram**: sample observations vào buckets, tính quantile. Dùng cho: request duration, response size. Query: \`histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))\` — p99 latency. Summary: tương tự histogram nhưng quantile tính phía client — không thể aggregate across instances.` },
  { q: 'Alert effective bằng cách nào? Viết alert rule thế nào?',
    a: `**A:** Alert rule tốt: symptom-based (user-facing metric) thay vì cause-based. Ví dụ: alert khi \`p99 latency > 1s\` (symptom) thay vì \`CPU > 80%\` (cause — CPU cao không nhất thiết user bị ảnh hưởng). Grafana rule: \`WHEN avg() OF query(A, 5m, now) IS ABOVE 1\`. Prometheus alertrule: \`expr: histogram_quantile(0.99,...) > 1\`, \`for: 5m\` (phải persist 5 phút, không phải spike). \`for\` clause tránh flapping. Labels \`severity: critical/warning\` để route đến Alertmanager → PagerDuty (critical) vs Slack (warning).` },
]),

// ── EUREKA CONSUL ────────────────────────────────────────────────────────
'eureka-consul': qa([
  { q: 'Service Discovery tại sao cần và implement thế nào?',
    a: `**A:** Microservices scale dynamically — IP/port thay đổi khi container restart. Hard-code IP là anti-pattern. Client-side discovery: client query registry (Eureka) lấy instance list, tự load balance (Ribbon/Spring LoadBalancer). Server-side discovery: client gọi load balancer (AWS ALB), LB query registry nội bộ. Eureka: AP (Availability over Consistency) — trong network partition, tiếp tục serve stale registry hơn là unavailable. Consul: CP (Consistency) — strong consistency, cũng là KV store và DNS server.` },
  { q: 'Tại sao Spring Cloud đang dịch chuyển từ Eureka sang Kubernetes native discovery?',
    a: `**A:** Kubernetes đã cung cấp service discovery natively: K8s Service DNS (\`order-service.default.svc.cluster.local\`) + kube-proxy load balance. Dùng thêm Eureka trong K8s = duplicate functionality, thêm component cần maintain. Spring Cloud Kubernetes tích hợp với K8s API trực tiếp. Eureka vẫn cần cho: hybrid deployment (K8s + VMs), multi-cluster discovery, hoặc team đang migrate từ Spring Cloud Netflix stack. Mới: dùng K8s Service + Spring Cloud LoadBalancer, không cần Eureka.` },
]),

// ── API GATEWAY ──────────────────────────────────────────────────────────
'api-gateway': qa([
  { q: 'API Gateway pattern giải quyết những vấn đề gì?',
    a: `**A:** (1) **Single entry point**: client không cần biết internal service topology. (2) **Cross-cutting concerns**: authentication, rate limiting, CORS, request logging — implement một lần tại gateway thay vì mỗi service. (3) **Protocol translation**: HTTP ngoài → gRPC trong. (4) **Request aggregation**: một request client → gọi nhiều microservices, aggregate response. (5) **Backend for Frontend (BFF)**: gateway riêng cho web, mobile, partner APIs. Trade-off: gateway là single point of failure (cần HA) và thêm latency hop.` },
]),

// ── FEIGN CLIENT ─────────────────────────────────────────────────────────
'feign-client': qa([
  { q: 'Feign Client khác RestTemplate thế nào?',
    a: `**A:** RestTemplate: imperative, URL building thủ công, verbose. Feign: declarative — define interface với annotation, Feign generate implementation. \`@FeignClient(name="payment-service")\` + \`@PostMapping("/payments")\` → Feign tự handle serialization, HTTP call, error handling. Integrate với Spring Cloud LoadBalancer (client-side LB) và Circuit Breaker. Feign là preferred trong Spring Cloud microservices. RestTemplate deprecated trong Spring 5 (dùng WebClient cho reactive hoặc RestClient/Feign cho synchronous).` },
  { q: 'Handle error với Feign Client thế nào?',
    a: `**A:** (1) **ErrorDecoder**: custom decode HTTP error response → throw specific exception. \`@Bean ErrorDecoder errorDecoder() { return (methodKey, response) -> new PaymentException(...); }\`. (2) **Fallback**: \`@FeignClient(fallback = PaymentFallback.class)\` — implement interface với fallback method khi service down. (3) **FallbackFactory**: \`fallbackFactory\` cho phép access Throwable để log reason. (4) **Retry**: \`@Retryable\` hoặc Feign Retryer. Combine với \`@CircuitBreaker\` để stop retry khi circuit open.` },
]),

// ── READ REPLICA ─────────────────────────────────────────────────────────
'read-replica': qa([
  { q: 'Replication lag ảnh hưởng thế nào và handle thế nào?',
    a: `**A:** MySQL async replication: replica có thể lag 10ms đến giây sau primary. Read-your-writes problem: user vừa update profile → refresh trang → query replica → thấy data cũ. Fix options: (1) Route đến primary ngay sau write (in same session). (2) Application-level timestamp: client gửi \`X-Written-At\` header, nếu replica lag > timestamp → fallback primary. (3) Semi-synchronous replication: primary chờ ít nhất 1 replica confirm trước khi commit — tăng write latency, giảm lag. (4) Accept eventual consistency cho non-critical reads.` },
  { q: 'Implement read/write routing trong Spring Boot thế nào?',
    a: `**A:** AbstractRoutingDataSource: xác định DataSource dựa trên current context. \`@Transactional(readOnly=true)\` set context → RoutingDataSource chọn replica. Implement: extend \`AbstractRoutingDataSource\`, override \`determineCurrentLookupKey()\` → check \`TransactionSynchronizationManager.isCurrentTransactionReadOnly()\`. Register primary và replicas với keys "write"/"read". AspectJ intercept \`@Transactional(readOnly=true)\` và set thread-local key. Library: Spring Data JPA DataSource Proxy hoặc Sharding-JDBC (ShardingSphere) đều support read/write splitting out-of-box.` },
]),

// ── FACTORY METHOD ─────────────────────────────────────────────────────
'factory-method': qa([
  { q: 'Factory Method và Abstract Factory khác nhau thế nào?',
    a: `**A:** Factory Method: một method trong class tạo một loại object — subclass override để tạo loại cụ thể. Ví dụ: NotificationFactory có \`createNotification()\`, EmailFactory override tạo EmailNotification. Abstract Factory: interface tạo **family of related objects** — không chỉ một object mà nhiều objects liên quan (Button + Checkbox + Dialog theo theme). Dùng Factory Method khi: muốn subclass quyết định loại object. Abstract Factory khi: cần tạo nhóm objects phải compatible nhau.` },
]),

// ── BUILDER ─────────────────────────────────────────────────────────────
'builder': qa([
  { q: 'Tại sao Builder tốt hơn telescoping constructor?',
    a: `**A:** Telescoping constructor: \`new User(name, email, phone, address, age)\` — 5 tham số, dễ nhầm thứ tự, không rõ tham số nào là gì. Builder: \`User.builder().name("John").email("j@e.com").age(30).build()\` — explicit, readable, optional fields dễ handle. Named parameters (không phải positional). Immutable object dễ tạo. Validate trong \`build()\`. Lombok \`@Builder\` generate automatically. Tránh builder khi object đơn giản (< 4 tham số) — overkill.` },
]),

// ── STRATEGY PATTERN ──────────────────────────────────────────────────
'strategy': qa([
  { q: 'Strategy Pattern giải quyết vấn đề gì? Ví dụ thực tế.',
    a: `**A:** Thay vì if/switch chọn algorithm, encapsulate mỗi algorithm trong class riêng, swap runtime. Ví dụ: PaymentService có các strategy: CreditCardPayment, PayPalPayment, CryptoPayment. \`paymentService.setStrategy(new CreditCardPayment()); paymentService.pay(amount);\`. Khi thêm payment method mới: chỉ thêm class mới, không sửa PaymentService (Open/Closed Principle). Spring: inject strategy bằng \`Map<String, PaymentStrategy>\` — key là payment type, value là bean. Factory method để select strategy.` },
]),

// ── OBSERVER PATTERN ─────────────────────────────────────────────────
'observer': qa([
  { q: 'Observer Pattern và Spring ApplicationEvent khác nhau thế nào?',
    a: `**A:** GoF Observer: subject giữ list observers, gọi trực tiếp. Tight coupling: subject biết về observer interface. Spring ApplicationEvent: EventPublisher publish event → container dispatch đến tất cả listeners trong context. Loose coupling: publisher không biết về listeners. Async: \`@Async @EventListener\` để process asynchronously. Transactional: \`@TransactionalEventListener(phase=AFTER_COMMIT)\` — chỉ trigger sau transaction commit. Ví dụ: OrderCreated event → send email (async) + update inventory + notify analytics.` },
]),

// ── TEMPLATE METHOD ──────────────────────────────────────────────────
'template-method': qa([
  { q: 'Template Method Pattern dùng ở đâu trong Spring?',
    a: `**A:** Spring dùng rộng rãi: JdbcTemplate (define SQL execution flow, bạn cung cấp SQL + RowMapper), RestTemplate, JpaTemplate. AbstractController: Spring MVC đặt request handling flow, subclass override specific steps. AbstractApplicationContext: refresh() là template method. Pattern: abstract class define algorithm skeleton trong final method, abstract methods cho steps cần customize. Ngăn subclass thay đổi flow, chỉ thay đổi bước cụ thể. Java: HttpServlet có doGet/doPost là template methods.` },
]),

// ── CHAIN OF RESPONSIBILITY ──────────────────────────────────────────
'chain-of-responsibility': qa([
  { q: 'Chain of Responsibility dùng ở đâu trong Java ecosystem?',
    a: `**A:** Servlet Filter chain (mỗi Filter gọi \`chain.doFilter()\`), Spring Security FilterChain (Authentication → Authorization → Exception Handling), Spring Interceptor preHandle chain, Netty ChannelPipeline, OkHttp Interceptors. Pattern: Handler giữ reference đến next handler, process request hoặc pass along. Khác Strategy: Strategy chọn một algorithm; Chain dùng nhiều handlers tuần tự, handler có thể dừng chain hoặc pass tiếp. Thêm handler mới không ảnh hưởng chain hiện tại.` },
]),

// ── ADAPTER PATTERN ──────────────────────────────────────────────────
'adapter': qa([
  { q: 'Adapter Pattern ứng dụng trong Java thực tế thế nào?',
    a: `**A:** Wrap incompatible interface thành interface mong đợi. Ví dụ: \`Arrays.asList()\` — adapt array thành List interface. \`InputStreamReader\` — adapt InputStream (byte stream) thành Reader (char stream). Spring: \`HandlerAdapter\` adapt các loại handler khác nhau (@RequestMapping, HttpRequestHandler) thành interface DispatcherServlet hiểu. \`JpaRepositoryAdapter\` wrap JPA EntityManager thành Spring Data Repository interface. Object Adapter (composition): \`class Adapter implements Target { private Adaptee adaptee; }\`. Class Adapter (inheritance): ít dùng hơn.` },
]),

};

// ── PROCESS FILES ─────────────────────────────────────────────────────────────
let updated = 0;
let skipped = 0;
let notFound = 0;

for (const [slug, newSection] of Object.entries(QA)) {
  const filePath = path.join(dir, slug + '.md');

  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    console.warn(`  NOT FOUND: ${slug}.md`);
    notFound++;
    continue;
  }

  if (content.includes('<details>')) {
    console.log(`  already updated: ${slug}.md`);
    skipped++;
    continue;
  }

  const updated_content = replaceQA(content, newSection);
  if (updated_content === null) {
    console.warn(`  no Q section found: ${slug}.md`);
    skipped++;
    continue;
  }

  writeFileSync(filePath, updated_content, 'utf-8');
  console.log(`  ✓ ${slug}.md`);
  updated++;
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${notFound} not found`);
