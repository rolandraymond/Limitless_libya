import { useEffect, useRef, useState } from 'react'
import type { createHeroInfinityScene } from './HeroInfinityScene'

type InfinityScene = Awaited<ReturnType<typeof createHeroInfinityScene>>

/** Original image fallback; synchronized infinity/reflection glow is loaded only when visible. */
export default function HeroArtwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const mobile = matchMedia('(max-width: 600px)')
    let engine: InfinityScene | undefined
    let disposed = false, visible = false, loading = false, failed = false
    let frame = 0, previous = 0, phase = 0
    const resize = () => {
      if (!engine) return
      const bounds = canvas.getBoundingClientRect()
      const scale = Math.min(1, (mobile.matches ? 560 : 1440) / Math.max(1, bounds.width))
      engine.resize(Math.max(1, Math.round(bounds.width * scale)), Math.max(1, Math.round(bounds.height * scale)), mobile.matches)
    }
    const fail = () => { failed = true; cancelAnimationFrame(frame); frame = 0; setReady(false) }
    const draw = (now: number) => {
      if (disposed || !visible || document.hidden || reduced.matches || !engine || failed) { frame = 0; return }
      if (!previous || now - previous >= 1000 / (mobile.matches ? 20 : 30)) {
        phase += previous ? (now - previous) / 1000 : 0
        previous = now
        try { engine.draw(phase); setReady(true) } catch { fail(); return }
      }
      frame = requestAnimationFrame(draw)
    }
    const initialize = async () => {
      if (loading || engine || failed || disposed || reduced.matches) return
      loading = true
      try {
        const { createHeroInfinityScene } = await import('./HeroInfinityScene')
        if (disposed) return
        const result = await createHeroInfinityScene(canvas)
        if (disposed) { result.dispose(); return }
        engine = result; resize(); update()
      } catch { if (!disposed) fail() }
      finally { loading = false }
    }
    function update() {
      cancelAnimationFrame(frame); frame = 0; previous = 0
      if (disposed || reduced.matches || failed) { if (!disposed) setReady(false); return }
      if (!visible || document.hidden) return
      if (!engine) { void initialize(); return }
      frame = requestAnimationFrame(draw)
    }
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update() })
    observer.observe(canvas)
    const sizes = new ResizeObserver(() => { resize(); update() })
    sizes.observe(canvas)
    const changed = () => { resize(); update() }
    const contextLost = (event: Event) => { event.preventDefault(); fail() }
    canvas.addEventListener('webglcontextlost', contextLost)
    reduced.addEventListener('change', update); mobile.addEventListener('change', changed)
    document.addEventListener('visibilitychange', update)
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); sizes.disconnect()
      canvas.removeEventListener('webglcontextlost', contextLost)
      reduced.removeEventListener('change', update); mobile.removeEventListener('change', changed)
      document.removeEventListener('visibilitychange', update); engine?.dispose()
    }
  }, [])
  return <div className="ly-hero-artwork" aria-hidden="true">
    <img className="ly-hero-static" src="/assets/libya-red-castle.png" alt="" fetchPriority="high" />
    <canvas ref={canvasRef} className="ly-hero-effects" style={{ opacity: ready ? 1 : 0 }} />
  </div>
}
