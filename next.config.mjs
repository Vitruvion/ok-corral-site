const nextConfig = {
  experimental: {
    // Files the homepage reads from /public on the SERVER: local poster
    // files whose size src/lib/poster-size.ts reads. /public is served by
    // the CDN and is not part of the server function by default, so without
    // this an ISR regeneration on Vercel would not find them, and the weekly
    // flyers would lose their known size after the first revalidation.
    outputFileTracingIncludes: {
      '/': ['./public/assets/events/**/*'],
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'oqfjlsmsthcuamkncpfb.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            // Cross-origin subresources (Instagram CDN images, the Google
            // Maps iframe, YouTube embeds) get only the origin — never the
            // path or query string. That matters because the Stripe return
            // URL carries ?session_id=cs_..., which acts as a capability
            // token for /api/order-summary. Modern browsers already default
            // to this, but stating it explicitly covers older ones and
            // anything that would otherwise fall back to sending full URLs.
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}
export default nextConfig
