import { Moon, Sun, Menu, X, Map } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface NavigationProps {
  darkMode: boolean
  setDarkMode: (value: boolean) => void
}

export default function Navigation({ darkMode, setDarkMode }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/'

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setIsOpen(false)
  }

  const goHome = () => {
    if (isHome) {
      scrollToSection('hero')
    } else {
      navigate('/')
      setIsOpen(false)
    }
  }

  const goRoadmap = () => {
    if (isHome) {
      navigate('/experience')
    } else {
      scrollToSection('roadmap')
    }
  }

  return (
    <nav className="fixed top-0 w-full bg-white/90 dark:bg-dark/90 backdrop-blur-sm border-b border-slate-200 dark:border-gray-800 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="text-primary font-mono text-xl font-bold">
            nhan.nguyen
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <button onClick={goHome} className="hover:text-primary transition-colors">
              Home
            </button>
            {isHome ? (
              <>
                <button onClick={() => scrollToSection('experience')} className="hover:text-primary transition-colors">
                  Experience
                </button>
                <button onClick={() => scrollToSection('projects')} className="hover:text-primary transition-colors">
                  Projects
                </button>
                <button onClick={() => scrollToSection('contact')} className="hover:text-primary transition-colors">
                  Contact
                </button>
              </>
            ) : null}
            <button onClick={goRoadmap} className="inline-flex items-center gap-2 hover:text-primary transition-colors">
              <Map size={16} />
              Roadmap
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={darkMode}
              className="p-2 hover:bg-slate-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={darkMode}
              className="p-2 hover:bg-slate-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="p-2 hover:bg-slate-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-slate-200 dark:border-gray-800">
            <div className="flex flex-col space-y-4">
              <button onClick={goHome} className="text-left hover:text-primary transition-colors">
                Home
              </button>
              {isHome ? (
                <>
                  <button onClick={() => scrollToSection('experience')} className="text-left hover:text-primary transition-colors">
                    Experience
                  </button>
                  <button onClick={() => scrollToSection('projects')} className="text-left hover:text-primary transition-colors">
                    Projects
                  </button>
                  <button onClick={() => scrollToSection('contact')} className="text-left hover:text-primary transition-colors">
                    Contact
                  </button>
                </>
              ) : null}
              <button onClick={goRoadmap} className="text-left hover:text-primary transition-colors">
                Roadmap
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
