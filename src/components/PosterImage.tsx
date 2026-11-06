'use client'
import { useState, type CSSProperties, type MouseEventHandler } from 'react'
import type { PosterSize } from '@/lib/poster-size'
import styles from './PosterImage.module.css'

/**
 * An uploaded poster, in a box that is the right size BEFORE it loads.
 *
 * Every place a poster renders uses this: the expanded event, the weekly
 * flyer thumbnail, the lightbox, and the admin preview. Each says how big
 * the poster may get by setting two custom properties on an ancestor:
 *
 *   --poster-max-w   widest it may be      (default 100%)
 *   --poster-max-h   tallest it may be     (default 80vh)
 *
 * WITH A SIZE (read from the file's header on the server -- see
 * src/lib/poster-size.ts) the box is computed from the poster's own ratio:
 * as wide as allowed, narrowed so the height stays under the cap, never
 * wider than its column. No load event, no measurement, no frame: the
 * layout is identical empty and full, so nothing below it can move, and
 * it can never be larger than the space it took.
 *
 * WITHOUT ONE (the lookup failed) it falls back to a fixed-ratio frame
 * with the poster absolutely positioned and contained inside it. The
 * frame's size depends on nothing the image does, so even then it cannot
 * overflow its column or sit on top of the text below.
 */

type Props = {
  src: string
  alt: string
  /** Shown if the image fails to load. */
  label?: string
  size?: PosterSize | null
  className?: string
  loading?: 'lazy' | 'eager'
  onClick?: MouseEventHandler<HTMLElement>
}

export default function PosterImage({ src, alt, label, size, className = '', loading = 'lazy', onClick }: Props) {
  const [failed, setFailed] = useState(false)

  if (size) {
    const box = { '--pw': size.w, '--ph': size.h } as CSSProperties
    if (failed) {
      return (
        <span className={`placeholder ${styles.sized} ${className}`} style={box} role="img" aria-label={alt} onClick={onClick}>
          {label && <span className="placeholder-label">{label}</span>}
        </span>
      )
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={size.w}
        height={size.h}
        className={`${styles.sized} ${className}`}
        style={box}
        loading={loading}
        decoding="async"
        onError={() => setFailed(true)}
        onClick={onClick}
      />
    )
  }

  return (
    <span className={`${styles.frame} ${className}`} onClick={onClick}>
      {failed ? (
        <span className={`placeholder ${styles.contained}`} role="img" aria-label={alt}>
          {label && <span className="placeholder-label">{label}</span>}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={styles.contained}
          loading={loading}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}
