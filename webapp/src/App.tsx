import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import Hero from './components/Hero'
import Experience from './components/Experience'
import Projects from './components/Projects'
import Contact from './components/Contact'
import BinaryRain from './components/BinaryRain'
import ExperienceRoadmap from './pages/ExperienceRoadmap'
import ScrollToTopButton from './components/ScrollToTopButton'

function App() {
  const [darkMode, setDarkMode] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('darkMode')
    if (saved !== null) {
      setDarkMode(JSON.parse(saved))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-dark dark:text-white relative overflow-x-hidden">
        <BinaryRain />
        <Navigation darkMode={darkMode} setDarkMode={setDarkMode} />
        <main>
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <Hero />
                  <Experience />
                  <Projects />
                  <Contact />
                </>
              }
            />
            <Route path="/experience" element={<ExperienceRoadmap />} />
          </Routes>
        </main>
        <ScrollToTopButton />
      </div>
    </BrowserRouter>
  )
}

export default App
