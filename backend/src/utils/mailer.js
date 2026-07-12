import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import { buildWelcomeEmail, buildPasswordResetEmail } from './mailTemplates.js'

dotenv.config()

// ── Credential hygiene ──────────────────────────────────────────
// Gmail shows app passwords as "xxxx xxxx xxxx xxxx"; the spaces are
// display-only. Pasting them verbatim into .env or the Render dashboard
// makes Gmail reject the login with 535. Strip whitespace for Gmail hosts
// (and anything shaped like an app password) so a spaced paste can never
// break mail again, locally or in production.

const trimmed = (value) => (value || '').trim()

const isGmailHost = (host) => /(^|\.)gmail\.com$/i.test(host)

const smtpHost = () => trimmed(process.env.SMTP_HOST)
const smtpUser = () => trimmed(process.env.SMTP_USER)

const smtpPass = () => {
  const raw = trimmed(process.env.SMTP_PASS)
  const compact = raw.replace(/\s+/g, '')
  const looksLikeAppPassword = /^[a-z]{16}$/i.test(compact)
  return isGmailHost(smtpHost()) || looksLikeAppPassword ? compact : raw
}

export const hasSmtpConfig = () => Boolean(smtpHost() && smtpUser() && smtpPass())

// 'not_configured' | 'unverified' | 'ok' | 'error' — surfaced by /api/health
let mailerStatus = 'unverified'
export const getMailerStatus = () => (hasSmtpConfig() ? mailerStatus : 'not_configured')

// Last transport config that actually worked; tried first on later sends
// so we stop re-probing ports (and re-logging) on every email.
let knownGoodConfig = null

const assertMailAccepted = (info, label) => {
  const acceptedCount = Array.isArray(info.accepted) ? info.accepted.length : 0
  const rejectedCount = Array.isArray(info.rejected) ? info.rejected.length : 0

  if (acceptedCount === 0 || rejectedCount > 0) {
    throw new Error(
      `${label} was not accepted by the SMTP server. accepted=${JSON.stringify(info.accepted || [])} rejected=${JSON.stringify(info.rejected || [])}`
    )
  }
}

const getFromAddress = () => {
  const fromEmail = trimmed(process.env.SMTP_FROM_EMAIL) || smtpUser()
  const fromName = trimmed(process.env.SMTP_FROM_NAME) || 'MediHub'
  return fromEmail ? `${fromName} <${fromEmail}>` : fromName
}

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
      'Gmail rejected the login (535). The app password is wrong or has been revoked — ' +
      'generate a new one at https://myaccount.google.com/apppasswords and update SMTP_PASS ' +
      'where this server runs (production: Render dashboard → medihub-backend → Environment; local: backend/.env). ' +
      'Note: changing the Google account password revokes ALL existing app passwords.'
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
  let lastError = null

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
      mailerStatus = 'ok'
      return result
    } catch (error) {
      lastError = error
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

  mailerStatus = 'error'
  const hint = describeSmtpFailure(lastError)
  if (hint) console.error(`${label}: ${hint}`)

  throw lastError || new Error(`${label} failed for all SMTP connection attempts.`)
}

export const verifyMailerConnection = async () => {
  if (!hasSmtpConfig()) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env (local) or the Render dashboard (production).')
  }

  await withTransportFallback('SMTP verification', async (candidateTransporter) => {
    await candidateTransporter.verify()
    return true
  })
}

export const sendWelcomeEmail = async ({ name, email }) => {
  if (!hasSmtpConfig()) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env (local) or the Render dashboard (production).')
  }

  const info = await withTransportFallback('Welcome email', async (candidateTransporter) => candidateTransporter.sendMail({
    from: getFromAddress(),
    to: email,
    subject: 'Welcome to MediHub',
    html: buildWelcomeEmail({ name }),
    text: `Welcome to MediHub, ${name}. Visit ${process.env.FRONTEND_URL || 'http://localhost:3000'}/home to get started.`,
  }))

  assertMailAccepted(info, 'Welcome email')

  console.log('Welcome email sent:', {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  })
}

export const sendPasswordResetEmail = async ({ name, email, resetUrl }) => {
  if (!hasSmtpConfig()) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env (local) or the Render dashboard (production).')
  }

  const info = await withTransportFallback('Password reset email', async (candidateTransporter) => candidateTransporter.sendMail({
    from: getFromAddress(),
    to: email,
    subject: 'Reset your MediHub password',
    html: buildPasswordResetEmail({ name, resetUrl }),
    text: `Reset your MediHub password: ${resetUrl}`,
  }))

  assertMailAccepted(info, 'Password reset email')

  console.log('Password reset email sent:', {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  })
}
