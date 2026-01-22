import { useEffect, useRef } from 'react'

export default function BinaryRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const binary = '01'
    const fontSize = 14
    let drops: number[] = []

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const columns = Math.floor(canvas.width / fontSize)
      drops = Array.from({ length: columns }, () => 1)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const draw = () => {
      const isDark = document.documentElement.classList.contains('dark')
      ctx.fillStyle = isDark ? 'rgba(10, 10, 10, 0.05)' : 'rgba(248, 250, 252, 0.5)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = isDark ? '#00ff8820' : 'rgba(16, 185, 129, 0.25)'
      ctx.font = `${fontSize}px monospace`

      for (let i = 0; i < drops.length; i++) {
        const text = binary[Math.floor(Math.random() * binary.length)]
        ctx.fillText(text, i * fontSize, drops[i] * fontSize)

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i]++
      }
    }

    const interval = setInterval(draw, 100)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-30"
    />
  )
}
