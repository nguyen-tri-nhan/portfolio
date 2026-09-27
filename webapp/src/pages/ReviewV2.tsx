import { useState } from 'react'
import ReviewSidebar from '../components/review/ReviewSidebar'
import ReviewDetail from '../components/review/ReviewDetail'
import RoadmapView from '../components/review/RoadmapView'
import { ROADMAP_KEY } from '../review-content/roadmap'

export default function ReviewV2() {
  const [selectedFile, setSelectedFile] = useState(ROADMAP_KEY)
  const [selectedName, setSelectedName] = useState('Lộ trình Backend')
  const [search, setSearch] = useState('')

  const handleSelect = (file: string, name: string) => {
    setSelectedFile(file)
    setSelectedName(name)
  }

  const showingRoadmap = selectedFile === ROADMAP_KEY

  return (
    <div className="relative z-10 flex h-screen pt-16 bg-slate-950 text-slate-100 overflow-hidden review-v2">
      {/* Left sidebar */}
      <ReviewSidebar
        selected={selectedFile}
        onSelect={handleSelect}
        search={search}
        onSearch={setSearch}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 h-10 flex items-center justify-between px-6
                           border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
          {showingRoadmap ? (
            <span className="text-xs text-slate-500 font-mono">roadmap</span>
          ) : (
            <button
              onClick={() => handleSelect(ROADMAP_KEY, 'Lộ trình Backend')}
              className="text-xs text-slate-500 hover:text-slate-300 font-mono transition-colors"
            >
              ← roadmap · review-content/{selectedFile}.md
            </button>
          )}
          <a
            href="/review"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← HTML version
          </a>
        </header>

        {/* Content */}
        {showingRoadmap ? (
          <RoadmapView onSelect={handleSelect} />
        ) : (
          <ReviewDetail file={selectedFile} name={selectedName} />
        )}
      </main>
    </div>
  )
}
