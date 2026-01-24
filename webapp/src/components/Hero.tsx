import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  COMMAND_DEFINITIONS,
  buildCommandMap,
  buildHelpText,
  pickFortune,
  TerminalCommandContext
} from '../data/terminalCommands'

const PROMPT = 'nhan@portfolio:~$'
const RESUME_URL = '/resume.pdf'

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
  const [commandLog, setCommandLog] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [commandHistory, setCommandHistory] = useState<
    { command: string; response: string; visibleLength?: number; isTyping?: boolean }[]
  >([])
  const terminalContentRef = useRef<HTMLDivElement>(null)
  const commandInputRef = useRef<HTMLInputElement>(null)

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

  const scrollToProjects = () => {
    document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToContact = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const helpText = buildHelpText(COMMAND_DEFINITIONS)
  const commandMap = buildCommandMap(COMMAND_DEFINITIONS)

  const getMatchingCommands = (input: string) => {
    const normalized = input.trim().toLowerCase()
    if (!normalized) {
      return COMMAND_DEFINITIONS
    }
    return COMMAND_DEFINITIONS.filter((definition) => {
      if (definition.command.startsWith(normalized)) return true
      return definition.aliases?.some((alias) => alias.startsWith(normalized)) ?? false
    })
  }

  const applyAutocomplete = () => {
    const normalized = commandInput.trim().toLowerCase()
    if (!normalized) return
    const matches = getMatchingCommands(normalized)
    if (matches.length === 0) return
    if (matches.length === 1) {
      setCommandInput(matches[0].command)
      return
    }
    const prefix = matches
      .map((match) => match.command)
      .reduce((acc, value) => {
        let next = acc
        while (next && !value.startsWith(next)) {
          next = next.slice(0, -1)
        }
        return next
      }, matches[0].command)
    if (prefix && prefix.length > normalized.length) {
      setCommandInput(prefix)
    }
  }

  const handleCommand = (value: string) => {
    const rawCommand = value.trim()
    const command = rawCommand.toLowerCase()
    if (!command) return

    const historySnapshot = [...commandLog]
    const sudoHandler = commandMap.get('sudo')
    const matchedDefinition = command.startsWith('sudo ')
      ? sudoHandler
      : commandMap.get(command)

    const context: TerminalCommandContext = {
      scrollToExperience,
      scrollToProjects,
      scrollToContact,
      scrollToTop,
      openUrl: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
      resumeUrl: RESUME_URL,
      history: historySnapshot,
      now: () => new Date(),
      pickFortune,
      helpText
    }

    const result = matchedDefinition
      ? matchedDefinition.run(context)
      : { response: 'Unknown command. Try: help' }

    if (result.clearHistory) {
      setCommandHistory([
        { command: rawCommand, response: result.response, visibleLength: 0, isTyping: true }
      ])
      setCommandLog([])
      setHistoryIndex(-1)
      return
    }

    setCommandLog((prev) => [...prev, rawCommand])
    setHistoryIndex(-1)
    setCommandHistory((prev) => [
      ...prev,
      { command: rawCommand, response: result.response, visibleLength: 0, isTyping: true }
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
        return prev.map((entry, index) => {
          if (index !== prev.length - 1) return entry
          return {
            ...entry,
            isTyping: false,
            visibleLength: entry.response.length
          }
        })
      })
      return
    }

    const timer = setTimeout(() => {
      setCommandHistory((prev) => {
        return prev.map((entry, index) => {
          if (index !== prev.length - 1) return entry
          if (!entry.isTyping) return entry
          const nextLength = (entry.visibleLength ?? 0) + 1
          const done = nextLength >= entry.response.length
          return {
            ...entry,
            visibleLength: Math.min(nextLength, entry.response.length),
            isTyping: done ? false : entry.isTyping
          }
        })
      })
    }, 10)

    return () => clearTimeout(timer)
  }, [commandHistory])

  useEffect(() => {
    if (typingComplete) {
      commandInputRef.current?.focus()
    }
  }, [typingComplete])

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (!commandInput.trim()) return
      handleCommand(commandInput)
      setCommandInput('')
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (commandLog.length === 0) return
      const nextIndex = historyIndex === -1 ? commandLog.length - 1 : Math.max(historyIndex - 1, 0)
      setHistoryIndex(nextIndex)
      setCommandInput(commandLog[nextIndex] ?? '')
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (commandLog.length === 0 || historyIndex === -1) return
      const nextIndex = historyIndex + 1
      if (nextIndex >= commandLog.length) {
        setHistoryIndex(-1)
        setCommandInput('')
      } else {
        setHistoryIndex(nextIndex)
        setCommandInput(commandLog[nextIndex] ?? '')
      }
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      applyAutocomplete()
    }
  }

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
                      <span className="text-xs text-slate-500 dark:text-gray-400">{PROMPT}</span>
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
                  <span className="text-xs text-slate-500 dark:text-gray-400">{PROMPT}</span>
                  <input
                    ref={commandInputRef}
                    value={commandInput}
                    onChange={(event) => {
                      setCommandInput(event.target.value)
                      setHistoryIndex(-1)
                    }}
                    onKeyDown={handleInputKeyDown}
                    className="flex-1 bg-transparent outline-none text-slate-800 caret-primary dark:text-gray-200"
                    placeholder="Type: help"
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
