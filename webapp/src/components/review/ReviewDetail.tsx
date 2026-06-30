import { useEffect, useState, lazy, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import type { Components } from 'react-markdown'

const MermaidDiagram = lazy(() => import('./MermaidDiagram'))

// Vite glob import — all MD files as raw text, lazily loaded
const mdModules = import.meta.glob('../../review-content/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

interface Props {
  file: string
  name: string
}

// Custom renderer: intercept mermaid code blocks
const makeComponents = (): Components => ({
  code(props) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children, className, node, ref: _ref, ...rest } = props as {
      children: React.ReactNode
      className?: string
      node?: unknown
      ref?: unknown
      [key: string]: unknown
    }
    const lang = /language-(\w+)/.exec(className ?? '')?.[1]

    if (lang === 'mermaid') {
      return (
        <Suspense fallback={<div className="text-slate-500 text-sm p-2">Loading diagram…</div>}>
          <MermaidDiagram chart={String(children)} />
        </Suspense>
      )
    }

    // Inline code (no language class)
    if (!className) {
      return (
        <code
          className="bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono"
          {...(rest as React.HTMLAttributes<HTMLElement>)}
        >
          {children}
        </code>
      )
    }

    // Block code — rehype-highlight has already applied classes
    return (
      <code className={className} {...(rest as React.HTMLAttributes<HTMLElement>)}>
        {children}
      </code>
    )
  },
})

const mdComponents = makeComponents()

export default function ReviewDetail({ file, name }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!file) return
    setLoading(true)
    setContent(null)

    const key = `../../review-content/${file}.md`
    const loader = mdModules[key]

    if (!loader) {
      setContent(`> Chưa có nội dung cho **${name}**.\n\nFile: \`${file}.md\``)
      setLoading(false)
      return
    }

    loader()
      .then(raw => {
        // Strip YAML frontmatter (---...---) — already shown in title
        const stripped = raw.replace(/^---[\s\S]+?---\n?/, '')
        setContent(stripped)
      })
      .catch(() => setContent('> Không thể tải nội dung.'))
      .finally(() => setLoading(false))
  }, [file, name])

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        <div className="text-center space-y-2">
          <div className="text-4xl">📖</div>
          <div>Chọn chủ đề bất kỳ từ menu bên trái</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Đang tải…
      </div>
    )
  }

  return (
    <article className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-white mb-6 pb-3 border-b border-slate-700">
        {name}
      </h1>

      {content && (
        <div className="prose-review">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, [rehypeHighlight, { detect: true }]]}
            components={mdComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </article>
  )
}
