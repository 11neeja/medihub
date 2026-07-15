import prisma from '../config/prisma.js'
import fs from 'fs'
import path from 'path'
import { extractTextFromFile } from '../utils/extractText.js'

// ── AI provider configuration ──
const AI_PROVIDER = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'ollama')
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'smollm:1.7b'

// Google retires Gemini models on a rolling basis — the 1.x and 2.0 families
// now return 404 NOT_FOUND — so a single pinned model is an outage waiting to
// happen. Requests walk this chain instead: a model that 404s is blacklisted
// for the life of the process, a model that hits quota (429) goes on a short
// cooldown, and the `-latest` aliases track whatever Google currently ships.
// If the whole chain fails, ListModels tells us what this key can still use.
const GEMINI_MODEL_FALLBACKS = [
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]

// Shut-down families: a stale GEMINI_MODEL env var pointing here (e.g.
// gemini-1.5-flash still set on Render) is ignored rather than allowed to
// take the assistant down again.
const RETIRED_GEMINI_MODELS = /^gemini-(1\.|pro($|-)|2\.0)/i

const GEMINI_MODEL_ENV = (process.env.GEMINI_MODEL || '').trim()
const CONFIGURED_GEMINI_MODEL =
  GEMINI_MODEL_ENV && !RETIRED_GEMINI_MODELS.test(GEMINI_MODEL_ENV) ? GEMINI_MODEL_ENV : ''

const GEMINI_ATTEMPT_TIMEOUT_MS = 45_000 // one model attempt
const GEMINI_TOTAL_BUDGET_MS = 100_000 // whole request, across all fallbacks
const GEMINI_QUOTA_COOLDOWN_MS = 60_000 // how long a 429'd model is skipped

const geminiState = {
  activeModel: '', // last model that answered — always tried first
  dead: new Set(), // models the API reported as gone (404)
  cooldownUntil: new Map(), // model -> epoch ms while quota-limited
  discovered: { models: [], ts: 0 }, // ListModels result, cached 10 min
}

if (AI_PROVIDER === 'gemini') {
  if (GEMINI_MODEL_ENV && !CONFIGURED_GEMINI_MODEL) {
    console.warn(`⚠️ GEMINI_MODEL="${GEMINI_MODEL_ENV}" is a retired model — ignoring it and using the fallback chain`)
  }
  if (!GEMINI_API_KEY) {
    console.warn('⚠️ AI_PROVIDER=gemini but GEMINI_API_KEY is not set — the AI assistant will be offline')
  }
  const chain = [...new Set([CONFIGURED_GEMINI_MODEL, ...GEMINI_MODEL_FALLBACKS].filter(Boolean))]
  console.log(`✅ Gemini AI configured (chain: ${chain.join(' → ')})`)
} else {
  console.log(`✅ Ollama AI configured (model: ${OLLAMA_MODEL}, url: ${OLLAMA_BASE_URL})`)
}

// Thrown for every provider failure; `kind` selects the user-facing message.
class AIProviderError extends Error {
  constructor(kind, detail) {
    super(`AI provider failure (${kind}): ${detail}`)
    this.name = 'AIProviderError'
    this.kind = kind // 'busy' | 'not_configured' | 'unavailable'
  }
}

function isGeminiEnabled() {
  return AI_PROVIDER === 'gemini' && Boolean(GEMINI_API_KEY)
}

// What the user sees when the assistant can't answer. Keep it human — never
// provider names, status codes, or raw API payloads (those go to the log).
function getAIErrorResponse(error) {
  if (AI_PROVIDER === 'ollama') {
    return 'The assistant can\'t reach the local AI engine. Make sure Ollama is running (`ollama serve`) and the model is pulled.'
  }
  switch (error?.kind) {
    case 'busy':
      return 'I\'m answering a lot of questions right now and need a short breather. Please try again in a minute — your chat and documents are safe.'
    case 'not_configured':
      return 'The assistant is temporarily offline for maintenance. Please check back a little later — your chat and documents are safe.'
    default:
      return 'I couldn\'t finish answering that just now. Please try again in a moment — your chat and documents are safe.'
  }
}

// Surfaced in GET /api/health so production issues are diagnosable at a glance.
export function getAIDiagnostics() {
  if (AI_PROVIDER !== 'gemini') {
    return { provider: 'ollama', model: OLLAMA_MODEL, configured: true }
  }
  return {
    provider: 'gemini',
    configured: Boolean(GEMINI_API_KEY),
    model: geminiState.activeModel || CONFIGURED_GEMINI_MODEL || GEMINI_MODEL_FALLBACKS[0],
    activeModel: geminiState.activeModel || null,
    ignoredRetiredEnvModel: GEMINI_MODEL_ENV && !CONFIGURED_GEMINI_MODEL ? GEMINI_MODEL_ENV : null,
    retiredModelsSeen: [...geminiState.dead],
  }
}

// ── Helper: call Ollama (local development only) ──
async function ollamaFetch(pathname, payload) {
  let response
  try {
    response = await fetch(`${OLLAMA_BASE_URL}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    throw new AIProviderError('unavailable', `Ollama unreachable: ${err?.message || err}`)
  }
  if (!response.ok) {
    const errText = (await response.text().catch(() => '')).slice(0, 300)
    throw new AIProviderError('unavailable', `Ollama HTTP ${response.status}: ${errText}`)
  }
  return response.json()
}

async function ollamaChat(messages, options = {}) {
  const data = await ollamaFetch('/api/chat', {
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
  })
  return data.message?.content || ''
}

async function ollamaGenerate(prompt, options = {}) {
  const data = await ollamaFetch('/api/generate', {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 2048,
    },
  })
  return data.response || ''
}

// ── Gemini plumbing ──

function geminiModelCandidates() {
  const chain = [geminiState.activeModel, CONFIGURED_GEMINI_MODEL, ...GEMINI_MODEL_FALLBACKS]
  const seen = new Set()
  return chain.filter(model => {
    if (!model || seen.has(model) || geminiState.dead.has(model)) return false
    seen.add(model)
    return true
  })
}

// Last resort when the whole static chain is gone: ask the API which models
// this key can still call. Cached so a dead chain doesn't hammer ListModels.
async function discoverGeminiModels() {
  const cache = geminiState.discovered
  if (cache.ts && Date.now() - cache.ts < 10 * 60 * 1000) return cache.models
  cache.ts = Date.now() // set even on failure so we don't re-list every message
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
      { headers: { 'x-goog-api-key': GEMINI_API_KEY }, signal: AbortSignal.timeout(15_000) }
    )
    if (!response.ok) return cache.models
    const data = await response.json()
    // Prefer stable flash models, then lite, then everything else — newest first.
    const rank = name =>
      (name.includes('flash') ? 0 : 4) +
      (name.includes('lite') ? 1 : 0) +
      (/preview|exp/.test(name) ? 2 : 0)
    cache.models = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => (m.name || '').replace(/^models\//, ''))
      .filter(name => name.startsWith('gemini-') && !/tts|image|audio|embed|live/.test(name))
      .sort((a, b) => rank(a) - rank(b) || b.localeCompare(a, undefined, { numeric: true }))
    console.log(`ℹ️ Gemini model discovery: ${cache.models.slice(0, 6).join(', ')}${cache.models.length > 6 ? ', …' : ''}`)
  } catch (err) {
    console.error('Gemini model discovery failed:', err?.message || err)
  }
  return cache.models
}

function extractGeminiText(data) {
  const candidate = data?.candidates?.[0]
  const text = (candidate?.content?.parts || []).map(part => part.text || '').join('').trim()
  const blocked = Boolean(data?.promptFeedback?.blockReason) || candidate?.finishReason === 'SAFETY'
  return { text, blocked, finishReason: candidate?.finishReason }
}

async function geminiRequest(body, options = {}) {
  if (!isGeminiEnabled()) {
    throw new AIProviderError('not_configured', 'GEMINI_API_KEY is not set')
  }

  const payload = {
    ...body,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      // Gemini 2.5+ spends part of this budget thinking before it writes, so
      // a tight cap can come back as an empty answer — keep it roomy.
      maxOutputTokens: options.maxTokens ?? 4096,
    },
  }

  const deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS
  let sawQuota = false
  let lastDetail = 'no Gemini model reachable'
  let candidates = geminiModelCandidates()

  // Pass 0 walks the static chain; pass 1 walks models discovered live.
  for (let pass = 0; pass < 2 && Date.now() < deadline; pass++) {
    for (const model of candidates) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) break
      if ((geminiState.cooldownUntil.get(model) || 0) > Date.now()) {
        sawQuota = true
        continue
      }

      let response
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remaining)),
          }
        )
      } catch (err) {
        lastDetail = `${model}: ${err?.message || err}`
        console.error(`Gemini fetch failed (${model}):`, err?.message || err)
        continue
      }

      if (response.ok) {
        let data
        try {
          data = await response.json()
        } catch {
          lastDetail = `${model}: unparseable response body`
          continue
        }
        const { text, blocked, finishReason } = extractGeminiText(data)
        if (blocked) {
          geminiState.activeModel = model
          return 'I can\'t help with that particular request, but feel free to rephrase it and I\'ll do my best.'
        }
        if (text) {
          geminiState.activeModel = model
          return text
        }
        lastDetail = `${model}: empty response (finishReason: ${finishReason || 'unknown'})`
        console.error('Gemini returned no text:', lastDetail)
        continue
      }

      const errText = (await response.text().catch(() => '')).slice(0, 1000)
      lastDetail = `${model}: HTTP ${response.status} ${errText}`
      console.error(`Gemini error (${model}):`, lastDetail)

      if (/API[ _]?key/i.test(errText) || response.status === 401) {
        // Bad/expired key — no model will work, stop immediately.
        throw new AIProviderError('not_configured', lastDetail)
      }
      if (response.status === 404 || response.status === 403) {
        // Retired model, or this key isn't allowed to use it.
        geminiState.dead.add(model)
        continue
      }
      if (response.status === 429) {
        geminiState.cooldownUntil.set(model, Date.now() + GEMINI_QUOTA_COOLDOWN_MS)
        sawQuota = true
        continue
      }
      if (response.status === 400) {
        // A malformed request fails identically on every model — stop here.
        throw new AIProviderError('unavailable', lastDetail)
      }
      // 5xx / overloaded — fall through to the next model.
    }

    if (pass === 0) {
      const tried = new Set([...geminiModelCandidates(), ...geminiState.dead])
      candidates = (await discoverGeminiModels())
        .filter(model => !tried.has(model))
        .slice(0, 4)
      if (candidates.length === 0) break
    }
  }

  throw new AIProviderError(sawQuota ? 'busy' : 'unavailable', lastDetail)
}

async function geminiGenerate(prompt, options = {}) {
  return geminiRequest(
    {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    },
    options
  )
}

async function geminiChat(messages, options = {}) {
  const systemMessage = messages.find(m => m.role === 'system')?.content || SYSTEM_PROMPT
  const conversation = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
  return geminiRequest(
    { systemInstruction: { parts: [{ text: systemMessage }] }, contents: conversation },
    options
  )
}

async function generateAIResponse(promptOrMessages, options = {}) {
  if (isGeminiEnabled()) {
    return Array.isArray(promptOrMessages)
      ? geminiChat(promptOrMessages, options)
      : geminiGenerate(promptOrMessages, options)
  }
  if (AI_PROVIDER === 'gemini') {
    // Provider is gemini but the key is missing — fail with the friendly
    // message instead of trying a local Ollama that production won't have.
    throw new AIProviderError('not_configured', 'GEMINI_API_KEY is not set')
  }
  return Array.isArray(promptOrMessages)
    ? ollamaChat(promptOrMessages, options)
    : ollamaGenerate(promptOrMessages, options)
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
    if (error instanceof AIProviderError) {
      return res.json({ response: getAIErrorResponse(error) })
    }
    res.status(500).json({ message: 'Something went wrong on our side. Please try again in a moment.' })
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
            summary: `I couldn't read the text inside **"${document.name}"** — it may be a scanned or unusual format. The file is saved in your library, and you can still ask me questions about the topic!`,
          })
        }
      } else {
        return res.json({ summary: 'This file is no longer available on the server, so I can\'t summarize it. Please upload it again and I\'ll take another look.' })
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
    if (error instanceof AIProviderError) {
      return res.json({ summary: getAIErrorResponse(error) })
    }
    res.status(500).json({ message: 'Something went wrong while summarizing. Please try again in a moment.' })
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
    res.status(500).json({ message: 'Could not read this document. Please try again.' })
  }
}

// ── AI Chat Message persistence ──

// @desc    Get all AI chat messages for the current user
// @route   GET /api/ai/messages
export const getAiChatMessages = async (req, res) => {
  try {
    // Older builds persisted raw provider errors ("⚠️ **AI error**: Gemini
    // error (404): …") into chat history — scrub them so returning users
    // don't keep seeing technical noise from before the fix.
    await prisma.aiChatMessage.deleteMany({
      where: {
        userId: req.user.id,
        sender: 'assistant',
        OR: [
          { text: { contains: '**AI error**' } },
          { text: { contains: 'Gemini error (' } },
          { text: { contains: 'Ollama error (' } },
          { text: { contains: 'Cannot reach Gemini' } },
          { text: { contains: 'Cannot connect to Ollama' } },
        ],
      },
    })
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
