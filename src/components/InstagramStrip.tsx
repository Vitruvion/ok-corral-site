'use client'
import { IG_POSTS, BRAND } from '@/lib/data'
import styles from './InstagramStrip.module.css'

export default function InstagramStrip() {
  return (
    <section className={styles.strip}>
      <div className="container">
        <div className={styles.head}>
          <div>
            <span className={styles.kicker}>◆ FROM THE GRID</span>
            <h3 className={styles.title}><em>@</em>{BRAND.instagram}</h3>
          </div>
          <a href={BRAND.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            Follow →
          </a>
        </div>
        <div className={styles.grid}>
          {IG_POSTS.map(post => (
            <a key={post.id} href={BRAND.instagramUrl} target="_blank" rel="noopener noreferrer" className={styles.post}>
              <div className="placeholder" style={{ width: '100%', height: '100%' }}>
                <span className="placeholder-label">{post.caption}</span>
              </div>
              <div className={styles.over}>
                <div className={styles.stats}>
                  <span>♥ {post.likes}</span>
                  <span>{post.days}d</span>
                </div>
                <span className={styles.cap}><em>{post.caption}</em></span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
