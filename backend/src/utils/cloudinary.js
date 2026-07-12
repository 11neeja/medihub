import dotenv from 'dotenv'
import { v2 as cloudinary } from 'cloudinary'

dotenv.config()

// Configure from environment. When these are absent we fall back to local
// disk storage so local development keeps working without an account.
if (process.env.CLOUDINARY_URL) {
  // CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud_name> is picked up automatically
  cloudinary.config({ secure: true })
} else if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

/**
 * Whether Cloudinary credentials are configured.
 * @returns {boolean}
 */
export function isCloudinaryConfigured() {
  const cfg = cloudinary.config()
  return Boolean(cfg.cloud_name && cfg.api_key && cfg.api_secret)
}

/**
 * Upload an in-memory file buffer to Cloudinary.
 * @param {Buffer} buffer - the file bytes
 * @param {object} [opts]
 * @param {string} [opts.folder] - Cloudinary folder (e.g. 'medihub/posts')
 * @param {string} [opts.resourceType] - 'image' | 'video' | 'raw' | 'auto'
 * @returns {Promise<string>} the secure HTTPS URL of the uploaded asset
 */
export function uploadToCloudinary(buffer, opts = {}) {
  const { folder = 'medihub/posts', resourceType = 'image' } = opts
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error)
        resolve(result.secure_url)
      }
    )
    stream.end(buffer)
  })
}

export { cloudinary }
