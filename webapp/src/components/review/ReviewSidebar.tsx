import { useState, useMemo } from 'react'
import { REVIEW_TOPICS, ReviewCategory, ReviewTopic } from '../../review-content/topics'
import { ChevronRight } from 'lucide-react'

interface Props {
  selected: string
  onSelect: (file: string, name: string) => void
  search: string
  onSearch: (q: string) => void
}

export default function ReviewSidebar({ selected, onSelect, search, onSearch }: Props) {
  // Track which categories / topics are expanded
  const [openCats, setOpenCats]   = useState<Record<string, boolean>>({ '1. Core Java': true })
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({})

  const toggleCat   = (t: string) => setOpenCats(p => ({ ...p, [t]: !p[t] }))
  const toggleTopic = (n: string) => setOpenTopics(p => ({ ...p, [n]: !p[n] }))

  // Filter by search
  const filtered = useMemo<ReviewCategory[]>(() => {
    if (!search.trim()) return REVIEW_TOPICS
    const q = search.toLowerCase()
    return REVIEW_TOPICS
      .map(cat => ({
        ...cat,
        topics: cat.topics
          .map(tp => ({
            ...tp,
            subs: tp.subs.filter(s => s.name.toLowerCase().includes(q)),
          }))
          .filter(tp => tp.name.toLowerCase().includes(q) || tp.subs.length > 0),
      }))
      .filter(cat => cat.topics.length > 0)
  }, [search])

  // Auto-expand when searching
  const isSearching = search.trim().length > 0

  const renderTopic = (tp: ReviewTopic, catOpen: boolean) => {
    if (!catOpen && !isSearching) return null
    const tpOpen = isSearching || !!openTopics[tp.name]
    const hasSubs = tp.subs.length > 0

    return (
      <div key={tp.name}>
        {/* Topic row */}
        <button
          onClick={() => {
            if (hasSubs) {
              toggleTopic(tp.name)
            } else if (tp.file) {
              onSelect(tp.file, tp.name)
            }
          }}
          className={`
            w-full flex items-center gap-1 px-3 py-1.5 text-sm text-left
            transition-colors hover:bg-white/5
            ${selected === tp.file && !hasSubs
              ? 'text-blue-400 bg-blue-950/30'
              : 'text-slate-300'}
          `}
        >
          {hasSubs && (
            <ChevronRight
              size={13}
              className={`shrink-0 transition-transform text-slate-500 ${tpOpen ? 'rotate-90' : ''}`}
            />
          )}
          {!hasSubs && <span className="w-3.5 shrink-0" />}
          <span className="truncate">{tp.name}</span>
        </button>

        {/* Subtopics */}
        {hasSubs && tpOpen && (
          <div className="ml-4 border-l border-slate-700/50">
            {tp.subs.map(sub => (
              <button
                key={sub.name}
                onClick={() => sub.file && onSelect(sub.file, sub.name)}
                disabled={!sub.file}
                className={`
                  w-full text-left px-3 py-1 text-xs truncate transition-colors
                  ${!sub.file ? 'text-slate-600 cursor-default' : 'hover:bg-white/5'}
                  ${selected === sub.file
                    ? 'text-blue-400 bg-blue-950/30 font-medium'
                    : 'text-slate-400'}
                `}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="flex flex-col h-full bg-slate-900 border-r border-slate-700/60 w-64 shrink-0">
      {/* Search */}
      <div className="p-3 border-b border-slate-700/60">
        <input
          type="search"
          placeholder="Tìm kiếm…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-full bg-slate-800 text-slate-200 placeholder-slate-500 text-sm
                     rounded px-3 py-1.5 outline-none border border-slate-700
                     focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-700">
        {filtered.map(cat => {
          const catOpen = isSearching || !!openCats[cat.title]
          return (
            <div key={cat.title} className="mb-1">
              {/* Category header */}
              <button
                onClick={() => toggleCat(cat.title)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold
                           text-slate-400 uppercase tracking-wider hover:text-slate-200
                           transition-colors"
              >
                <span className="text-base">{cat.icon}</span>
                <span className="flex-1 text-left">{cat.title}</span>
                <ChevronRight
                  size={13}
                  className={`transition-transform text-slate-600 ${catOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {/* Topics */}
              {cat.topics.map(tp => renderTopic(tp, catOpen))}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-slate-700/60 text-center text-xs text-slate-600">
        {REVIEW_TOPICS.reduce((n, c) => n + c.topics.length, 0)} topics
      </div>
    </aside>
  )
}
