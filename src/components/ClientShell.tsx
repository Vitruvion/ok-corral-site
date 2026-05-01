'use client'
import { CartProvider } from '@/lib/cart'
import type { EventData, DrinkData, MerchItem, InstagramPost } from '@/lib/data'
import Loader from '@/components/Loader'
import AgeGate from '@/components/AgeGate'
import Topbar from '@/components/Topbar'
import Hero from '@/components/Hero'
import Marquee from '@/components/Marquee'
import Events from '@/components/Events'
import DrinkMenu from '@/components/Drinks'
import MerchSection from '@/components/Merch'
import GallerySection from '@/components/Gallery'
import InstagramStrip from '@/components/InstagramStrip'
import Bookings from '@/components/Bookings'
import GiftCards from '@/components/GiftCards'
import Location from '@/components/Location'
import Footer from '@/components/Footer'
import ProgressRail from '@/components/ProgressRail'
import CartDrawer from '@/components/CartDrawer'
import StripeReturnHandler from '@/components/StripeReturnHandler'

type RecurringData = { day: string; name: string; support: string; time: string; tickets: string }

type Props = {
  events: EventData[]
  recurring: RecurringData[]
  drinks: Record<string, DrinkData[]>
  merch: MerchItem[]
  igPosts: InstagramPost[] | null
}

export default function ClientShell({ events, recurring, drinks, merch, igPosts }: Props) {
  return (
    <CartProvider>
      <Loader />
      <AgeGate />
      <Topbar />
      <Hero />
      <Marquee />
      <Events events={events} recurring={recurring} />
      <DrinkMenu drinks={drinks} />
      <MerchSection merch={merch} />
      <GallerySection />
      <InstagramStrip posts={igPosts} />
      <Bookings />
      <GiftCards />
      <Location />
      <Footer />
      <ProgressRail />
      <CartDrawer />
      <StripeReturnHandler />
    </CartProvider>
  )
}
