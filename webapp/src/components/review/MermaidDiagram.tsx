import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

let mermaidReady = false

function initMermaid(dark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? 'dark' : 'default',
    darkMode: dark,
    fontFamily: 'inherit',
    fontSize: 14,
  })
  mermaidReady = true
}

let idCounter = 0

export default function MermaidDiagram({ chart, dark = true }: { chart: string; dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ref.current) return
    if (!mermaidReady) initMermaid(dark)

    const id = `mermaid-${++idCounter}`
    setError(null)

    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg
      })
      .catch((e: Error) => {
        setError(e.message)
      })
  }, [chart, dark])

  if (error) {
    return (
      <pre className="text-red-400 text-xs p-2 bg-red-950/30 rounded border border-red-800">
        Mermaid error: {error}
      </pre>
    )
  }

  return <div ref={ref} className="my-4 flex justify-center overflow-x-auto" />
}
