import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 240)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className={`fixed bottom-6 right-6 z-50 inline-flex items-center justify-center rounded-full border border-primary/30 bg-white/90 text-primary shadow-lg backdrop-blur transition-all duration-200 dark:bg-dark/90 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <span className="p-3">
        <ArrowUp size={20} />
      </span>
    </button>
  )
}
