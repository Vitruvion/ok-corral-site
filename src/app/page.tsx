import ClientShell from '@/components/ClientShell'
import { fetchAll } from '@/lib/queries'

export const revalidate = 60

export default async function Home() {
  const { events, recurring, drinks, merch } = await fetchAll()
  return (
    <ClientShell
      events={events}
      recurring={recurring}
      drinks={drinks}
      merch={merch}
    />
  )
}
