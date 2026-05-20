import type { Metadata } from 'next'
import { Rye, IM_Fell_English, IM_Fell_English_SC, Special_Elite } from 'next/font/google'
import InstagramPosterScaler from './InstagramPosterScaler'
import styles from './poster-instagram.module.css'

const rye = Rye({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-rye',
})
const fell = IM_Fell_English({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fell',
})
const fellSC = IM_Fell_English_SC({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fell-sc',
})
const specialElite = Special_Elite({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-elite',
})

export const metadata: Metadata = {
  title: 'Dustin Dale Gaspard at The OK Corral — Thursday June 25, 2026 (Instagram 4:5)',
  description:
    'Cajun soul & Appalachian song — one night only at The OK Corral in Cottonwood, California. With special guest Tanner Bingaman.',
}

/**
 * Instagram 4:5 portrait-feed variant of the Dustin Gaspard poster.
 * Same content + brand voice as the print poster at /poster/dustin-gaspard
 * — reflowed for the 1080×1350 canvas. Differences from the print:
 *
 *   - Container: 1080×1350 (not 1080×1800)
 *   - Footer ribbon removed (info lives in the Instagram caption)
 *   - Hero photo height 360 → 290
 *   - Title block / hero / support margins tightened
 *   - "Music begins at eight-thirty sharp" line dropped from credits
 *     (the bottom row's "music at 8:30 pm" already conveys this)
 *
 * Everything else (wordmark, three-column bottom row, QR, wax seal,
 * side margins, paper grain, frame, corner diamonds, color palette,
 * typography) carries over from the print poster unchanged.
 */
export default function DustinGaspardInstagramPosterPage() {
  const fontVars = `${rye.variable} ${fell.variable} ${fellSC.variable} ${specialElite.variable}`

  return (
    <div className={`${styles.stage} ${fontVars}`}>
      <InstagramPosterScaler className={styles.posterWrap}>
        <article className={styles.poster}>
            <div className={styles.frame}>
              <span className={`${styles.corner} ${styles.cornerTL}`} />
              <span className={`${styles.corner} ${styles.cornerTR}`} />
              <span className={`${styles.corner} ${styles.cornerBL}`} />
              <span className={`${styles.corner} ${styles.cornerBR}`} />
            </div>

            <div className={styles.stamp} aria-hidden="true">
              <div>
                <div className={styles.stampBig}>ONE</div>
                <div className={`${styles.stampBig} ${styles.stampBigTight}`}>NIGHT</div>
                <div className={styles.stampSmall}>·&nbsp;ONLY&nbsp;·</div>
                <div className={styles.stampTiny}>THE OK CORRAL</div>
              </div>
            </div>

            <div className={styles.content}>
              <div className={styles.eyebrow}>
                <div className={`${styles.rule} ${styles.ruleLeft}`} />
                <div className={styles.eyebrowLabel}>
                  Thursday · <em>June the 25th</em> · 2026
                </div>
                <div className={`${styles.rule} ${styles.ruleRight}`} />
              </div>

              <header className={styles.titleblock}>
                <p className={styles.presents}>The OK Corral proudly presents —</p>
                <p className={styles.venue}>
                  an evening of <span className={styles.amp}>Cajun soul &amp; Appalachian song</span>
                </p>

                <h1 className={styles.name}>
                  <span className={styles.nameSmall}>★&nbsp;&nbsp;featuring&nbsp;&nbsp;★</span>
                  Dustin Dale<br />Gaspard
                </h1>

                <p className={styles.tagline}>
                  from Cow Island, Louisiana
                  <span className={styles.tagDot} />
                  alternative folk &amp; raw storytelling
                </p>

                <div className={styles.flourish}>
                  <div className={styles.flourishLine} />
                  <div className={styles.flourishGlyph}>★ ✦ ★</div>
                  <div className={styles.flourishLine} />
                </div>
              </header>

              <section className={styles.heroRow}>
                <div className={styles.heroFlank}>
                  <div className={styles.heroFlankStars}>★ ★ ★</div>
                  as seen on<br />
                  NBC&apos;s<br />
                  <em className={styles.heroFlankItalic}>The Voice</em><br />
                  Season 28
                </div>

                <div className={styles.hero}>
                  <div
                    className={styles.photo}
                    role="img"
                    aria-label="Dustin Dale Gaspard playing banjo"
                  />
                  <div className={styles.dots} />
                  <div className={styles.tint} />
                </div>

                <div className={styles.heroFlank}>
                  <div className={styles.heroFlankStars}>★ ★ ★</div>
                  a voice<br />
                  steeped in<br />
                  <em className={styles.heroFlankItalic}>Cajun soul</em><br />
                  &amp; deep South sound
                </div>
              </section>

              <section className={styles.support}>
                <div className={`${styles.flourish} ${styles.flourishSupport}`}>
                  <div className={styles.flourishLine} />
                  <div className={styles.flourishGlyph}>with special guest</div>
                  <div className={styles.flourishLine} />
                </div>
                <h2 className={styles.supportOpener}>Tanner Bingaman</h2>
                {/* Credits collapsed to a single line for the 4:5 canvas.
                    The print variant carries the full "from the hills of
                    Appalachia / NPR / Emerging Artist of the Year" credit
                    block; the IG canvas can't afford the vertical budget
                    without clipping the bottom frame + corner diamonds. */}
                <p className={styles.supportCreds}>
                  songwriter · banjoist · poet · featured on NPR
                </p>

                <div className={styles.qr}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.qrImage}
                    src="/assets/posters/dustin-gaspard-qr.svg"
                    alt="Scan for tickets — Dustin Dale Gaspard at The OK Corral"
                  />
                  <div className={styles.qrCaption}>SCAN FOR TICKETS</div>
                </div>
              </section>

              <section className={styles.bottom}>
                <div className={styles.col}>
                  <div className={styles.colKicker}>★&nbsp; THE VENUE &nbsp;★</div>
                  <div className={styles.colBig}>
                    The OK<br />Corral
                  </div>
                  {/* Venue street address omitted on the IG variant —
                      lives in the Instagram caption instead, where the
                      audience can tap a map link directly. Keeps the
                      venue column symmetric with the BBQ column. */}
                  <div className={styles.colSub}>music at 8:30 pm</div>
                </div>

                <div className={styles.date}>
                  <div className={styles.dateDow}>Thursday</div>
                  <div className={styles.dateMonth}>June</div>
                  <div className={styles.dateDay}>25</div>
                  <div className={styles.dateYear}>·&nbsp;2026&nbsp;·</div>
                </div>

                <div className={styles.col}>
                  <div className={styles.colKicker}>★&nbsp; ON THE PIT &nbsp;★</div>
                  <div className={styles.colBig}>
                    Britton&apos;s<br />Bar-B-Q
                  </div>
                  <div className={styles.colSub}>smoked low &amp; slow</div>
                </div>
              </section>
            </div>

            {/* No footer ribbon on the Instagram variant. */}
        </article>
      </InstagramPosterScaler>
    </div>
  )
}
