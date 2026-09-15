import { useEffect, useRef } from 'react'

/** Nothing-style dot matrix canvas: сетка точек + glyph-вспышки + реакция на мышь */
export function DotBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let mx = -9999, my = -9999
    const pulses: { x: number; y: number; t: number }[] = []
    const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight }
    resize()
    addEventListener('resize', resize)
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY }
    const onClick = (e: MouseEvent) => { pulses.push({ x: e.clientX, y: e.clientY, t: 0 }); if (pulses.length > 8) pulses.shift() }
    addEventListener('mousemove', onMove)
    addEventListener('click', onClick)
    let t = 0
    const GAP = 22
    const draw = () => {
      t += 0.016
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let y = GAP / 2; y < canvas.height; y += GAP) {
        for (let x = GAP / 2; x < canvas.width; x += GAP) {
          const dx = x - mx, dy = y - my
          const dist = Math.hypot(dx, dy)
          const near = Math.max(0, 1 - dist / 180)
          let r = 1.1 + near * 1.6
          let alpha = 0.16 + near * 0.5
          let red = false
          for (const p of pulses) {
            const pd = Math.hypot(x - p.x, y - p.y)
            const wave = Math.abs(pd - p.t * 320)
            if (wave < 26) { alpha = 0.9; r = 2.4; red = (Math.floor(x / GAP) + Math.floor(y / GAP)) % 5 === 0 }
          }
          // бегущая glyph-волна сверху
          const sweep = (t * 120) % (canvas.width + 300) - 150
          if (Math.abs(x - sweep) < 40 && y < canvas.height * 0.35) { alpha = Math.max(alpha, 0.5); }
          ctx.beginPath()
          ctx.fillStyle = red ? 'rgba(215,25,32,' + alpha + ')' : 'rgba(255,255,255,' + alpha * 0.55 + ')'
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      for (const p of pulses) p.t += 0.016
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('mousemove', onMove); removeEventListener('click', onClick) }
  }, [])

  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
}
