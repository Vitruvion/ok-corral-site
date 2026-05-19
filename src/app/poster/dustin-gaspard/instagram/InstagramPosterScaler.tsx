'use client'

/**
 * Instagram-feed variant scaler. Mirrors the print poster's
 * PosterScaler exactly, with one difference: the layout box is
 * 1080×1350 (Instagram 4:5 portrait feed) instead of 1080×1800.
 *
 * Same iOS-Safari defensive behavior as the print scaler — measures
 * the parent .stage's clientHeight alongside window.innerHeight and
 * re-fits on visualViewport.resize so the layout adapts when the
 * address bar collapses or expands.
 */

import { useEffect, useRef } from 'react'

type Props = {
  className?: string
  children: React.ReactNode
}

const SUPPRESS_GLOBAL_DECORATIONS = `
  body::before, body::after { display: none !important; }
`

export default function InstagramPosterScaler({ className, children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const fit = () => {
      const pad = 24
      const stage = wrap.parentElement
      const stageH = stage ? stage.clientHeight : window.innerHeight
      const availW = window.innerWidth - pad * 2
      const availH = Math.min(stageH, window.innerHeight) - pad * 2
      const sx = availW / 1080
      const sy = availH / 1350
      const s = Math.min(sx, sy)
      wrap.style.transform = `scale(${s})`
    }

    fit()
    window.addEventListener('resize', fit)
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
