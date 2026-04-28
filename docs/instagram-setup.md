# Instagram feed setup

The `<InstagramStrip>` section pulls the latest 6 posts from `@okcorralsaloon`
via the Instagram Graph API at request time (cached for 5 min, behind the
page's 60-second revalidation).

When `INSTAGRAM_ACCESS_TOKEN` is **unset** or the API call fails, the section
renders a "See the Latest →" CTA pointing to the live profile instead of
showing fake/reused photos. So the site never breaks if the token expires —
it just degrades to the CTA until you refresh the token.

## Getting a long-lived token

You only need to do this once per account. The flow is the **Instagram Login
for Business** path (the rebranded successor to the Basic Display API). It
works for both classic creator accounts and Business accounts.

1. **Create a Meta app**: <https://developers.facebook.com/apps/> → Create
   App → "Other" → "Business". Name it something like "OK Corral Site".
2. **Add the Instagram product** in the app dashboard. Pick "Instagram Login"
   (not "Instagram for Business" unless the account is linked to a Facebook
   Page).
3. In **Instagram → Basic Display → Basic Display**, add an Instagram Tester
   under "User Token Generator". Use the `okcorralsaloon` account. Accept the
   tester invite from Instagram → Settings → Apps and Websites → Tester
   Invites.
4. Click **Generate Token** for that tester and authenticate. You get a
   **short-lived token** (~1 hour TTL).
5. **Exchange it for a long-lived token** (60-day TTL) by hitting:
   ```
   curl -X GET "https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=APP_SECRET&access_token=SHORT_LIVED_TOKEN"
   ```
   Replace `APP_SECRET` with the value from your app's "Basic Settings", and
   `SHORT_LIVED_TOKEN` with the one from step 4. The response contains an
   `access_token` field — that's your long-lived token.
6. **Set the env var** in Vercel: Project → Settings → Environment Variables
   → add `INSTAGRAM_ACCESS_TOKEN` (Production + Preview), value = the
   long-lived token. Re-deploy.

## Refreshing before expiry

Long-lived tokens last 60 days. Refresh anytime within that window with:
```
curl -X GET "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=CURRENT_TOKEN"
```
Each refresh returns a new token with another 60-day TTL. **Set a calendar
reminder for ~50 days out.** If the token expires before you refresh, you
have to re-do the User Token Generator step (4-5).

A future improvement worth considering: a small Vercel cron job that calls
the refresh endpoint weekly and stores the new token via the Vercel API.
Not done yet — manual refresh is fine for one bar.

## Local development

For local testing, drop the long-lived token into `.env.local`:
```
INSTAGRAM_ACCESS_TOKEN=IGQVJ...
```
Without it, `npm run dev` shows the CTA fallback instead of real posts.
That's the right behavior — don't ship the token to git.

## Rate limits

Instagram caps unauthenticated and per-user calls. The fetch helper caches
each response for 5 minutes (`next: { revalidate: 300 }`), so even at high
traffic the homepage hits the API at most ~12 times/hour. Well under any
limit you'll see.

## Troubleshooting

- **All posts disappeared, CTA showing**: token expired or revoked. Refresh
  per the steps above and redeploy.
- **Posts show, but missing some media**: video posts use `thumbnail_url`
  (still frame). Carousel albums show only the first item. Both are
  intentional — keeps the grid visually consistent.
- **Caption looks truncated**: the helper trims captions to 120 chars,
  single-line. Tweak `cleanCaption` in `src/lib/instagram.ts` if needed.
