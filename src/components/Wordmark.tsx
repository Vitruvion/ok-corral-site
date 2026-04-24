'use client'
import styles from './Wordmark.module.css'

type Props = {
  variant: 'inline' | 'full' | 'stacked'
  size?: number
  className?: string
}

export default function Wordmark({ variant, size, className = '' }: Props) {
  if (variant === 'inline') {
    return (
      <span className={`${styles.inline} ${className}`} style={size ? { fontSize: size } : undefined}>
        <span className={styles.inlineThe}>The </span>
        <span className={styles.inlineOK}>O.K.</span>
        <span className={styles.inlineCorral}> Corral</span>
      </span>
    )
  }

  if (variant === 'stacked') {
    return (
      <div className={`${styles.stacked} ${className}`}>
        <div className={styles.stackedKicker}>
          <span className={styles.diamond} />
          <span className={styles.kickerText}>THE</span>
          <span className={styles.diamond} />
        </div>
        <div className={styles.stackedMain}>O.K. Corral</div>
      </div>
    )
  }

  // variant === 'full'
  return (
    <div className={`${styles.full} ${className}`}>
      <div className={styles.fullRule}>
        <span className={styles.ruleLine} />
        <span className={styles.kickerText}>THE</span>
        <span className={styles.ruleLine} />
      </div>
      <div className={styles.fullMain}>O.K.&nbsp;CORRAL</div>
      <div className={styles.fullRule}>
        <span className={styles.ruleLine} style={{ opacity: 0.35 }} />
        <span className={styles.fullSub}>COTTONWOOD · CA · EST. 2025</span>
        <span className={styles.ruleLine} style={{ opacity: 0.35 }} />
      </div>
    </div>
  )
}
