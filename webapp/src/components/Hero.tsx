import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

const TERMINAL_LINES = [
  '$ whoami',
  'Nhan Nguyen - Software Engineer @ Katalon',
  '$ cat experience.json',
  '{',
  '  "company": "Katalon (2021-Present)",',
  '  "focus": ["Test Automation", "AI/GenAI", "Microservices"],',
  '  "backend": ["Quarkus", "Kotlin", "Spring Boot", "Java"],',
  '  "frontend": ["React", "TypeScript", "Micro-frontends"],',
  '  "devops": ["GitHub Actions", "Grafana", "SonarCloud"]',
  '}',
  '$ view_experience'
]

export default function Hero() {
  const [currentLine, setCurrentLine] = useState(0)
  const [currentChar, setCurrentChar] = useState(0)
  const [showCursor, setShowCursor] = useState(true)
  const [commandInput, setCommandInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<
    { command: string; response: string; visibleLength?: number; isTyping?: boolean }[]
  >([])
  const terminalContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentLine < TERMINAL_LINES.length) {
        if (currentChar < TERMINAL_LINES[currentLine].length) {
          setCurrentChar(currentChar + 1)
        } else {
          setCurrentLine(currentLine + 1)
          setCurrentChar(0)
        }
      }
    }, 5)

    return () => clearTimeout(timer)
  }, [currentLine, currentChar])

  useEffect(() => {
    const cursorTimer = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 500)

    return () => clearInterval(cursorTimer)
  }, [])

  const scrollToExperience = () => {
    document.getElementById('experience')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleCommand = (value: string) => {
    const rawCommand = value.trim()
    const command = rawCommand.toLowerCase()
    if (!command) return

    let response = ''
    if (command.startsWith('sudo ')) {
      response = 'Nice try. Boss mode unlocks after the salary hits the account.'
    } else if (command === 'view_experience') {
      scrollToExperience()
      response = 'Scrolling to experience...'
    } else if (command === 'go github' || command === 'github') {
      window.open('https://github.com/nguyen-tri-nhan', '_blank', 'noopener,noreferrer')
      response = 'Opening GitHub...'
    } else if (command === 'go linkedin' || command === 'linkedin') {
      window.open('https://www.linkedin.com/in/nguyen-tri-nhan/', '_blank', 'noopener,noreferrer')
      response = 'Opening LinkedIn...'
    } else if (command === 'help') {
      response =
        'Available commands:\n' +
        '- view_experience: scroll to the experience section\n' +
        '- github or go github: open my GitHub profile\n' +
        '- linkedin or go linkedin: open my LinkedIn profile\n' +
        '- help: show this list'
    } else {
      response = 'Unknown command. Try: help'
    }

    setCommandHistory((prev) => [
      ...prev,
      command === 'help'
        ? { command: rawCommand, response, visibleLength: 0, isTyping: true }
        : { command: rawCommand, response }
    ])
  }

  const typingComplete = currentLine >= TERMINAL_LINES.length
  
  useEffect(() => {
    if (!terminalContentRef.current) return
    terminalContentRef.current.scrollTop = terminalContentRef.current.scrollHeight
  }, [currentLine, currentChar, commandHistory])

  useEffect(() => {
    const lastEntry = commandHistory[commandHistory.length - 1]
    if (!lastEntry?.isTyping) return

    if ((lastEntry.visibleLength ?? 0) >= lastEntry.response.length) {
      setCommandHistory((prev) => {
        const next = [...prev]
        const entry = next[next.length - 1]
        if (!entry?.isTyping) return prev
        entry.isTyping = false
        return next
      })
      return
    }

    const timer = setTimeout(() => {
      setCommandHistory((prev) => {
        const next = [...prev]
        const entry = next[next.length - 1]
        if (!entry?.isTyping) return prev
        const nextLength = (entry.visibleLength ?? 0) + 1
        entry.visibleLength = Math.min(nextLength, entry.response.length)
        if (entry.visibleLength >= entry.response.length) {
          entry.isTyping = false
        }
        return next
      })
    }, 12)

    return () => clearTimeout(timer)
  }, [commandHistory])

  return (
    <section id="hero" className="min-h-screen flex items-center justify-center px-4 pt-16 relative z-10">
      <div className="max-w-4xl mx-auto text-center">
        <div className="terminal-window max-w-3xl mx-auto mb-8">
          <div className="terminal-header">
            <div className="terminal-dot bg-red-500"></div>
            <div className="terminal-dot bg-yellow-500"></div>
            <div className="terminal-dot bg-green-500"></div>
          </div>
          <div
            ref={terminalContentRef}
            className="terminal-content min-h-[320px] max-h-[360px] overflow-y-auto text-left pr-2"
          >
            {TERMINAL_LINES.slice(0, currentLine + 1).map((line, index) => (
              <div key={index} className="mb-2">
                {index === currentLine ? (
                  <span>
                    {line.slice(0, currentChar)}
                    {showCursor && <span className="bg-primary text-black">|</span>}
                  </span>
                ) : (
                  <span className={line.startsWith('$') ? 'text-primary' : 'text-slate-700 dark:text-gray-300'}>
                    {line}
                  </span>
                )}
              </div>
            ))}
            {typingComplete && (
              <div className="mt-2 space-y-2">
                {commandHistory.map((entry, index) => (
                  <div key={`cmd-${index}`} className="space-y-1">
                    <div className="flex items-center gap-2 text-primary">
                      <span>$</span>
                      <span className="text-slate-800 dark:text-gray-200">{entry.command}</span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-gray-400 whitespace-pre-wrap break-words">
                      {entry.isTyping
                        ? entry.response.slice(0, entry.visibleLength ?? 0)
                        : entry.response}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-primary">
                  <span>$</span>
                  <input
                    value={commandInput}
                    onChange={(event) => setCommandInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        handleCommand(commandInput)
                        setCommandInput('')
                      }
                    }}
                    className="flex-1 bg-transparent outline-none text-slate-800 dark:text-gray-200"
                    placeholder="Type: view_experience, github, or help"
                    aria-label="Terminal command input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold">
            Hello, I'm <span className="text-primary">Nhan</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 dark:text-gray-300 max-w-2xl mx-auto">
            Software Engineer passionate about creating innovative solutions with clean, efficient code
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={scrollToExperience} className="btn-primary">
              View Experience
            </button>
            <a
              href="https://github.com/nguyen-tri-nhan"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              View GitHub
            </a>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown size={32} className="text-primary" />
        </div>
      </div>
    </section>
  )
}
