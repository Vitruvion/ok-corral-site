import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isAdmin } from '@/lib/admin/guard'
import { serviceClient } from '@/lib/admin/drinks-repo'
import { storageKeyFromUrl } from '@/lib/admin/events-repo'
import { getCocktailSetting, saveCocktailSetting } from '@/lib/admin/cocktail-repo'
import { checkImageUpload, putPublicImage, removePublicImage } from '@/lib/admin/poster-upload'
import { COCKTAIL_CATEGORY } from '@/lib/cocktail-of-month'

/**
 * /api/admin/cocktail -- saves the Cocktail of the Month (the TV board's
 * first column; see lib/cocktail-of-month.ts).
 *
 * POST, multipart:
 *   drink_id   required. An ACTIVE drink in Saloon Cocktails.
 *   file       optional. New artwork, already resized on the phone.
 *   clear_art  optional, "1". Drop the uploaded artwork.
 *
 * Artwork goes through the same pipeline as event posters
 * (lib/admin/poster-upload.ts): magic-byte sniffing, the 5MB ceiling, a
 * NEW object in the event-posters bucket under cocktails/, the setting
 * pointed at it, and only then the old object removed. If saving the
 * setting fails, the new object is taken back out.
 *
 * Artwork belongs to the drink it shows. Changing the drink without
 * uploading new art drops the old art rather than putting a picture of
 * one cocktail beside another's name.
 *
 * Admin only: isAdmin() here, and middleware's role policy keeps the door
 * phone off every /api/admin route that is not its own.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ART_PREFIX = 'cocktails'

const unauthorized = () =>
  NextResponse.json(
    { error: 'Not authorized.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  )

export async function POST(req: Request) {
  if (!isAdmin()) return unauthorized()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a form.' }, { status: 400 })
  }

  const drinkId = String(form.get('drink_id') ?? '')
  if (!z.string().uuid().safeParse(drinkId).success) {
    return NextResponse.json({ error: 'Pick a cocktail.' }, { status: 400 })
  }
  const clearArt = form.get('clear_art') === '1'
  const file = form.get('file')
  const hasFile = file instanceof File && file.size > 0

  // Checked before anything is written, so a bad file costs nothing.
  let upload: Awaited<ReturnType<typeof checkImageUpload>> | null = null
  if (hasFile) {
    upload = await checkImageUpload(file)
    if (!upload.ok) return NextResponse.json({ error: upload.error }, { status: upload.status })
  }

  let newKey: string | null = null
  try {
    const sb = serviceClient()
    const { data: drink, error: drinkErr } = await sb
      .from('drinks')
      .select('id, name, category, active')
      .eq('id', drinkId)
      .maybeSingle()
    if (drinkErr) throw new Error(drinkErr.message)
    if (!drink || !drink.active || drink.category !== COCKTAIL_CATEGORY) {
      return NextResponse.json(
        { error: 'That drink is not a live Saloon Cocktail. Pick another, or turn it back on below.' },
        { status: 400 }
      )
    }

    const current = await getCocktailSetting()

    let artUrl: string | null
    if (upload?.ok) {
      const put = await putPublicImage(ART_PREFIX, upload.bytes, upload.sniffed)
      newKey = put.key
      artUrl = put.publicUrl
    } else if (clearArt) {
      artUrl = null
    } else {
      artUrl = current?.drink_id === drinkId ? current.art_url : null
    }

    try {
      await saveCocktailSetting({ drink_id: drinkId, art_url: artUrl })
    } catch (err) {
      // Nothing points at the new object: take it back out.
      if (newKey) await removePublicImage(newKey, '[cocktail]')
      throw err
    }

    // Only now that the setting points elsewhere. Only our own objects:
    // the bundled default lives in /public and is never touched.
    const oldKey = storageKeyFromUrl(current?.art_url)
    let removedOld = false
    if (oldKey && current?.art_url !== artUrl && oldKey.startsWith(ART_PREFIX + '/')) {
      removedOld = await removePublicImage(oldKey, '[cocktail]')
    }

    revalidatePath('/')
    revalidatePath('/menu-board')
    return NextResponse.json({
      drink_id: drinkId,
      drink_name: drink.name,
      art_url: artUrl,
      replaced: current?.art_url !== artUrl ? oldKey : null,
      removed_old: removedOld,
    })
  } catch (err: any) {
    console.error('[/api/admin/cocktail POST]', err)
    return NextResponse.json({ error: err?.message || 'Could not save the cocktail.' }, { status: 500 })
  }
}
