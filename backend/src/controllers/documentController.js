import prisma from '../config/prisma.js'
import fs from 'fs'
import path from 'path'
import { extractTextFromFile } from '../utils/extractText.js'
import { isRemoteUrl } from '../utils/storage.js'

// @desc    Get all documents for logged-in user (optionally filtered by source)
// @route   GET /api/documents?source=assistant|notebook
export const getDocuments = async (req, res) => {
  try {
    const where = { userId: req.user.id }
    if (req.query.source) {
      where.source = req.query.source
    }
    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    res.json(documents.map(d => ({ ...d, _id: d.id })))
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Upload a document (via multer disk storage)
// @route   POST /api/documents
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const { originalname, mimetype, size, filename, path: filePath } = req.file
    const docType = req.body.type || 'other'
    const docSource = req.body.source || 'assistant'

    const document = await prisma.document.create({
      data: {
        userId: req.user.id,
        name: req.body.name || originalname,
        type: docType,
        source: docSource,
        filePath: filename, // store just the filename, serve from uploads/
        mimeType: mimetype,
        size,
      },
    })

    // Auto-extract text only for AI assistant documents (not chat/notebook uploads)
    if (docSource === 'assistant') {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      const fullFilePath = path.join(uploadsDir, filename)
      extractTextFromFile(fullFilePath, mimetype)
        .then(async (extractedText) => {
          if (extractedText) {
            await prisma.document.update({
              where: { id: document.id },
              data: { extractedText },
            })
            console.log(`✅ Text extracted from "${document.name}" (${extractedText.length} chars)`)
          }
        })
        .catch((err) => {
          console.error(`⚠️ Auto-extraction failed for "${document.name}":`, err.message)
        })
    }

    res.status(201).json({ ...document, _id: document.id })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Download/get a specific document
// @route   GET /api/documents/:id/download
export const downloadDocument = async (req, res) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    })
    if (!document) return res.status(404).json({ message: 'Document not found' })

    // Files stored in cloud storage keep an absolute URL in filePath.
    if (isRemoteUrl(document.filePath)) {
      return res.json({
        name: document.name,
        type: document.type,
        mimeType: document.mimeType,
        fileUrl: document.filePath,
      })
    }

    const uploadsDir = path.join(process.cwd(), 'uploads')
    const fullPath = path.join(uploadsDir, document.filePath)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File not found on disk' })
    }

    // Read file and send as base64 (for frontend compatibility)
    const fileBuffer = fs.readFileSync(fullPath)
    const base64Data = fileBuffer.toString('base64')

    res.json({
      name: document.name,
      type: document.type,
      mimeType: document.mimeType,
      fileData: base64Data,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Delete a document
// @route   DELETE /api/documents/:id
export const deleteDocument = async (req, res) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    })
    if (!document) return res.status(404).json({ message: 'Document not found' })

    // Remove file from disk
    const uploadsDir = path.join(process.cwd(), 'uploads')
    const fullPath = path.join(uploadsDir, document.filePath)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }

    await prisma.document.delete({ where: { id: req.params.id } })
    res.json({ message: 'Document deleted' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
