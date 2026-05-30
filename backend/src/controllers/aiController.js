import prisma from '../config/prisma.js'
import fs from 'fs'
import path from 'path'
import { extractTextFromFile } from '../utils/extractText.js'

// ── AI provider configuration ──
const AI_PROVIDER = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'ollama')
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'smollm:1.7b'

if (AI_PROVIDER === 'gemini') {
  console.log(`✅ Gemini AI configured (model: ${GEMINI_MODEL})`)
} else {
  console.log(`✅ Ollama AI configured (model: ${OLLAMA_MODEL}, url: ${OLLAMA_BASE_URL})`)
}

function isGeminiEnabled() {
  return AI_PROVIDER === 'gemini' && Boolean(GEMINI_API_KEY)
}

function getAIErrorResponse(error) {
  if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
    return AI_PROVIDER === 'gemini'
      ? '⚠️ **AI is unavailable** — Cannot reach Gemini. Check the API key and outbound network access.'
      : '⚠️ **AI is unavailable** — Cannot connect to Ollama. Make sure Ollama is running locally (`ollama serve`) and the model is pulled (`ollama pull llama3.1`).'
  }

  return `⚠️ **AI error**: ${error.message}`
}

// ── Helper: call Ollama chat API ──
async function ollamaChat(messages, options = {}) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048,
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Ollama error (${response.status}): ${errText}`)
  }

  const data = await response.json()
  return data.message?.content || ''
}

// ── Helper: call Ollama generate API (simpler, single prompt) ──
async function ollamaGenerate(prompt, options = {}) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048,
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Ollama error (${response.status}): ${errText}`)
  }

  const data = await response.json()
  return data.response || ''
}

// ── Helper: call Gemini generateContent API ──
async function geminiGenerate(prompt, options = {}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini error (${response.status}): ${errText}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || ''
}

async function geminiChat(messages, options = {}) {
  const systemMessage = messages.find(m => m.role === 'system')?.content || SYSTEM_PROMPT
  const conversation = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemMessage }] },
        contents: conversation,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini error (${response.status}): ${errText}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || ''
}

async function generateAIResponse(promptOrMessages, options = {}) {
  if (isGeminiEnabled()) {
    if (Array.isArray(promptOrMessages)) {
      return geminiChat(promptOrMessages, options)
    }
    return geminiGenerate(promptOrMessages, options)
  }

  if (Array.isArray(promptOrMessages)) {
    return ollamaChat(promptOrMessages, options)
  }
  return ollamaGenerate(promptOrMessages, options)
}

// ── Helper: check if error is an Ollama API error ──
function isOllamaError(error) {
  return error.message?.includes('Ollama') ||
         error.message?.includes('ECONNREFUSED') ||
         error.message?.includes('fetch failed')
}

// ── In-memory suggestion cache ──
const suggestionCache = {
  key: '',
  questions: [],
  ts: 0,
  TTL: 10 * 60 * 1000,
}

function getCachedSuggestions(docIds = []) {
  const key = docIds.sort().join(',')
  if (
    suggestionCache.key === key &&
    suggestionCache.questions.length > 0 &&
    Date.now() - suggestionCache.ts < suggestionCache.TTL
  ) {
    return suggestionCache.questions
  }
  return null
}

function setCachedSuggestions(docIds = [], questions = []) {
  suggestionCache.key = docIds.sort().join(',')
  suggestionCache.questions = questions
  suggestionCache.ts = Date.now()
}

// System prompt for medical assistant
const SYSTEM_PROMPT = `You are MediHub AI Assistant — a knowledgeable, friendly medical study assistant. 
You help medical students and healthcare professionals with:
- Answering medical questions accurately
- Explaining complex medical concepts clearly
- Summarizing medical documents and research papers
- Providing study tips and exam preparation guidance

Guidelines:
- Always provide evidence-based medical information
- Use clear formatting with headings, bullet points, and bold text
- When discussing treatments or medications, mention important side effects and contraindications
- If a question is outside your knowledge, state that clearly
- Be concise but thorough
- Use medical terminology appropriately but explain it when needed
- Format responses with markdown for readability`

// @desc    Chat with AI assistant (with optional document context)
// @route   POST /api/ai/chat
export const chatWithAI = async (req, res) => {
  try {
    const { message, documentIds, chatHistory } = req.body

    if (!message) {
      return res.status(400).json({ message: 'Message is required' })
    }

    // Build context from documents if any
    let documentContext = ''
    if (documentIds && documentIds.length > 0) {
      const documents = await prisma.document.findMany({
        where: {
          id: { in: documentIds },
          userId: req.user.id,
        },
        select: { name: true, extractedText: true },
      })

      if (documents.length > 0) {
        documentContext = '\n\n--- UPLOADED DOCUMENT CONTEXT ---\n'
        documents.forEach(doc => {
          if (doc.extractedText) {
            // Limit each doc to ~6000 chars to fit within context window
            const text = doc.extractedText.length > 6000
              ? doc.extractedText.slice(0, 6000) + '\n... [truncated]'
              : doc.extractedText
            documentContext += `\n[Document: ${doc.name}]\n${text}\n`
          }
        })
        documentContext += '\n--- END DOCUMENT CONTEXT ---\n\nUse the above document content to answer the user\'s question when relevant. If the question is about the document, base your answer on the document content. If it\'s a general medical question, you can answer from your knowledge but mention what the document says if relevant.'
      }
    }

    // Build messages array for Gemini chat
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ]

    // Add chat history
    if (chatHistory && chatHistory.length > 0) {
      for (const msg of chatHistory.slice(-10)) {
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        })
      }
    }

    // Add current message with document context
    const fullPrompt = documentContext
      ? `${documentContext}\n\nUser Question: ${message}`
      : message

    messages.push({ role: 'user', content: fullPrompt })

    const response = await generateAIResponse(messages)

    res.json({ response })
  } catch (error) {
    console.error('AI Chat Error:', error)
    if (isOllamaError(error) || error.message?.includes('Gemini')) {
      return res.json({ response: getAIErrorResponse(error) })
    }
    res.status(500).json({ message: 'Failed to get AI response', error: error.message })
  }
}

// @desc    Summarize an uploaded document
// @route   POST /api/ai/summarize
export const summarizeDocument = async (req, res) => {
  try {
    const { documentId } = req.body

    if (!documentId) {
      return res.status(400).json({ message: 'Document ID is required' })
    }

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: req.user.id,
      },
    })

    if (!document) {
      return res.status(404).json({ message: 'Document not found' })
    }

    // If no extracted text yet, extract it first using local libraries
    let textContent = document.extractedText
    if (!textContent && document.filePath) {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      const fullPath = path.join(uploadsDir, document.filePath)

      if (fs.existsSync(fullPath)) {
        try {
          textContent = await extractTextFromFile(fullPath, document.mimeType)
          // Save extracted text
          await prisma.document.update({
            where: { id: document.id },
            data: { extractedText: textContent },
          })
        } catch (extractErr) {
          console.error('Text extraction failed:', extractErr)
          return res.json({
            summary: `⚠️ **Could not extract text** from "${document.name}": ${extractErr?.message || String(extractErr) || 'Unknown extraction error'}\n\nThe document has been saved. You can still ask me questions about it directly.`,
          })
        }
      } else {
        return res.json({ summary: '⚠️ **File not found on disk.** The document record exists but the file is missing. Please re-upload.' })
      }
    }

    if (!textContent) {
      return res.json({ summary: '⚠️ **No text could be extracted** from this document. You can still ask me questions and I\'ll do my best to help!' })
    }

    // Truncate for context window
    const truncated = textContent.length > 6000
      ? textContent.slice(0, 6000) + '\n... [truncated]'
      : textContent

    const prompt = `${SYSTEM_PROMPT}\n\nProvide a brief summary (4-6 sentences max) of the following document titled "${document.name}":\n\n${truncated}\n\nKeep it concise. Mention what the document is about and its key points. Do not list every detail.`

    const summary = await generateAIResponse(prompt)

    return res.json({ summary })
  } catch (error) {
    console.error('Summarize Error:', error)
    if (isOllamaError(error) || error.message?.includes('Gemini')) {
      return res.json({ summary: getAIErrorResponse(error) })
    }
    res.status(500).json({ message: 'Failed to summarize document', error: error.message })
  }
}

// @desc    Generate suggested questions based on documents or general medical
// @route   POST /api/ai/suggestions
export const getSuggestedQuestions = async (req, res) => {
  try {
    const { documentIds } = req.body
    const ids = documentIds || []

    // Return cached suggestions if available
    const cached = getCachedSuggestions(ids)
    if (cached) {
      return res.json({ questions: cached.slice(0, 8) })
    }

    let prompt = ''

    if (documentIds && documentIds.length > 0) {
      const documents = await prisma.document.findMany({
        where: {
          id: { in: documentIds },
          userId: req.user.id,
        },
        select: { name: true, extractedText: true },
      })

      const docsWithText = documents.filter(d => d.extractedText)
      if (docsWithText.length > 0) {
        let docContext = ''
        docsWithText.forEach(doc => {
          docContext += `\n[Document: ${doc.name}]\n${doc.extractedText.slice(0, 3000)}\n`
        })

        prompt = `Based on the following medical document(s):\n${docContext}\n\nGenerate exactly 8 specific, relevant study questions that a medical student would want to ask about these documents. Make them practical and focused on key concepts from the documents.\n\nReturn ONLY a JSON array of strings, no other text. Example: ["Question 1?", "Question 2?"]`
      } else {
        prompt = `Generate exactly 8 important medical study questions covering different medical topics like pharmacology, pathology, anatomy, physiology, and clinical medicine. Make them specific and educational.\n\nReturn ONLY a JSON array of strings, no other text. Example: ["Question 1?", "Question 2?"]`
      }
    } else {
      prompt = `Generate exactly 8 important medical study questions covering different medical topics like pharmacology, pathology, anatomy, physiology, and clinical medicine. Make them specific and educational.\n\nReturn ONLY a JSON array of strings, no other text. Example: ["Question 1?", "Question 2?"]`
    }

    const text = await generateAIResponse(prompt, { temperature: 0.8 })

    // Parse JSON array from response
    let questions = []
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0])
      }
    } catch (parseErr) {
      questions = text
        .split('\n')
        .map(q => q.replace(/^\d+[\.\)]\s*/, '').replace(/^["']|["']$/g, '').trim())
        .filter(q => q.length > 10)
        .slice(0, 8)
    }

    if (questions.length === 0) {
      questions = [
        'What are the side effects of metformin?',
        'Explain the pathophysiology of heart failure',
        'What are the diagnostic criteria for diabetes mellitus?',
        'Summarize the Krebs cycle',
        'What are the stages of wound healing?',
        'Explain the mechanism of action of ACE inhibitors',
        'What are the stages of chronic kidney disease?',
        'Describe the treatment protocol for acute MI',
      ]
    }

    setCachedSuggestions(ids, questions)
    res.json({ questions: questions.slice(0, 8) })
  } catch (error) {
    console.error('Suggestions Error:', error)
    res.json({
      questions: [
        'What are the side effects of metformin?',
        'Explain the pathophysiology of heart failure',
        'What are the diagnostic criteria for diabetes mellitus?',
        'Summarize the Krebs cycle',
        'What are the stages of wound healing?',
        'Explain the mechanism of action of ACE inhibitors',
        'What are the stages of chronic kidney disease?',
        'Describe the treatment protocol for acute MI',
      ],
    })
  }
}

// @desc    Extract text from a document (locally, no AI needed)
// @route   POST /api/ai/extract-text
export const extractDocumentText = async (req, res) => {
  try {
    const { documentId } = req.body

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: req.user.id,
      },
    })

    if (!document) {
      return res.status(404).json({ message: 'Document not found' })
    }

    // Return already-extracted text
    if (document.extractedText) {
      return res.json({ text: document.extractedText })
    }

    if (!document.filePath) {
      return res.status(400).json({ message: 'No file data available' })
    }

    const uploadsDir = path.join(process.cwd(), 'uploads')
    const fullPath = path.join(uploadsDir, document.filePath)

    if (!fs.existsSync(fullPath)) {
      return res.status(400).json({ message: 'File not found on disk' })
    }

    const extractedText = await extractTextFromFile(fullPath, document.mimeType)

    // Save extracted text for future use
    await prisma.document.update({
      where: { id: document.id },
      data: { extractedText },
    })

    res.json({ text: extractedText })
  } catch (error) {
    console.error('Extract Text Error:', error)
    res.status(500).json({ message: 'Failed to extract text', error: error.message })
  }
}

// ── AI Chat Message persistence ──

// @desc    Get all AI chat messages for the current user
// @route   GET /api/ai/messages
export const getAiChatMessages = async (req, res) => {
  try {
    const messages = await prisma.aiChatMessage.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
    })
    res.json(messages)
  } catch (error) {
    console.error('Get AI Messages Error:', error)
    res.status(500).json({ message: 'Failed to load chat history' })
  }
}

// @desc    Save an AI chat message
// @route   POST /api/ai/messages
export const saveAiChatMessage = async (req, res) => {
  try {
    const { sender, text, relatedDocumentId } = req.body
    if (!sender || !text) {
      return res.status(400).json({ message: 'sender and text are required' })
    }
    const message = await prisma.aiChatMessage.create({
      data: {
        sender,
        text,
        relatedDocumentId: relatedDocumentId || null,
        userId: req.user.id,
      },
    })
    res.status(201).json(message)
  } catch (error) {
    console.error('Save AI Message Error:', error)
    res.status(500).json({ message: 'Failed to save message' })
  }
}

// @desc    Clear all AI chat messages for the current user
// @route   DELETE /api/ai/messages
export const clearAiChatMessages = async (req, res) => {
  try {
    await prisma.aiChatMessage.deleteMany({
      where: { userId: req.user.id },
    })
    res.json({ message: 'Chat history cleared' })
  } catch (error) {
    console.error('Clear AI Messages Error:', error)
    res.status(500).json({ message: 'Failed to clear chat history' })
  }
}
