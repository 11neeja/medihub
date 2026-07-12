import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import { buildWelcomeEmail, buildPasswordResetEmail } from './mailTemplates.js'

dotenv.config()

export const hasSmtpConfig = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

let transporter = null

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
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER
  const fromName = process.env.SMTP_FROM_NAME || 'MediHub'
  return fromEmail ? `${fromName} <${fromEmail}>` : fromName
}

const buildTransportOptions = ({ port, secure }) => {
  return {
    host: process.env.SMTP_HOST,
    port,
    secure,
    family: Number(process.env.SMTP_FAMILY || 4),
    requireTLS: String(process.env.SMTP_REQUIRE_TLS || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    logger: String(process.env.SMTP_DEBUG || 'false') === 'true',
    debug: String(process.env.SMTP_DEBUG || 'false') === 'true',
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
  }
}

const createTransporter = ({ port, secure }) => {
  const transportOptions = buildTransportOptions({ port, secure })

  const createdTransporter = nodemailer.createTransport(transportOptions, {
    from: getFromAddress(),
  })

  console.log('SMTP transporter initialized:', {
    host: process.env.SMTP_HOST,
    port,
    secure,
    family: Number(process.env.SMTP_FAMILY || 4),
    from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
  })

  return createdTransporter
}

const getTransporterCandidates = () => {
  const host = process.env.SMTP_HOST || ''
  const primaryPort = Number(process.env.SMTP_PORT || 587)
  const primarySecure = String(process.env.SMTP_SECURE || 'false') === 'true'

  const candidates = [{ port: primaryPort, secure: primarySecure }]

  const isGmailHost = /(^|\.)gmail\.com$/i.test(host) || host === 'smtp.gmail.com'
  if (isGmailHost && primaryPort !== 465) {
    candidates.push({ port: 465, secure: true })
  }

  return candidates
}

const withTransportFallback = async (label, action) => {
  const candidates = getTransporterCandidates()
  let lastError = null

  for (const candidate of candidates) {
    try {
      const candidateTransporter = createTransporter(candidate)
      const result = await action(candidateTransporter)
      transporter = candidateTransporter
      return result
    } catch (error) {
      lastError = error
      console.warn(`${label} failed for SMTP port ${candidate.port}:`, {
        message: error.message,
        code: error.code,
        responseCode: error.responseCode,
        command: error.command,
      })
    }
  }

  throw lastError || new Error(`${label} failed for all SMTP connection attempts.`)
}

const getTransporter = () => {
  if (transporter) return transporter

  if (!hasSmtpConfig()) return null

  return createTransporter({
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  })
}

export const verifyMailerConnection = async () => {
  if (!hasSmtpConfig()) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env.')
  }

  await withTransportFallback('SMTP verification', async (candidateTransporter) => {
    await candidateTransporter.verify()
    return true
  })
}

export const sendWelcomeEmail = async ({ name, email }) => {
  if (!hasSmtpConfig()) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env.')
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
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env.')
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