import { useState, useEffect } from 'react'
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
    }, 50)

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

  return (
    <section id="hero" className="min-h-screen flex items-center justify-center px-4 pt-16 relative z-10">
      <div className="max-w-4xl mx-auto text-center">
        <div className="terminal-window max-w-3xl mx-auto mb-8">
          <div className="terminal-header">
            <div className="terminal-dot bg-red-500"></div>
            <div className="terminal-dot bg-yellow-500"></div>
            <div className="terminal-dot bg-green-500"></div>
          </div>
          <div className="terminal-content min-h-[300px]">
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
