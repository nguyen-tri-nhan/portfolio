import { useState } from 'react'
import ReviewSidebar from '../components/review/ReviewSidebar'
import ReviewDetail from '../components/review/ReviewDetail'

export default function ReviewV2() {
  const [selectedFile, setSelectedFile] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [search, setSearch] = useState('')

  const handleSelect = (file: string, name: string) => {
    setSelectedFile(file)
    setSelectedName(name)
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden review-v2">
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
          <span className="text-xs text-slate-500 font-mono">
            {selectedFile ? `review-content/${selectedFile}.md` : 'Bản Đồ Kiến Thức Java'}
          </span>
          <a
            href="/review"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← HTML version
          </a>
        </header>

        {/* Content */}
        <ReviewDetail file={selectedFile} name={selectedName} />
      </main>
    </div>
  )
}
