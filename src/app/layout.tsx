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
      <body>{children}</body>
    </html>
  )
}
