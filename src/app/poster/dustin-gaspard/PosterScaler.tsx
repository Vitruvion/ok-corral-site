'use client'

/**
 * Two client-side responsibilities for the poster page:
 *
 * 1. Letterbox-fit the fixed 1080×1800 poster into whatever viewport
 *    it lands in. Mirrors the inline <script> at the bottom of the
 *    design prototype's HTML. Runs once on mount and on resize +
 *    visualViewport changes (the latter fires on iOS Safari when
 *    the address bar collapses/expands, where plain `resize` may
 *    not — keeping the fit responsive to dynamic-viewport changes).
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
      // Use the most conservative available-height: the smaller of
      // `window.innerHeight` and the parent .stage's clientHeight (which
      // resolves the new 100svh unit on iOS Safari to the address-bar-
      // visible viewport). The original code only consulted
      // `window.innerHeight`, which on iOS could disagree with the
      // .stage's 100vh and yield a poster too tall to fit when the
      // address bar was actually showing.
      const stage = wrap.parentElement
      const stageH = stage ? stage.clientHeight : window.innerHeight
      const availW = window.innerWidth - pad * 2
      const availH = Math.min(stageH, window.innerHeight) - pad * 2
      const sx = availW / 1080
      const sy = availH / 1800
      const s = Math.min(sx, sy)
      wrap.style.transform = `scale(${s})`
    }

    fit()
    window.addEventListener('resize', fit)
    // visualViewport fires on iOS Safari when the address bar appears
    // or collapses; plain resize may not. Keeps the fit responsive.
    window.visualViewport?.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('resize', fit)
      window.visualViewport?.removeEventListener('resize', fit)
    }
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
