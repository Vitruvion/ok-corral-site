'use client'

import { useEffect, useRef, useState } from 'react'
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
 *
 * TWO MODES. With an eventId it uploads immediately -- the editing case.
 * With eventId null (the create form) there is no row to attach a poster
 * to yet, so it resizes, previews locally, and hands the file to the
 * parent through onStage; the create handler uploads it once the row
 * exists. That ordering is the point: the upload endpoint writes the
 * Storage object AND sets poster_url in one step, so an object can never
 * exist for a show that was never created.
 */

type Props = {
  /** Null while the show does not exist yet -- stage the file, don't send it. */
  eventId: string | null
  posterUrl: string | null
  onChange: (url: string | null) => void
  /** Required in staging mode. Gets the resized file, or null when cleared. */
  onStage?: (file: File | null) => void
}

/**
 * Sends one already-resized file to the upload endpoint.
 *
 * Exported because the create form has to upload after its row is
 * inserted, and a second copy of this would drift from the first.
 */
export function uploadPoster(
  eventId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const body = new FormData()
  body.append('event_id', eventId)
  body.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/events/poster')
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
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
}

export default function PosterField({ eventId, posterUrl, onChange, onStage }: Props) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Object URL for a staged file, so a poster is visible before it exists. */
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const staging = eventId === null

  // Revokes the PREVIOUS url when preview changes, and the current one on
  // unmount. Without it, every replaced pick leaks a blob for the life of
  // the page.
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const choose = async (file: File) => {
    setError(null)
    setBusy(true)
    setProgress(0)
    setNote('Shrinking…')

    try {
      const shrunk = await resizeForUpload(file)
      const size = shrunk.resized
        ? formatBytes(shrunk.originalBytes) + ' → ' + formatBytes(shrunk.bytes)
        : formatBytes(shrunk.bytes)

      if (staging) {
        // Nothing is sent yet. The create handler uploads this the moment
        // the row exists, which is what keeps Storage free of orphans.
        setPreview(URL.createObjectURL(shrunk.file))
        onStage?.(shrunk.file)
        setNote(size + ' · uploads when you add the show')
        return
      }

      setNote(size + ', uploading…')
      const url = await uploadPoster(eventId, shrunk.file, setProgress)
      onChange(url)
      setNote('Uploaded · ' + size)
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
    if (staging) {
      // Never left this browser, so clearing it is purely local.
      setPreview(null)
      onStage?.(null)
      setNote(null)
      return
    }
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

  // The uploaded poster if there is one, otherwise the staged preview.
  const shown = posterUrl ?? preview

  return (
    <div className={styles.poster}>
      <span className={styles.label}>Poster</span>

      {shown && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.posterImage}
          src={shown}
          alt={posterUrl ? 'Current poster' : 'Poster to be uploaded'}
        />
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
          id={'poster-' + (eventId ?? 'new')}
          className={styles.fileInput}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) void choose(f)
          }}
        />
        <label htmlFor={'poster-' + (eventId ?? 'new')} className={styles.fileButton} aria-disabled={busy}>
          {busy ? 'Working…' : shown ? 'Replace' : 'Add poster'}
        </label>

        {shown && !busy && (
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
