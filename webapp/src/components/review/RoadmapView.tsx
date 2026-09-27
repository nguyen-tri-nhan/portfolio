import { useMemo, useState } from 'react'
import { REVIEW_TOPICS } from '../../review-content/topics'
import { ROADMAP_STAGES, ROADMAP_ELECTIVES, type RoadmapStage } from '../../review-content/roadmap'

const STORAGE_KEY = 'reviewRoadmapProgress'

interface Props {
  onSelect: (file: string, name: string) => void
}

function loadProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveProgress(done: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]))
  } catch {
    // Storage blocked (private mode) — progress just won't persist.
  }
}

const topicKey = (file: string) => `t:${file}`
const criterionKey = (stageId: string, i: number) => `c:${stageId}:${i}`

export default function RoadmapView({ onSelect }: Props) {
  const [done, setDone] = useState<Set<string>>(loadProgress)

  const nameOf = useMemo(() => {
    const map = new Map<string, string>()
    REVIEW_TOPICS.forEach(cat =>
      cat.topics.forEach(tp => {
        if (tp.file) map.set(tp.file, tp.name)
        tp.subs.forEach(s => s.file && map.set(s.file, s.name))
      }),
    )
    return (file: string) => map.get(file) ?? file
  }, [])

  const toggle = (key: string) => {
    setDone(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveProgress(next)
      return next
    })
  }

  const reset = () => {
    if (!window.confirm('Xóa toàn bộ tiến độ đã đánh dấu?')) return
    const empty = new Set<string>()
    saveProgress(empty)
    setDone(empty)
  }

  const stageProgress = (stage: RoadmapStage) => {
    const keys = [
      ...stage.groups.flatMap(g => g.topics.map(t => topicKey(t.file))),
      ...stage.exitCriteria.map((_, i) => criterionKey(stage.id, i)),
    ]
    const count = keys.filter(k => done.has(k)).length
    return { count, total: keys.length, pct: Math.round((count / keys.length) * 100) }
  }

  return (
    <article className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 pb-4 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-white mb-2">🧭 Lộ trình Backend</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Không cần đọc hết mọi bài. Đi theo từng giai đoạn, chỉ chuyển sang giai đoạn sau khi
            làm được các mục <span className="text-slate-200">Tự kiểm tra</span>. Mục{' '}
            <span className="text-slate-200">Chưa cần học</span> quan trọng không kém — nó cho bạn
            quyền bỏ qua phần lớn nội dung ở giai đoạn đầu.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Tiến độ chỉ lưu trên trình duyệt này.{' '}
            <button onClick={reset} className="underline hover:text-slate-300">
              Xóa tiến độ
            </button>
          </p>
        </header>

        <ol className="relative border-l border-slate-700 ml-3 space-y-10">
          {ROADMAP_STAGES.map((stage, idx) => {
            const { count, total, pct } = stageProgress(stage)
            return (
              <li key={stage.id} className="ml-6">
                <span
                  className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full
                    text-xs font-bold ring-4 ring-slate-950
                    ${pct === 100 ? 'bg-emerald-500 text-slate-950' : 'bg-blue-600 text-white'}`}
                >
                  {idx}
                </span>

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    {stage.level}
                  </span>
                  <span className="text-xs text-slate-500">{stage.duration}</span>
                </div>
                <h2 className="text-lg font-semibold text-white">{stage.title}</h2>
                <p className="text-sm text-slate-400 mt-1">{stage.goal}</p>

                <div className="mt-3 mb-5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {count}/{total}
                  </span>
                </div>

                <div className="space-y-5">
                  {stage.groups.map(group => (
                    <section key={group.title}>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        {group.title}
                      </h3>
                      <ul className="space-y-1">
                        {group.topics.map(topic => {
                          const key = topicKey(topic.file)
                          const checked = done.has(key)
                          return (
                            <li key={topic.file} className="flex items-start gap-2 group">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(key)}
                                aria-label={`Đánh dấu đã nắm ${nameOf(topic.file)}`}
                                className="mt-1 accent-emerald-500 shrink-0"
                              />
                              <div className="min-w-0">
                                <button
                                  onClick={() => onSelect(topic.file, nameOf(topic.file))}
                                  className={`text-sm text-left hover:text-blue-300 hover:underline
                                    ${checked ? 'text-slate-500 line-through' : 'text-slate-200'}`}
                                >
                                  {nameOf(topic.file)}
                                </button>
                                <p className="text-xs text-slate-500">{topic.why}</p>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  ))}

                  <section className="rounded border border-emerald-900/60 bg-emerald-950/20 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                      Tự kiểm tra — làm được hết mới sang giai đoạn sau
                    </h3>
                    <ul className="space-y-1">
                      {stage.exitCriteria.map((c, i) => {
                        const key = criterionKey(stage.id, i)
                        return (
                          <li key={key}>
                            <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={done.has(key)}
                                onChange={() => toggle(key)}
                                className="mt-1 accent-emerald-500 shrink-0"
                              />
                              <span>{c}</span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </section>

                  {stage.notYet.length > 0 && (
                    <section className="rounded border border-amber-900/50 bg-amber-950/10 p-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
                        Chưa cần học ở giai đoạn này
                      </h3>
                      <ul className="list-disc ml-5 space-y-1 text-sm text-slate-400">
                        {stage.notYet.map(n => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        <section className="mt-12 pt-6 border-t border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-1">Môn tự chọn</h2>
          <p className="text-sm text-slate-400 mb-4">
            Không thuộc lộ trình chính. Chỉ học khi công việc thực sự cần — sau khi đã vững nền tảng.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {ROADMAP_ELECTIVES.map(el => (
              <div key={el.title} className="rounded border border-slate-700/70 bg-slate-900/60 p-3">
                <div className="text-sm font-medium text-slate-200">{el.title}</div>
                <div className="text-xs text-slate-500 mb-2">{el.when}</div>
                <div className="flex flex-wrap gap-1.5">
                  {el.files.map(f => (
                    <button
                      key={f}
                      onClick={() => onSelect(f, nameOf(f))}
                      className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      {nameOf(f)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </article>
  )
}
