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
        {/*
          FOUC debug instrumentation — activated only when the URL has
          ?fouc-debug=1. Renders a fixed-position bottom-right log panel
          showing every relevant browser event (DOMContentLoaded, load,
          pageshow/pagehide with .persisted, visibilitychange, freeze,
          resume) plus the computed body bg/font and a marker-element
          "styled?" check at the moment each event fired. Log persists
          to localStorage so it survives reloads (incl. bfcache cycles).
          A "Copy" button copies the whole log to the clipboard so Brady
          can paste it into chat.

          Production-safe: no panel renders, no listeners attach, and no
          DOM is touched unless ?fouc-debug=1 is present.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
if((location.search+location.hash).indexOf('fouc-debug=1')===-1)return;
var KEY='fouc-debug-log';
var MARKER_BG='rgb(42, 36, 32)';
var log;
try{log=JSON.parse(localStorage.getItem(KEY)||'[]');}catch(e){log=[];}
log.push({t:Date.now(),event:'--- session start ---',details:'url='+location.href+' ua='+navigator.userAgent.slice(0,80)});
function save(){try{localStorage.setItem(KEY,JSON.stringify(log.slice(-200)));}catch(e){}}
function fmt(t){var d=new Date(t);return d.toISOString().substr(11,12);}
function styled(){
var m=document.getElementById('__fouc_marker');
if(!m)return 'no-marker';
var bg=getComputedStyle(m).backgroundColor;
return bg===MARKER_BG?'yes':'no('+bg+')';
}
function record(ev,det){
var bg=document.body?getComputedStyle(document.body).backgroundColor:'no-body';
var ff=document.body?(getComputedStyle(document.body).fontFamily||'').slice(0,40):'no-body';
log.push({t:Date.now(),event:ev,details:det||'',bg:bg,font:ff,styled:styled()});
save();
render();
}
record('script-exec','readyState='+document.readyState);
document.addEventListener('DOMContentLoaded',function(){record('DOMContentLoaded');install();});
window.addEventListener('load',function(){record('load');});
window.addEventListener('pageshow',function(e){record('pageshow','persisted='+e.persisted);});
window.addEventListener('pagehide',function(e){record('pagehide','persisted='+e.persisted);});
document.addEventListener('visibilitychange',function(){record('visibilitychange','state='+document.visibilityState);});
document.addEventListener('freeze',function(){record('freeze');});
document.addEventListener('resume',function(){record('resume');});
function install(){
if(!document.body)return;
if(!document.getElementById('__fouc_marker_style')){
var s=document.createElement('style');
s.id='__fouc_marker_style';
s.textContent='#__fouc_marker{background:'+MARKER_BG+';position:fixed;left:-99px;top:-99px;width:1px;height:1px;pointer-events:none}';
document.head.appendChild(s);
}
if(!document.getElementById('__fouc_marker')){
var m=document.createElement('div');
m.id='__fouc_marker';
document.body.appendChild(m);
}
render();
}
function render(){
if(!document.body)return;
var p=document.getElementById('__fouc_panel');
if(!p){
p=document.createElement('div');
p.id='__fouc_panel';
p.style.cssText='position:fixed;bottom:8px;right:8px;width:min(380px,calc(100vw - 16px));max-height:55vh;overflow:auto;background:#000;color:#fff;font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;padding:8px;border:1px solid #fff;z-index:2147483647;border-radius:4px;box-shadow:0 0 12px rgba(0,0,0,0.6);opacity:1!important;box-sizing:border-box';
var hdr=document.createElement('div');
hdr.style.cssText='display:flex;gap:6px;margin-bottom:6px;align-items:center;justify-content:space-between';
var ttl=document.createElement('strong');ttl.textContent='FOUC debug';hdr.appendChild(ttl);
var btns=document.createElement('span');btns.style.cssText='display:flex;gap:4px';
function mkBtn(label,onclick){
var b=document.createElement('button');
b.textContent=label;
b.style.cssText='background:#fff;color:#000;border:0;padding:2px 6px;font:inherit;cursor:pointer;border-radius:2px';
b.onclick=onclick;
return b;
}
var copyBtn=mkBtn('Copy',function(){
var text=log.map(function(e){
var s='['+fmt(e.t)+'] '+e.event;
if(e.details)s+=' '+e.details;
if(e.bg||e.font||e.styled){
s+=' | bg:'+(e.bg||'')+' | font:'+(e.font||'')+' | styled:'+(e.styled||'');
}
return s;
}).join('\\n');
function done(){copyBtn.textContent='Copied!';setTimeout(function(){copyBtn.textContent='Copy';},1500);}
if(navigator.clipboard&&navigator.clipboard.writeText){
navigator.clipboard.writeText(text).then(done,function(){
var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);done();
});
}else{
var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);done();
}
});
var clearBtn=mkBtn('Clear',function(){log=[];save();render();});
btns.appendChild(copyBtn);btns.appendChild(clearBtn);
hdr.appendChild(btns);
p.appendChild(hdr);
var bd=document.createElement('div');bd.id='__fouc_panel_body';p.appendChild(bd);
document.body.appendChild(p);
}
var bd=document.getElementById('__fouc_panel_body');
if(bd){
bd.innerHTML=log.slice(-60).map(function(e){
var head='['+fmt(e.t)+'] '+e.event+(e.details?' '+e.details:'');
var meta=[];
if(e.bg)meta.push('bg:'+e.bg);
if(e.font)meta.push('font:'+e.font);
if(e.styled)meta.push('styled:'+e.styled);
return '<div style="margin-bottom:4px;border-bottom:1px solid #333;padding-bottom:3px">'+head.replace(/</g,'&lt;')+(meta.length?'<div style="opacity:0.7">&nbsp;&nbsp;'+meta.join(' | ').replace(/</g,'&lt;')+'</div>':'')+'</div>';
}).join('');
bd.scrollTop=bd.scrollHeight;
}
}
if(document.body)install();
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
