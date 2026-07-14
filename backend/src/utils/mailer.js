import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import { buildWelcomeEmail, buildPasswordResetEmail, buildDiagnosticEmail } from './mailTemplates.js'

dotenv.config()

// ── Delivery architecture ───────────────────────────────────────
// Two independent providers, tried in order until one delivers:
//
//   1. brevo — transactional mail over HTTPS (api.brevo.com, port 443).
//      Immune to the two ways Gmail SMTP dies on cloud hosts: blocked or
//      throttled SMTP egress, and Google rejecting logins from datacenter
//      IPs even when the app password is valid. Enabled by BREVO_API_KEY.
//   2. smtp — Gmail/Nodemailer with sanitized credentials and 465/587
//      port fallback. Enabled by SMTP_HOST + SMTP_USER + SMTP_PASS.
//
// With both configured, Brevo is primary and SMTP the automatic
// fallback, so no single provider outage can stop mail.

const trimmed = (value) => (value || '').trim()

const isGmailHost = (host) => /(^|\.)gmail\.com$/i.test(host)

const smtpHost = () => trimmed(process.env.SMTP_HOST)
const smtpUser = () => trimmed(process.env.SMTP_USER)

// Gmail shows app passwords as "xxxx xxxx xxxx xxxx"; the spaces are
// display-only and break SMTP auth when pasted verbatim. Strip them.
const smtpPass = () => {
  const raw = trimmed(process.env.SMTP_PASS)
  const compact = raw.replace(/\s+/g, '')
  const looksLikeAppPassword = /^[a-z]{16}$/i.test(compact)
  return isGmailHost(smtpHost()) || looksLikeAppPassword ? compact : raw
}

const brevoApiKey = () => trimmed(process.env.BREVO_API_KEY)

export const hasSmtpConfig = () => Boolean(smtpHost() && smtpUser() && smtpPass())
export const hasBrevoConfig = () => Boolean(brevoApiKey())
export const hasMailConfig = () => hasBrevoConfig() || hasSmtpConfig()

const NOT_CONFIGURED_HINT =
  'Mail is not configured. Set BREVO_API_KEY (recommended for production) or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS ' +
  'in backend/.env (local) or the Render dashboard (production).'

// ── Status + diagnostics — surfaced by /api/health and /api/users/test-email
let mailerStatus = 'unverified' // 'not_configured' | 'unverified' | 'ok' | 'error'
let lastSuccess = null // { provider, label, at }
let lastError = null // { provider, label, message, at }

const sanitizeErrorMessage = (message) =>
  String(message || 'Unknown error').replace(/\s+/g, ' ').trim().slice(0, 300)

export const getMailerStatus = () => (hasMailConfig() ? mailerStatus : 'not_configured')

export const getMailerDiagnostics = () => ({
  configured: [hasBrevoConfig() && 'brevo', hasSmtpConfig() && 'smtp'].filter(Boolean),
  status: getMailerStatus(),
  lastSuccess,
  lastError,
})

const recordSuccess = (provider, label) => {
  mailerStatus = 'ok'
  lastSuccess = { provider, label, at: new Date().toISOString() }
}

const recordFailure = (provider, label, error) => {
  lastError = { provider, label, message: sanitizeErrorMessage(error.message), at: new Date().toISOString() }
}

const getFromParts = () => ({
  email: trimmed(process.env.SMTP_FROM_EMAIL) || smtpUser(),
  name: trimmed(process.env.SMTP_FROM_NAME) || 'MediHub',
})

const getFromAddress = () => {
  const { email, name } = getFromParts()
  return email ? `${name} <${email}>` : name
}

const assertMailAccepted = (info, label) => {
  const acceptedCount = Array.isArray(info.accepted) ? info.accepted.length : 0
  const rejectedCount = Array.isArray(info.rejected) ? info.rejected.length : 0

  if (acceptedCount === 0 || rejectedCount > 0) {
    throw new Error(
      `${label} was not accepted by the SMTP server. accepted=${JSON.stringify(info.accepted || [])} rejected=${JSON.stringify(info.rejected || [])}`
    )
  }
}

// ── Provider: Brevo (HTTPS API) ─────────────────────────────────

const describeBrevoFailure = (status, data) => {
  const detail = data?.message || data?.code || data?.raw || ''

  if (status === 401) {
    return (
      'Brevo rejected the API key (401). Create a key at https://app.brevo.com/settings/keys/api and set ' +
      'BREVO_API_KEY where this server runs (production: Render dashboard; local: backend/.env).'
    )
  }

  if (status === 400 && /sender/i.test(String(detail))) {
    return (
      `Brevo rejected the sender (${detail}). Verify ${getFromParts().email || 'SMTP_FROM_EMAIL'} under ` +
      'Senders at https://app.brevo.com/senders/list — Brevo only sends from verified addresses.'
    )
  }

  if (status === 402) {
    return 'Brevo account is out of email credits (402). The free tier resets daily — check https://app.brevo.com.'
  }

  return `Brevo API error ${status}: ${detail || 'no detail'}`
}

const brevoRequest = async (path, { method = 'GET', body } = {}) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.BREVO_TIMEOUT || 15000))

  try {
    const response = await fetch(`https://api.brevo.com/v3${path}`, {
      method,
      headers: {
        'api-key': brevoApiKey(),
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const text = await response.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { raw: text }
    }

    if (!response.ok) throw new Error(describeBrevoFailure(response.status, data))
    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Brevo API request timed out — check outbound HTTPS connectivity to api.brevo.com.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

const sendViaBrevo = async ({ to, toName, subject, html, text }) => {
  const { email: fromEmail, name: fromName } = getFromParts()
  if (!fromEmail) {
    throw new Error('Brevo needs a sender address — set SMTP_FROM_EMAIL (or SMTP_USER) to the address verified in Brevo.')
  }

  const data = await brevoRequest('/smtp/email', {
    method: 'POST',
    body: {
      sender: { email: fromEmail, name: fromName },
      to: [{ email: to, ...(toName ? { name: toName } : {}) }],
      subject,
      htmlContent: html,
      textContent: text,
    },
  })

  return { messageId: data.messageId || null }
}

// ── Provider: Gmail SMTP (Nodemailer) ───────────────────────────

// Last transport config that actually worked; tried first on later sends
// so we stop re-probing ports (and re-logging) on every email.
let knownGoodConfig = null

const buildTransportOptions = ({ port, secure }) => {
  return {
    host: smtpHost(),
    port,
    secure,
    family: Number(process.env.SMTP_FAMILY || 4),
    requireTLS: String(process.env.SMTP_REQUIRE_TLS || 'true') === 'true',
    auth: {
      user: smtpUser(),
      pass: smtpPass(),
    },
    logger: String(process.env.SMTP_DEBUG || 'false') === 'true',
    debug: String(process.env.SMTP_DEBUG || 'false') === 'true',
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
  }
}

const createTransporter = ({ port, secure }) =>
  nodemailer.createTransport(buildTransportOptions({ port, secure }), {
    from: getFromAddress(),
  })

// Candidate transport configs, most likely to succeed first. For Gmail we
// always keep both 465 (implicit TLS) and 587 (STARTTLS) on the list —
// hosts like Render allow both but block port 25.
const getTransportCandidates = () => {
  const primaryPort = Number(process.env.SMTP_PORT || 587)
  const primarySecure = String(process.env.SMTP_SECURE || 'false') === 'true'

  const candidates = []
  const addCandidate = (candidate) => {
    if (!candidates.some((c) => c.port === candidate.port && c.secure === candidate.secure)) {
      candidates.push(candidate)
    }
  }

  if (knownGoodConfig) addCandidate(knownGoodConfig)
  addCandidate({ port: primaryPort, secure: primarySecure })

  if (isGmailHost(smtpHost())) {
    addCandidate({ port: 465, secure: true })
    addCandidate({ port: 587, secure: false })
  }

  return candidates
}

// Translate low-level SMTP failures into instructions someone can act on
// from the production logs alone.
const describeSmtpFailure = (error) => {
  const message = error?.message || ''

  if (error?.code === 'EAUTH' || /535|Username and Password not accepted|Invalid login/i.test(message)) {
    return (
      'Gmail rejected the login (535). Either the app password is wrong/revoked — regenerate at ' +
      'https://myaccount.google.com/apppasswords and update SMTP_PASS where this server runs — or Google is ' +
      'blocking sign-ins from this host\'s IP (common on cloud providers even with a valid app password). ' +
      'If the same password works locally, set BREVO_API_KEY so mail goes over HTTPS instead.'
    )
  }

  if (error?.code === 'ETIMEDOUT' || error?.code === 'ESOCKET' || /timed?\s*out/i.test(message)) {
    return (
      'Could not reach the SMTP server (timeout). The host may block this port — ' +
      'Gmail works on 465 (TLS) or 587 (STARTTLS); port 25 is blocked on most cloud hosts.'
    )
  }

  if (error?.code === 'EDNS' || /ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return 'DNS lookup for the SMTP host failed. Check SMTP_HOST (expected: smtp.gmail.com).'
  }

  return null
}

const withTransportFallback = async (label, action) => {
  const candidates = getTransportCandidates()
  let lastAttemptError = null

  for (const candidate of candidates) {
    try {
      const candidateTransporter = createTransporter(candidate)
      const result = await action(candidateTransporter)

      if (!knownGoodConfig || knownGoodConfig.port !== candidate.port || knownGoodConfig.secure !== candidate.secure) {
        console.log('SMTP transport ready:', {
          host: smtpHost(),
          port: candidate.port,
          secure: candidate.secure,
          from: trimmed(process.env.SMTP_FROM_EMAIL) || smtpUser(),
        })
      }

      knownGoodConfig = { port: candidate.port, secure: candidate.secure }
      return result
    } catch (error) {
      lastAttemptError = error
      if (knownGoodConfig && knownGoodConfig.port === candidate.port && knownGoodConfig.secure === candidate.secure) {
        knownGoodConfig = null
      }
      console.warn(`${label} failed for SMTP port ${candidate.port}:`, {
        message: error.message,
        code: error.code,
        responseCode: error.responseCode,
        command: error.command,
      })
    }
  }

  const hint = describeSmtpFailure(lastAttemptError)
  if (hint) {
    console.error(`${label}: ${hint}`)
    if (lastAttemptError) lastAttemptError.message = `${lastAttemptError.message} — ${hint}`
  }

  throw lastAttemptError || new Error(`${label} failed for all SMTP connection attempts.`)
}

const sendViaSmtp = async ({ label, to, subject, html, text }) => {
  const info = await withTransportFallback(label, (transporter) =>
    transporter.sendMail({ from: getFromAddress(), to, subject, html, text })
  )
  assertMailAccepted(info, label)
  return { messageId: info.messageId || null }
}

// ── Unified dispatch ────────────────────────────────────────────

const getProviders = () => {
  const providers = []
  if (hasBrevoConfig()) providers.push({ name: 'brevo', send: sendViaBrevo })
  if (hasSmtpConfig()) providers.push({ name: 'smtp', send: sendViaSmtp })
  return providers
}

const deliver = async (label, message) => {
  const providers = getProviders()
  if (providers.length === 0) throw new Error(NOT_CONFIGURED_HINT)

  const failures = []
  for (const provider of providers) {
    try {
      const result = await provider.send({ label, ...message })
      recordSuccess(provider.name, label)
      console.log(`${label} sent via ${provider.name}:`, { to: message.to, messageId: result.messageId })
      return { provider: provider.name, ...result }
    } catch (error) {
      recordFailure(provider.name, label, error)
      console.error(`${label} via ${provider.name} failed: ${sanitizeErrorMessage(error.message)}`)
      failures.push(`${provider.name}: ${sanitizeErrorMessage(error.message)}`)
    }
  }

  mailerStatus = 'error'
  throw new Error(`${label} failed on every configured provider. ${failures.join(' | ')}`)
}

// Verify every configured provider without sending mail. Succeeds if at
// least one provider is usable (that is enough to deliver).
export const verifyMailerConnection = async () => {
  if (!hasMailConfig()) throw new Error(NOT_CONFIGURED_HINT)

  const results = []
  const failures = []

  if (hasBrevoConfig()) {
    try {
      const account = await brevoRequest('/account')
      results.push(`brevo ok (${account.email || 'account verified'})`)
    } catch (error) {
      recordFailure('brevo', 'Brevo verification', error)
      failures.push(`brevo: ${sanitizeErrorMessage(error.message)}`)
    }
  }

  if (hasSmtpConfig()) {
    try {
      await withTransportFallback('SMTP verification', async (transporter) => {
        await transporter.verify()
        return true
      })
      results.push(`smtp ok (${smtpHost()})`)
    } catch (error) {
      recordFailure('smtp', 'SMTP verification', error)
      failures.push(`smtp: ${sanitizeErrorMessage(error.message)}`)
    }
  }

  if (results.length > 0) {
    mailerStatus = 'ok'
    if (failures.length > 0) console.warn(`Mail verification partial — ${failures.join(' | ')}`)
    return results.join('; ')
  }

  mailerStatus = 'error'
  throw new Error(failures.join(' | '))
}

// ── Application emails ──────────────────────────────────────────

export const sendWelcomeEmail = async ({ name, email }) =>
  deliver('Welcome email', {
    to: email,
    toName: name,
    subject: 'Welcome to MediHub',
    html: buildWelcomeEmail({ name }),
    text: `Welcome to MediHub, ${name}. Visit ${process.env.FRONTEND_URL || 'http://localhost:3000'}/home to get started.`,
  })

export const sendPasswordResetEmail = async ({ name, email, resetUrl }) =>
  deliver('Password reset email', {
    to: email,
    toName: name,
    subject: 'Reset your MediHub password',
    html: buildPasswordResetEmail({ name, resetUrl }),
    text: `Reset your MediHub password: ${resetUrl}`,
  })

// One-click production probe (POST /api/users/test-email): sends to the
// caller's own address and reports which provider delivered, or why not.
export const sendTestEmail = async ({ name, email }) =>
  deliver('Mail diagnostic', {
    to: email,
    toName: name,
    subject: 'MediHub mail delivery check',
    html: buildDiagnosticEmail({ name }),
    text: 'Mail delivery from MediHub is working. Welcome and password-reset emails will reach users.',
  })
