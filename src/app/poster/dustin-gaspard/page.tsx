import type { Metadata } from 'next'
import { Rye, IM_Fell_English, IM_Fell_English_SC, Special_Elite } from 'next/font/google'
import PosterScaler from './PosterScaler'
import styles from './poster.module.css'

// Page-scoped fonts. next/font only ships these to clients that hit
// /poster/dustin-gaspard — the homepage / wallet / card routes keep
// their existing system stack untouched.
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
// Special Elite isn't currently consumed by the poster, but it's in
// the design's font block — keeping it loaded so future iterations
// (utility footer, ticket-stub variants) can use it without changing
// font wiring.
const specialElite = Special_Elite({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-elite',
})

export const metadata: Metadata = {
  title: 'Dustin Dale Gaspard at The OK Corral — Thursday June 25, 2026',
  description:
    'Cajun soul & Appalachian song — one night only at The OK Corral in Cottonwood, California. With special guest Tanner Bingaman. Music begins at 8:30 PM. Strictly 21 & up.',
  openGraph: {
    title: 'Dustin Dale Gaspard at The OK Corral · June 25, 2026',
    description:
      'Cajun soul & Appalachian song — one night only. With special guest Tanner Bingaman. Music at 8:30 PM.',
    type: 'website',
    images: [
      {
        url: '/assets/posters/dustin-gaspard.jpg',
        width: 2000,
        height: 3000,
        alt: 'Dustin Dale Gaspard',
      },
    ],
  },
}

export default function DustinGaspardPosterPage() {
  const fontVars = `${rye.variable} ${fell.variable} ${fellSC.variable} ${specialElite.variable}`

  return (
    <div className={`${styles.stage} ${fontVars}`}>
      <PosterScaler className={styles.posterWrap}>
        <article className={styles.poster}>
            <div className={styles.frame}>
              <span className={`${styles.corner} ${styles.cornerTL}`} />
              <span className={`${styles.corner} ${styles.cornerTR}`} />
              <span className={`${styles.corner} ${styles.cornerBL}`} />
              <span className={`${styles.corner} ${styles.cornerBR}`} />
            </div>

            {/* "One night only" wax-seal stamp, top-right */}
            <div className={styles.stamp} aria-hidden="true">
              <div>
                <div className={styles.stampBig}>ONE</div>
                <div className={`${styles.stampBig} ${styles.stampBigTight}`}>NIGHT</div>
                <div className={styles.stampSmall}>·&nbsp;ONLY&nbsp;·</div>
                <div className={styles.stampTiny}>THE OK CORRAL</div>
              </div>
            </div>

            <div className={styles.content}>
              {/* Eyebrow */}
              <div className={styles.eyebrow}>
                <div className={`${styles.rule} ${styles.ruleLeft}`} />
                <div className={styles.eyebrowLabel}>
                  Thursday · <em>June the 25th</em> · 2026
                </div>
                <div className={`${styles.rule} ${styles.ruleRight}`} />
              </div>

              {/* Title block */}
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

              {/* Hero photo + flanks */}
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

              {/* Support act */}
              <section className={styles.support}>
                <div className={`${styles.flourish} ${styles.flourishSupport}`}>
                  <div className={styles.flourishLine} />
                  <div className={styles.flourishGlyph}>with special guest</div>
                  <div className={styles.flourishLine} />
                </div>
                <h2 className={styles.supportOpener}>Tanner Bingaman</h2>
                <p className={styles.supportCreds}>
                  songwriter · banjoist · poet, from the hills of Appalachia.<br />
                  featured on NPR &nbsp;·&nbsp; Emerging Artist of the Year, Susquehanna Folk Music
                  Society.<br />
                  <em>music begins at eight-thirty sharp</em>
                </p>

                {/* QR — scan for tickets */}
                <div className={styles.qr}>
                  {/* Eventbrite link encoded in the SVG modules; cream
                      plate + #902C1A barn-red modules match the poster
                      palette so it sits naturally on the parchment. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.qrImage}
                    src="/assets/posters/dustin-gaspard-qr.svg"
                    alt="Scan for tickets — Dustin Dale Gaspard at The OK Corral"
                  />
                  <div className={styles.qrCaption}>SCAN FOR TICKETS</div>
                </div>
              </section>

              {/* Bottom row: venue · date · BBQ */}
              <section className={styles.bottom}>
                <div className={styles.col}>
                  <div className={styles.colKicker}>★&nbsp; THE VENUE &nbsp;★</div>
                  <div className={styles.colBig}>
                    The OK<br />Corral
                  </div>
                  <div className={styles.colAddress}>
                    3633 Main Street<br />Cottonwood, CA 96022
                  </div>
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

            {/* Footer band. Three-cell ribbon: IG handle (left), LIVE
                MUSIC (center), 21 & UP (right). Leading and trailing
                ★ glyphs at the very ends of the ribbon. */}
            <footer className={styles.footer}>
              <div className={styles.footerLeft}>
                <span className={styles.footerStar}>★</span>
                <span className={styles.footerIgHandle}>
                  <svg
                    className={styles.footerIg}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="5" ry="5"
                      fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="4"
                      fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="17.5" cy="6.5" r="1.1"
                      fill="currentColor" stroke="none" />
                  </svg>
                  <span>@okcorralsaloon</span>
                </span>
              </div>
              <div className={styles.footerCenter}>LIVE MUSIC</div>
              <div className={styles.footerRight}>
                <span>21 &amp; UP</span>
                <span className={styles.footerStar}>★</span>
              </div>
            </footer>
        </article>
      </PosterScaler>
    </div>
  )
}
