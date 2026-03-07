import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"
import { pool } from "../config/database"
import { v4 as uuidv4 } from "uuid"
import crypto from "crypto"
import { logger } from "../utils/logger"
import { 
  getEmailHeader, 
  getEmailFooter, 
  getButton, 
  getNoticeBox, 
  getWarningBox, 
  getCodeBox,
  getRoleChangeBox 
} from "./email-templates"

// Email configuration
const EMAIL_ENABLED = process.env.ENABLE_EMAIL_SERVICE === "true"
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || "smtp" // 'smtp' or 'resend'
const CODE_EXPIRY_MINUTES = Number.parseInt(process.env.TWO_FA_CODE_EXPIRY_MINUTES || "10")

// SMTP configuration
const smtpConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === "production",
  },
}

const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.EMAIL_FROM || "noreply@baasplatform.com"
const fromName = process.env.SMTP_FROM_NAME || "BaaS Platform"

let transporter: Transporter | null = null
let resendClient: any = null

// Initialize email provider
const initializeEmailProvider = async () => {
  if (!EMAIL_ENABLED) {
    logger.warn("[Email] Email service is disabled")
    return
  }

  if (EMAIL_PROVIDER === "resend") {
    try {
      // Dynamic import for Resend
      const { Resend } = await import("resend")
      resendClient = new Resend(process.env.RESEND_API_KEY)
      logger.info("[Email] Resend client initialized successfully")
    } catch (error) {
      logger.error("[Email] Failed to initialize Resend:", error)
    }
  } else {
    // Default to SMTP
    transporter = nodemailer.createTransport(smtpConfig)
    logger.info("[Email] SMTP transporter initialized")
  }
}

// Initialize on module load
initializeEmailProvider()

const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport(smtpConfig)
  }
  return transporter
}

export const verifyEmailConnection = async (): Promise<boolean> => {
  if (!EMAIL_ENABLED) {
    logger.warn("[Email] Email service is disabled")
    return false
  }

  if (EMAIL_PROVIDER === "resend") {
    return !!resendClient
  }

  try {
    const transport = getTransporter()
    await transport.verify()
    logger.info("[Email] SMTP connection verified successfully")
    return true
  } catch (error) {
    logger.error("[Email] SMTP connection failed:", error)
    return false
  }
}

// Send email via SMTP
const sendViaSMTP = async (mailOptions: any): Promise<void> => {
  const transport = getTransporter()
  await transport.sendMail(mailOptions)
}

// Send email via Resend
const sendViaResend = async (mailOptions: any): Promise<void> => {
  if (!resendClient) {
    throw new Error("Resend client not initialized")
  }

  await resendClient.emails.send({
    from: mailOptions.from,
    to: mailOptions.to,
    subject: mailOptions.subject,
    html: mailOptions.html,
  })
}

// Generic send email function
const sendEmail = async (mailOptions: any): Promise<void> => {
  if (!EMAIL_ENABLED) {
    logger.warn("[Email] Email service is disabled, skipping email send")
    return
  }

  try {
    if (EMAIL_PROVIDER === "resend") {
      await sendViaResend(mailOptions)
    } else {
      await sendViaSMTP(mailOptions)
    }
    logger.info(`[Email] Email sent successfully to ${mailOptions.to} via ${EMAIL_PROVIDER}`)
  } catch (error) {
    logger.error(`[Email] Failed to send email via ${EMAIL_PROVIDER}:`, error)
    throw new Error("Failed to send email")
  }
}

export const sendVerificationEmail = async (email: string, userId: string): Promise<void> => {
  const token = uuidv4()
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

  await pool.query(
    "INSERT INTO email_verifications (user_id, email, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')",
    [userId, email, tokenHash],
  )

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const verificationLink = process.env.EMAIL_VERIFICATION_URL
    ? `${process.env.EMAIL_VERIFICATION_URL}?token=${token}`
    : `${frontendUrl}/account/verify-email?token=${token}`

  const mailOptions = {
    from: `"Mavibase" <${fromEmail}>`,
    to: email,
    subject: "Verify Your Email Address",
    html: `
      ${getEmailHeader("Verify Your Email Address", "Thank you for registering with Mavibase")}
      <p class="greeting">Hello,</p>
      <p class="content-text">
        Welcome to Mavibase! We're excited to have you on board. To complete your registration
        and access all features, please verify your email address by clicking the button below.
      </p>
      ${getButton("Verify Email Address", verificationLink)}
      ${getNoticeBox("Security Notice", "This verification link will expire in 24 hours. For your security, please do not share this email with anyone.")}
      <p class="content-text" style="margin-top: 24px;">
        If you didn't create an account with Mavibase, you can safely ignore this email.
      </p>
      ${getEmailFooter()}
    `,
    text: `Verify Your Email Address\n\nThank you for registering with Mavibase!\n\n${verificationLink}\n\nThis link will expire in 24 hours.`,
  }

  await sendEmail(mailOptions)
}

export const sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`

  const mailOptions = {
    from: `"Mavibase" <${fromEmail}>`,
    to: email,
    subject: "Reset Your Password",
    html: `
      ${getEmailHeader("Reset Your Password", "We received a request to reset your password")}
      <p class="greeting">Hello,</p>
      <p class="content-text">
        We received a request to reset the password for your Mavibase account. 
        Click the button below to create a new password.
      </p>
      ${getButton("Reset Password", resetLink)}
      ${getWarningBox("Security Notice", "This password reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you have concerns.")}
      <p class="content-text" style="margin-top: 24px;">
        For security reasons, this link can only be used once. If you need to reset your password again, 
        please request a new reset link.
      </p>
      ${getEmailFooter()}
    `,
  }

  await sendEmail(mailOptions)
}

export const send2FACodeEmail = async (email: string, code: string, userName: string): Promise<void> => {
  const mailOptions = {
    from: `"Mavibase" <${fromEmail}>`,
    to: email,
    subject: "Your Two-Factor Authentication Code",
    html: `
      ${getEmailHeader("Two-Factor Authentication", "Your verification code is ready")}
      <p class="greeting">Hi ${userName},</p>
      <p class="content-text">
        Use the verification code below to complete your sign-in to Mavibase.
      </p>
      ${getCodeBox(code)}
      <p class="content-text" style="text-align: center;">
        This code expires in <strong>${CODE_EXPIRY_MINUTES} minutes</strong>.
      </p>
      ${getWarningBox("Security Alert", "If you didn't request this code, someone may be trying to access your account. Please secure your account immediately by changing your password.")}
      ${getEmailFooter()}
    `,
  }

  await sendEmail(mailOptions)
}

export const sendTeamInviteEmail = async (
  email: string,
  teamName: string,
  inviteToken: string,
  inviteId: string,
): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const acceptLink = `${frontendUrl}/account/accept-invite?token=${inviteToken}&inviteId=${inviteId}`

  const mailOptions = {
    from: `"Mavibase" <${fromEmail}>`,
    to: email,
    subject: `You're invited to join ${teamName}`,
    html: `
      ${getEmailHeader("Team Invitation", `You've been invited to collaborate on Mavibase`)}
      <p class="greeting">Hello,</p>
      <p class="content-text">
        You've been invited to join <strong>${teamName}</strong> on Mavibase. 
        Click the button below to accept the invitation and start collaborating with your team.
      </p>
      ${getButton("Accept Invitation", acceptLink)}
      ${getNoticeBox("Invitation Details", "This invitation will expire in 7 days. If you don't recognize this team or didn't expect this invitation, you can safely ignore this email.")}
      ${getEmailFooter()}
    `,
  }

  await sendEmail(mailOptions)
}

export const sendMemberRemovedEmail = async (
  email: string,
  userName: string,
  teamName: string,
  removedBy: string,
): Promise<void> => {
  const mailOptions = {
    from: `"Mavibase" <${fromEmail}>`,
    to: email,
    subject: `You've been removed from ${teamName}`,
    html: `
      ${getEmailHeader("Team Membership Update", `Your access to ${teamName} has changed`)}
      <p class="greeting">Hi ${userName},</p>
      <p class="content-text">
        You have been removed from the team <strong>${teamName}</strong> by ${removedBy}.
      </p>
      <p class="content-text">
        You no longer have access to this team's projects and resources. Any shared content 
        or collaborations will no longer be available to you.
      </p>
      ${getNoticeBox("Need Help?", "If you believe this was done in error, please contact the team administrator or reach out to our support team.")}
      ${getEmailFooter()}
    `,
  }

  await sendEmail(mailOptions)
}

export const sendRoleChangedEmail = async (
  email: string,
  userName: string,
  teamName: string,
  oldRole: string,
  newRole: string,
  changedBy: string,
): Promise<void> => {
  const mailOptions = {
    from: `"Mavibase" <${fromEmail}>`,
    to: email,
    subject: `Your role has been updated in ${teamName}`,
    html: `
      ${getEmailHeader("Role Updated", `Your permissions in ${teamName} have changed`)}
      <p class="greeting">Hi ${userName},</p>
      <p class="content-text">
        Your role in <strong>${teamName}</strong> has been updated by ${changedBy}.
      </p>
      ${getRoleChangeBox(oldRole, newRole)}
      <p class="content-text">
        Your permissions and access have been updated accordingly. The changes take effect immediately.
      </p>
      ${getNoticeBox("What's Changed?", "Your new role may give you access to additional features or restrict certain actions. Please review the team settings to understand your new permissions.")}
      ${getEmailFooter()}
    `,
  }

  await sendEmail(mailOptions)
}
