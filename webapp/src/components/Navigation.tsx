import { Moon, Sun, Menu, X } from 'lucide-react'
import { useState } from 'react'

interface NavigationProps {
  darkMode: boolean
  setDarkMode: (value: boolean) => void
}

export default function Navigation({ darkMode, setDarkMode }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false)

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setIsOpen(false)
  }

  return (
    <nav className="fixed top-0 w-full bg-dark/90 backdrop-blur-sm border-b border-gray-800 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="text-primary font-mono text-xl font-bold">
            nhan.nguyen
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <button onClick={() => scrollToSection('hero')} className="hover:text-primary transition-colors">
              Home
            </button>
            <button onClick={() => scrollToSection('experience')} className="hover:text-primary transition-colors">
              Experience
            </button>
            <button onClick={() => scrollToSection('projects')} className="hover:text-primary transition-colors">
              Projects
            </button>
            <button onClick={() => scrollToSection('contact')} className="hover:text-primary transition-colors">
              Contact
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-gray-800">
            <div className="flex flex-col space-y-4">
              <button onClick={() => scrollToSection('hero')} className="text-left hover:text-primary transition-colors">
                Home
              </button>
              <button onClick={() => scrollToSection('experience')} className="text-left hover:text-primary transition-colors">
                Experience
              </button>
              <button onClick={() => scrollToSection('projects')} className="text-left hover:text-primary transition-colors">
                Projects
              </button>
              <button onClick={() => scrollToSection('contact')} className="text-left hover:text-primary transition-colors">
                Contact
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}