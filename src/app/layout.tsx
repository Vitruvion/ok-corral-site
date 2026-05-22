import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'The OK Corral — Western Saloon in Cottonwood, California',
  description: 'The OK Corral is a western saloon in Cottonwood, California. Home of the Scorpion Shot. Live music, taco Tuesdays, free pool Wednesdays, karaoke Sundays. Open daily 8 AM – 2 AM.',
  metadataBase: new URL('https://okcorralsaloon.com'),
  openGraph: {
    title: 'The OK Corral — Western Saloon in Cottonwood, California',
    description: 'Home of the Scorpion Shot. Live music, taco Tuesdays, free pool Wednesdays, karaoke Sundays.',
    url: 'https://okcorralsaloon.com',
    siteName: 'The OK Corral',
    type: 'website',
  },
  icons: {
    // Browser tab — multi-resolution ICO (16/32/48) sourced from the
    // hand-drawn OK monogram on page 9 of OK_Corral_Logos_for_dark.pdf.
    icon: [
      { url: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.json',
  other: {
    'theme-color': '#0b0908',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/*
          FOUC suppression — keeps the body invisible until the page's
          CSS has loaded, so users never see the bare-HTML render. The
          painful case is iOS Safari/Chrome restoring a backgrounded tab
          from the back-forward cache (bfcache): the engine repaints the
          DOM but doesn't always re-apply CSS or rehydrate JS — visitors
          see system fonts, no grid, nav links collapsed inline.

          Strategy:
            - Inline <style> hides <body> by default (opacity: 0) and
              paints <html> with the brand ink so users never see a
              white flash while body is hidden.
            - Inline <script> reveals the body once styles are confirmed
              loaded (DOMContentLoaded / window.load / requestAnimationFrame),
              with a 500ms safety timeout so slow connections still reveal
              eventually.
            - pageshow + event.persisted === true is the canonical
              indicator that the page was restored from bfcache. iOS
              WebKit's restoration is the source of this bug, so we
              unconditionally reload in that case. (Note: this defeats
              bfcache's perf benefit on iOS, but it's the only way to
              guarantee correct styling. Other browsers without the bug
              also reload — slight cost, but consistent behavior.)
            - visibilitychange handler (defense in depth) catches cases
              where the page wasn't fully unloaded but styles look wrong
              anyway. Note that getComputedStyle can return cached values
              even when the browser visually renders bare HTML, so this
              is best-effort and pageshow is the primary signal.
            - <noscript> override keeps body visible without JS so crawlers
              and JS-disabled users see the content.

          Note: this lives in the server-rendered HTML head, so it
          executes before React hydration and before the body is fully
          parsed — that's intentional, it's the only place that can win
          the race against first paint.
        */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              'html{background:#0b0908}body{opacity:0;transition:opacity 120ms ease-out}body.fouc-ready{opacity:1}',
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
var revealed=false;
function reveal(){if(revealed)return;revealed=true;if(document.body)document.body.classList.add('fouc-ready');}
function tryReveal(){if(document.body)requestAnimationFrame(reveal);}
if(document.readyState!=='loading')tryReveal();
document.addEventListener('DOMContentLoaded',tryReveal);
window.addEventListener('load',reveal);
setTimeout(reveal,500);
window.addEventListener('pageshow',function(e){
if(e.persisted){window.location.reload();}
});
var BRAND_BG='rgb(11,';
function stylesOk(){if(!document.body)return true;var bg=getComputedStyle(document.body).backgroundColor||'';return bg.replace(/\\s/g,'').indexOf(BRAND_BG)===0;}
var wasHidden=false;
document.addEventListener('visibilitychange',function(){
if(document.visibilityState==='hidden'){wasHidden=true;return;}
if(document.visibilityState!=='visible'||!wasHidden)return;
wasHidden=false;
setTimeout(function(){if(!stylesOk())window.location.reload();},150);
});
})();`,
          }}
        />
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html:
                'body{opacity:1!important;transition:none!important}',
            }}
          />
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BarOrPub',
              name: 'The OK Corral',
              description: 'Western saloon in Cottonwood, California. Home of the Scorpion Shot.',
              address: {
                '@type': 'PostalAddress',
                streetAddress: '3633 Main Street',
                addressLocality: 'Cottonwood',
                addressRegion: 'CA',
                postalCode: '96022',
              },
              telephone: '(530) 348-2062',
              email: 'howdy@okcorralsaloon.com',
              url: 'https://okcorralsaloon.com',
              geo: { '@type': 'GeoCoordinates', latitude: 40.384, longitude: -122.281 },
              openingHours: 'Mo-Su 08:00-02:00',
            }),
          }}
        />
      </head>
      {/* suppressHydrationWarning: the FOUC head script adds the
          `fouc-ready` class to <body> before React hydrates, which
          would otherwise log a "Extra attributes from the server: class"
          hydration mismatch in dev. The mismatch is intentional and
          harmless — React doesn't manage that class. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
