/**
 * cleanupBrokenUploads.js
 *
 * Clears database references to legacy locally-uploaded files that no longer
 * exist on disk. These are the pre-Cloudinary `/uploads/...` files that were
 * lost because uploads used to live on ephemeral local storage while the
 * database is shared. Running this removes the broken-image / dead-link icons.
 *
 * Cloud-storage URLs (https://...) are always left untouched.
 *
 * Usage (from the backend/ directory):
 *   node scripts/cleanupBrokenUploads.js            # dry run — reports only
 *   node scripts/cleanupBrokenUploads.js --apply    # actually clears references
 *
 * A reference is treated as broken only when it points at /uploads/ AND the
 * file is missing from this machine's uploads directory. Run it on the machine
 * whose disk holds whatever surviving files you want to keep.
 */
import fs from 'fs'
import path from 'path'
import prisma from '../src/config/prisma.js'

const APPLY = process.argv.includes('--apply')
const uploadsDir = path.join(process.cwd(), 'uploads')

const isLocalUpload = (url) => typeof url === 'string' && url.startsWith('/uploads/')
const fileMissing = (url) => !fs.existsSync(path.join(uploadsDir, url.replace('/uploads/', '')))
const isBroken = (url) => isLocalUpload(url) && fileMissing(url)

async function run() {
  console.log(`\nScanning for broken /uploads references (${APPLY ? 'APPLY' : 'dry run'})`)
  console.log(`Uploads directory: ${uploadsDir}\n`)

  let brokenPosts = 0
  let brokenResources = 0
  let brokenMessages = 0

  // --- Posts (imageUrl) ---
  const posts = await prisma.post.findMany({
    where: { imageUrl: { startsWith: '/uploads/' } },
    select: { id: true, imageUrl: true },
  })
  for (const p of posts) {
    if (!isBroken(p.imageUrl)) continue
    brokenPosts++
    console.log(`post ${p.id} → ${p.imageUrl}`)
    if (APPLY) {
      await prisma.post.update({ where: { id: p.id }, data: { imageUrl: null } })
    }
  }

  // --- Community resources (fileUrl) — resource is unusable without its file ---
  const resources = await prisma.communityResource.findMany({
    where: { fileUrl: { startsWith: '/uploads/' } },
    select: { id: true, fileUrl: true, name: true },
  })
  for (const r of resources) {
    if (!isBroken(r.fileUrl)) continue
    brokenResources++
    console.log(`resource ${r.id} (${r.name}) → ${r.fileUrl}`)
    if (APPLY) {
      await prisma.communityResource.delete({ where: { id: r.id } })
    }
  }

  // --- Chat file messages (fileUrl) — clear the dead attachment, keep the message ---
  const messages = await prisma.chatMessage.findMany({
    where: { fileUrl: { startsWith: '/uploads/' } },
    select: { id: true, fileUrl: true },
  })
  for (const m of messages) {
    if (!isBroken(m.fileUrl)) continue
    brokenMessages++
    console.log(`chatMessage ${m.id} → ${m.fileUrl}`)
    if (APPLY) {
      await prisma.chatMessage.update({
        where: { id: m.id },
        data: { fileUrl: null, fileType: null },
      })
    }
  }

  console.log('\n── Summary ──')
  console.log(`Posts with broken image:      ${brokenPosts}`)
  console.log(`Community resources broken:   ${brokenResources}`)
  console.log(`Chat messages broken:         ${brokenMessages}`)
  console.log(
    APPLY
      ? '\nDone. References cleared.\n'
      : '\nDry run only. Re-run with --apply to clear these references.\n'
  )
}

run()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
