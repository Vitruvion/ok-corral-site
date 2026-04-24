'use client'
import { useEffect } from 'react'
import { useCart, lineKeyOf } from '@/lib/cart'
import styles from './CartDrawer.module.css'

const SHIPPING_THRESHOLD = 75
const TAX_RATE = 0.0775

export default function CartDrawer() {
  const { lines, open, setOpen, subtotal, removeLine, setQty } = useCart()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, setOpen])

  const shipping = subtotal === 0 ? 0 : subtotal >= SHIPPING_THRESHOLD ? 0 : 8
  const tax = subtotal * TAX_RATE
  const total = subtotal + shipping + tax

  return (
    <>
      <div
        className={`${styles.scrim} ${open ? styles.scrimOpen : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}
        aria-label="Cart"
        role="dialog"
        aria-modal="true"
      >
        <header className={styles.head}>
          <span className={styles.label}>◆ Your Cart</span>
          <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close cart">✕</button>
        </header>

        {lines.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>◆</span>
            <h3 className={styles.emptyTitle}>Cart&apos;s empty</h3>
            <p className={styles.emptyDesc}>
              <em>Pick up a tee, a koozie, or a bandana from the General Store.</em>
            </p>
            <button className="btn btn-primary" onClick={() => { setOpen(false); document.getElementById('merch')?.scrollIntoView({ behavior: 'smooth' }) }}>
              Shop Merch →
            </button>
          </div>
        ) : (
          <>
            <div className={styles.lines}>
              {lines.map(line => {
                const key = lineKeyOf(line)
                return (
                  <div key={key} className={styles.line}>
                    <div className={`${styles.thumb} ${line.imageBg === 'bone' ? styles.thumbBone : ''}`}>
                      <span className={styles.thumbLabel}>{line.name.split(' ')[0]}</span>
                    </div>
                    <div className={styles.lineInfo}>
                      <span className={styles.lineName}>{line.name}</span>
                      <span className={styles.lineMeta}>
                        {line.color}{line.size ? ` · ${line.size}` : ''}
                      </span>
                      <div className={styles.qtyRow}>
                        <button className={styles.qtyBtn} onClick={() => setQty(key, line.qty - 1)} aria-label="Decrease">−</button>
                        <span className={styles.qty}>{line.qty}</span>
                        <button className={styles.qtyBtn} onClick={() => setQty(key, line.qty + 1)} aria-label="Increase">+</button>
                        <button className={styles.remove} onClick={() => removeLine(key)}>Remove</button>
                      </div>
                    </div>
                    <span className={styles.linePrice}>${(line.price * line.qty).toFixed(2)}</span>
                  </div>
                )
              })}
            </div>

            <footer className={styles.foot}>
              <div className={styles.totals}>
                <div className={styles.totalRow}>
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className={styles.totalRow}>
                  <span>Shipping</span>
                  <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className={styles.totalRow}>
                  <span>Tax (est.)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className={`${styles.totalRow} ${styles.grand}`}>
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
              {subtotal < SHIPPING_THRESHOLD && (
                <p className={styles.shipNote}>
                  <em>${(SHIPPING_THRESHOLD - subtotal).toFixed(2)} from free shipping.</em>
                </p>
              )}
              <button className={`btn btn-primary ${styles.checkout}`}>
                Checkout →
              </button>
              <p className={styles.secure}>◆ Secure checkout · powered by Stripe</p>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
