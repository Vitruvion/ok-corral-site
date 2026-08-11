'use client'
import { useEffect, useState } from 'react'
import { useCart, lineKeyOf } from '@/lib/cart'
import { shippingForSubtotal, amountUntilFreeShipping } from '@/lib/fulfillment'
import styles from './CartDrawer.module.css'

export default function CartDrawer() {
  const { lines, open, setOpen, subtotal, removeLine, setQty } = useCart()
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const handleCheckout = async () => {
    if (lines.length === 0) return
    setCheckingOut(true)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only what the customer chose. Price, name and colour are looked up
        // server-side from the catalog — sending them would be meaningless
        // (the API ignores them) and was previously how prices got spoofed.
        // `name` rides along purely as a fallback lookup key for carts saved
        // before item ids were stable.
        body: JSON.stringify({
          kind: 'merch',
          items: lines.map(l => ({
            id: l.id,
            name: l.name,
            qty: l.qty,
            size: l.size,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Checkout failed.')
      if (!json.url) throw new Error('No checkout URL returned.')
      // Hand off to Stripe — page navigates away.
      window.location.href = json.url as string
    } catch (e: any) {
      setCheckoutError(e?.message || 'Something went wrong. Try again.')
      setCheckingOut(false)
    }
  }

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

  // Same helper /api/checkout uses to build Stripe's shipping options, so
  // this line can't quote a price Stripe won't charge.
  const shipping = shippingForSubtotal(subtotal)
  const untilFree = amountUntilFreeShipping(subtotal)
  // No tax line: automatic_tax is off in the Checkout Session, so Stripe
  // charges none. Showing an estimate here made the cart total disagree with
  // the amount actually charged. If sales tax gets collected later (Stripe
  // Tax), surface it from the session rather than guessing a rate.
  const total = subtotal + shipping

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
                <div className={`${styles.totalRow} ${styles.grand}`}>
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
              {untilFree > 0 && (
                <p className={styles.shipNote}>
                  <em>${untilFree.toFixed(2)} from free shipping.</em>
                </p>
              )}
              {checkoutError && (
                <p className={styles.checkoutError}><em>{checkoutError}</em></p>
              )}
              <button
                className={`btn btn-primary ${styles.checkout}`}
                onClick={handleCheckout}
                disabled={checkingOut || lines.length === 0}
              >
                {checkingOut ? 'Redirecting…' : 'Checkout →'}
              </button>
              <p className={styles.secure}>◆ Secure checkout · powered by Stripe</p>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
