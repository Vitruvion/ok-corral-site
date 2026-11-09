import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { imageSize } from 'image-size'
import { HARVEST_HOSTS } from './data'

export type HostBadge = { src: string; w: number; h: number }

/**
 * The official Harvest Hosts host badge, if its file is in /public, with
 * its real pixel size -- so the page reserves its exact box and nothing
 * moves when it loads. Null when no file is there yet: the section is
 * designed to look finished without it, with no empty slot and no broken
 * image.
 *
 * Runs on the server during the ISR render. next.config.mjs traces
 * public/assets/harvest-hosts into the homepage's function, so the file is
 * still found when Vercel regenerates the page, not only at build time.
 */
export function findHostBadge(): HostBadge | null {
  for (const src of HARVEST_HOSTS.badgePaths) {
    const file = path.join(process.cwd(), 'public', src)
    try {
      if (!existsSync(file)) continue
      const { width, height } = imageSize(new Uint8Array(readFileSync(file)))
      if (width && height) return { src, w: width, h: height }
    } catch (err) {
      console.warn('[host-badge] could not read', src, '-', err instanceof Error ? err.message : err)
    }
  }
  return null
}
