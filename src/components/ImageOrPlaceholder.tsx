'use client'
import { useState, CSSProperties } from 'react'

type Props = {
  src: string
  alt: string
  /** Label shown if the image fails to load (placeholder fallback). */
  label?: string
  className?: string
  style?: CSSProperties
  /** Apply object-fit: cover (default true). Set false for object-fit: contain. */
  cover?: boolean
  /** Loading hint for browser. */
  loading?: 'lazy' | 'eager'
  /** decoding hint for browser. */
  decoding?: 'async' | 'sync' | 'auto'
}

/**
 * Renders an <img> that fills its parent with object-fit: cover.
 * On error, falls back to the existing .placeholder hatched div with the label.
 * Parent should have width/height set; this fills 100% of both.
 */
export default function ImageOrPlaceholder({
  src,
  alt,
  label,
  className = '',
  style,
  cover = true,
  loading = 'lazy',
  decoding = 'async',
}: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={`placeholder ${className}`} style={{ width: '100%', height: '100%', ...style }}>
        {label && <span className="placeholder-label">{label}</span>}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        objectFit: cover ? 'cover' : 'contain',
        display: 'block',
        ...style,
      }}
      loading={loading}
      decoding={decoding}
      onError={() => setFailed(true)}
    />
  )
}
