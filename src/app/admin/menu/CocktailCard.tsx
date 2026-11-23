'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminDrink } from '@/lib/admin/drinks-repo'
import { formatBytes, resizeForUpload } from '@/lib/admin/image-resize'
import { COCKTAIL_CATEGORY, DEFAULT_COCKTAIL, artUrlFor } from '@/lib/cocktail-of-month'
import styles from './menu.module.css'

/**
 * "Cocktail of the Month" -- the one cocktail the TV board features, with
 * artwork, in place of the full Saloon Cocktails list.
 *
 * Nothing is sent until Save: the picker and the artwork are one change,
 * saved together, so the board never shows a new picture beside the old
 * drink. The artwork is resized here first, by the same code as event
 * posters, then the server sniffs it and stores it (lib/admin/poster-upload).
 */

type Props = {
  drinks: AdminDrink[]
  /** The saved pick, or null when nothing has been saved (the default applies). */
  saved: { drink_id: string; art_url: string | null } | null
}

type Status = { kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string }

export default function CocktailCard({ drinks, saved }: Props) {
  const router = useRouter()

  // Only a live Saloon Cocktail can be featured; the server checks again.
  const choices = useMemo(
    () => drinks.filter(d => d.category === COCKTAIL_CATEGORY && d.active),
    [drinks]
  )
  const byId = useMemo(() => new Map(drinks.map(d => [d.id, d])), [drinks])

  // What the board shows right now -- the same rules as getCocktailOfMonth().
  const defaultDrink = drinks.find(
    d => d.name === DEFAULT_COCKTAIL.name && d.category === COCKTAIL_CATEGORY && d.active
  )
  const liveId = saved ? saved.drink_id : defaultDrink?.id ?? null
  const live = liveId ? byId.get(liveId) : undefined
  const liveShowable = !!live && live.active && live.category === COCKTAIL_CATEGORY
  const liveArt = live ? artUrlFor(live.name, saved?.art_url ?? null) : null

  const [drinkId, setDrinkId] = useState<string>(liveShowable ? live!.id : choices[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileNote, setFileNote] = useState<string | null>(null)
  const [clearArt, setClearArt] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const picked = byId.get(drinkId)
  const sameDrink = drinkId === liveId
  // The art that will be on the board after Save, mirroring the server:
  // a new upload; else none if cleared; else the saved art if the drink is
  // unchanged; else only the bundled art, and only for the drink it shows.
  const keptUpload = sameDrink && !clearArt ? saved?.art_url ?? null : null
  const nextArt = preview ?? (picked ? artUrlFor(picked.name, keptUpload) : null)
  const hasUploadedArt = !!saved?.art_url && sameDrink

  const choose = async (f: File) => {
    setStatus({ kind: 'idle' })
    setFileNote('Shrinking…')
    try {
      const shrunk = await resizeForUpload(f)
      setFile(shrunk.file)
      setPreview(URL.createObjectURL(shrunk.file))
      setClearArt(false)
      setFileNote(
        (shrunk.resized
          ? formatBytes(shrunk.originalBytes) + ' → ' + formatBytes(shrunk.bytes)
          : formatBytes(shrunk.bytes)) + ' · uploads when you save'
      )
    } catch (err: any) {
      setFileNote(null)
      setStatus({ kind: 'error', text: err?.message || 'Could not read that image.' })
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const dropFile = () => {
    setFile(null)
    setPreview(null)
    setFileNote(null)
  }

  // Only a real change. With nothing saved, re-saving the default would
  // write it into the database, and the default stays a fallback in code.
  const dirty = !sameDrink || !!file || clearArt

  const save = () => {
    if (!drinkId) return
    setStatus({ kind: 'saving', text: file ? 'Uploading…' : 'Saving…' })
    setProgress(0)
    const body = new FormData()
    body.append('drink_id', drinkId)
    if (file) body.append('file', file)
    if (clearArt && !file) body.append('clear_art', '1')
    // XMLHttpRequest for the upload progress event, as PosterField does.
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/cocktail')
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let data: any = {}
      try {
        data = JSON.parse(xhr.responseText)
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        setStatus({ kind: 'saved', text: 'Saved · on the board within 5 minutes' })
        dropFile()
        setClearArt(false)
        router.refresh()
      } else {
        setStatus({ kind: 'error', text: data.error || 'Could not save.' })
      }
    }
    xhr.onerror = () => setStatus({ kind: 'error', text: 'Lost connection while saving.' })
    xhr.send(body)
  }

  return (
    <section className={styles.cotm} aria-labelledby="cotm-title">
      <span className={styles.cotmKicker}>◆ On the TV board</span>
      <h2 id="cotm-title" className={styles.cotmTitle}>Cocktail of the Month</h2>

      {/* What is on the board now. */}
      <div className={styles.cotmNow}>
        <div className={styles.cotmThumb}>
          {liveShowable && liveArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={liveArt} alt="" width={88} height={88} />
          ) : (
            <span className={styles.cotmThumbEmpty}>no art</span>
          )}
        </div>
        <div className={styles.cotmNowText}>
          <span className={styles.cotmNowLabel}>Now showing</span>
          {liveShowable ? (
            <>
              <span className={styles.cotmNowName}>{live!.name}</span>
              <span className={styles.cotmNowMeta}>
                {live!.price}
                {saved ? '' : ' · default'}
              </span>
            </>
          ) : (
            <span className={styles.cotmWarn}>
              {live
                ? `${live.name} is hidden, so the board lists every cocktail. Pick another below.`
                : 'Nothing to feature, so the board lists every cocktail. Pick one below.'}
            </span>
          )}
        </div>
      </div>

      <label className={styles.cotmField}>
        <span className={styles.cotmFieldLabel}>Cocktail</span>
        <select
          className={styles.input}
          value={drinkId}
          onChange={e => {
            setDrinkId(e.target.value)
            setClearArt(false)
          }}
        >
          {choices.length === 0 && <option value="">No live Saloon Cocktails</option>}
          {choices.map(d => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.price}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.cotmField}>
        <span className={styles.cotmFieldLabel}>Artwork</span>
        <div className={styles.cotmArtRow}>
          <div className={styles.cotmPreview}>
            {nextArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={nextArt} alt="Artwork preview" width={160} height={160} />
            ) : (
              <span className={styles.cotmThumbEmpty}>name, description and price only</span>
            )}
          </div>
          <div className={styles.cotmArtActions}>
            <input
              ref={inputRef}
              id="cotm-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={styles.cotmFileInput}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) void choose(f)
              }}
            />
            <label htmlFor="cotm-file" className={styles.cotmUploadBtn}>
              {file ? 'Choose different art' : 'Upload artwork'}
            </label>
            {file && (
              <button type="button" className={styles.cotmLinkBtn} onClick={dropFile}>
                Don&apos;t use this file
              </button>
            )}
            {!file && hasUploadedArt && (
              <button
                type="button"
                className={styles.cotmLinkBtn}
                onClick={() => setClearArt(v => !v)}
                aria-pressed={clearArt}
              >
                {clearArt ? 'Keep the current artwork' : 'Remove artwork'}
              </button>
            )}
          </div>
        </div>
        <p className={styles.cotmNote}>Artwork should be on a black background.</p>
        {fileNote && <p className={styles.cotmNote}>{fileNote}</p>}
        {!file && !sameDrink && picked && !nextArt && (
          <p className={styles.cotmNote}>
            No artwork for this drink yet. Without it the board shows the name, description and
            price on their own.
          </p>
        )}
      </div>

      <div className={styles.cotmSaveRow}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={save}
          disabled={!drinkId || !dirty || status.kind === 'saving'}
        >
          {status.kind === 'saving' ? (file ? `Uploading ${progress}%` : 'Saving…') : 'Save'}
        </button>
        <span
          className={`${styles.rowStatus} ${status.kind === 'saved' ? styles.ok : ''} ${status.kind === 'error' ? styles.bad : ''}`}
          role="status"
          aria-live="polite"
        >
          {status.kind === 'saving' ? '' : status.text}
        </span>
      </div>
    </section>
  )
}
