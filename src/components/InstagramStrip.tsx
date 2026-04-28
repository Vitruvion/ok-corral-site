'use client'
import { BRAND, type InstagramPost } from '@/lib/data'
import ImageOrPlaceholder from './ImageOrPlaceholder'
import styles from './InstagramStrip.module.css'

type Props = {
  posts: InstagramPost[] | null
}

export default function InstagramStrip({ posts }: Props) {
  const hasPosts = Array.isArray(posts) && posts.length > 0

  return (
    <section className={styles.strip}>
      <div className="container">
        <div className={styles.head}>
          <div>
            <span className={styles.kicker}>◆ FROM THE GRID</span>
            <h3 className={styles.title}><em>@</em>{BRAND.instagram}</h3>
          </div>
          <a
            href={BRAND.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            Follow →
          </a>
        </div>

        {hasPosts ? (
          <div className={styles.grid}>
            {posts!.map(post => (
              <a
                key={post.id}
                href={post.permalink || BRAND.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.post}
              >
                <ImageOrPlaceholder
                  src={post.image}
                  alt={post.caption || 'Instagram post'}
                  label={post.caption}
                />
                <div className={styles.over}>
                  <div className={styles.stats}>
                    {post.likes != null
                      ? <span>♥ {post.likes}</span>
                      : <span>♥</span>}
                    {post.days != null && <span>{post.days}d</span>}
                  </div>
                  {post.caption && (
                    <span className={styles.cap}><em>{post.caption}</em></span>
                  )}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <FallbackCta />
        )}
      </div>
    </section>
  )
}

/**
 * Shown when INSTAGRAM_ACCESS_TOKEN is unset or the API call failed.
 * Avoids the trap of showing fake "posts" — instead points to the live profile.
 */
function FallbackCta() {
  return (
    <div className={styles.fallback}>
      <p className={styles.fallbackBody}>
        <em>
          The latest from the bar lives on Instagram. Tag us{' '}
          <strong>@{BRAND.instagram}</strong> when you&apos;re here and we might
          feature you.
        </em>
      </p>
      <a
        href={BRAND.instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
      >
        See the Latest →
      </a>
    </div>
  )
}
