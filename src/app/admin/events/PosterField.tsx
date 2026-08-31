'use client'

import { useRef, useState } from 'react'
import { formatBytes, resizeForUpload } from '@/lib/admin/image-resize'
import styles from './events.module.css'

/**
 * Poster upload.
 *
 * Resized in the page before anything is sent -- see image-resize.ts
 * for why. The progress bar is real: a poster on bar wifi is not
 * instant, and a button that just sits there gets tapped again.
 *
 * XMLHttpRequest rather than fetch, purely because fetch still has no
 * upload progress event.
 */

type Props = {
  eventId: string
  posterUrl: string | null
  onChange: (url: string | null) => void
}

export default function PosterField({ eventId, posterUrl, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    setError(null)
    setBusy(true)
    setProgress(0)
    setNote('Shrinking…')

    try {
      const shrunk = await resizeForUpload(file)
      setNote(
        shrunk.resized
          ? formatBytes(shrunk.originalBytes) + ' → ' + formatBytes(shrunk.bytes) + ', uploading…'
          : formatBytes(shrunk.bytes) + ', uploading…'
      )

      const body = new FormData()
      body.append('event_id', eventId)
      body.append('file', shrunk.file)

      const url: string = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/admin/events/poster')
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300 && data.poster_url) resolve(data.poster_url)
            else reject(new Error(data.error || 'Upload failed.'))
          } catch {
            reject(new Error('Upload failed.'))
          }
        }
        xhr.onerror = () => reject(new Error('Lost connection during upload.'))
        xhr.send(body)
      })

      onChange(url)
      setNote(
        shrunk.resized
          ? 'Uploaded · ' + formatBytes(shrunk.originalBytes) + ' → ' + formatBytes(shrunk.bytes)
          : 'Uploaded · ' + formatBytes(shrunk.bytes)
      )
    } catch (err: any) {
      setError(err?.message || 'Could not upload that image.')
      setNote(null)
    } finally {
      setBusy(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async () => {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/admin/events/poster', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not remove the poster.')
      onChange(null)
      setNote(null)
    } catch (err: any) {
      setError(err?.message || 'Could not remove the poster.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.poster}>
      <span className={styles.label}>Poster</span>

      {posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.posterImage} src={posterUrl} alt="Current poster" />
      )}

      <div className={styles.posterActions}>
        {/*
          accept + no capture attribute: iOS then offers Photo Library,
          Take Photo, and Choose File in one sheet. Setting capture would
          force the camera and hide the camera roll, which is where a
          poster from a promoter actually lives.
        */}
        <input
          ref={inputRef}
          id={'poster-' + eventId}
          className={styles.fileInput}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
          }}
        />
        <label htmlFor={'poster-' + eventId} className={styles.fileButton} aria-disabled={busy}>
          {busy ? 'Working…' : posterUrl ? 'Replace' : 'Add poster'}
        </label>

        {posterUrl && !busy && (
          <button type="button" className={styles.posterRemove} onClick={remove}>
            Remove
          </button>
        )}
      </div>

      {busy && (
        <div className={styles.progressTrack} role="progressbar" aria-valuenow={progress}>
          <div className={styles.progressBar} style={{ width: Math.max(4, progress) + '%' }} />
        </div>
      )}

      {note && <div className={styles.posterNote}>{note}</div>}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
