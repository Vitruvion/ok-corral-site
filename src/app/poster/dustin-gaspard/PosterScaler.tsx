'use client'

/**
 * Two client-side responsibilities for the poster page:
 *
 * 1. Letterbox-fit the fixed 1080×1750 poster into whatever viewport
 *    it lands in. Mirrors the inline <script> at the bottom of the
 *    design prototype's HTML. Runs once on mount and again on resize.
 *
 * 2. Render an inline <style> tag that suppresses the site-wide
 *    body::before noise overlay + body::after vignette (declared in
 *    globals.css). Those decorations layer wrong on top of a paper-
 *    grain broadside that already has its own grain + foxing +
 *    vignette. The <style> mounts when this component mounts and
 *    unmounts when the user navigates away, so the suppression is
 *    scoped to this route without contaminating globals.css.
 */

import { useEffect, useRef } from 'react'

type Props = {
  className?: string
  children: React.ReactNode
}

const SUPPRESS_GLOBAL_DECORATIONS = `
  body::before, body::after { display: none !important; }
`

export default function PosterScaler({ className, children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const fit = () => {
      const pad = 24
      const sx = (window.innerWidth - pad * 2) / 1080
      const sy = (window.innerHeight - pad * 2) / 1750
      const s = Math.min(sx, sy)
      wrap.style.transform = `scale(${s})`
    }

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SUPPRESS_GLOBAL_DECORATIONS }} />
      <div className={className} ref={wrapRef}>
        {children}
      </div>
    </>
  )
}
