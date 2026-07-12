import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

/**
 * Create a multer upload instance with disk storage.
 * @param {string} prefix - filename prefix (e.g. 'chat', 'doc')
 * @param {number} maxSize - max file size in bytes (default 250 MB)
 */
export function createUpload(prefix = 'file', maxSize = 250 * 1024 * 1024) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
      const ext = path.extname(file.originalname)
      cb(null, `${prefix}-${uniqueSuffix}${ext}`)
    },
  })

  return multer({ storage, limits: { fileSize: maxSize } })
}

/**
 * Create a multer upload instance backed by in-memory storage.
 * Use this when the file will be streamed straight to cloud storage
 * (e.g. Cloudinary) rather than written to local disk.
 * @param {number} maxSize - max file size in bytes (default 10 MB)
 */
export function createMemoryUpload(maxSize = 10 * 1024 * 1024) {
  return multer({ storage: multer.memoryStorage(), limits: { fileSize: maxSize } })
}

export { uploadsDir }
