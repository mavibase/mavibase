// Email Template Components for Mavibase
// Centralized email styling and components

const BRAND_COLOR = "#4a6cf7" // Primary blue from your theme
const TEXT_COLOR = "#1f2937"
const MUTED_COLOR = "#6b7280"
const BORDER_COLOR = "#e5e7eb"
const BG_COLOR = "#f9fafb"

// Mavibase SVG Logo (simplified for email)
const LOGO_SVG = `<svg width="40" height="40" viewBox="0 0 1017 245" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill="${BRAND_COLOR}" d="M10 39.4V61l14.8 12.2c8.1 6.7 28.6 23.9 45.5 38.2 16.9 14.4 31.1 26.2 31.5 26.4.4.1 12.9-10 27.7-22.6 14.9-12.5 35.3-29.8 45.5-38.3l18.5-15.6.3-21.6c.1-12 0-21.7-.4-21.7-.3 0-5.1 3.4-10.7 7.5C128 65.8 102.9 84 102.2 84c-1 0-19.2-13-61.7-44.1-15.4-11.3-28.6-20.8-29.2-21.2-1-.7-1.3 3.7-1.3 20.7"/>
  <path fill="${BRAND_COLOR}" d="M10 133.7v58.8l21.8 17.2L53.5 227l.5-41.4.5-41.3 23.4 22.8c12.9 12.6 24 22.9 24.7 22.9s11.3-10.3 23.7-23c12.3-12.6 22.7-23 23-23 .4 0 .8 18.6.9 41.3l.3 41.4 19.9-15.8c10.9-8.6 20.7-16.5 21.7-17.6 1.8-1.8 1.9-4.2 1.7-60.1l-.3-58.2-10.5 9.1c-13.7 11.8-42.9 36.7-64.3 54.6L101.8 153l-8.7-7.3c-4.7-4-20.3-17.2-34.6-29.2S27.4 90.2 21.3 84.7L10 74.9z"/>
</svg>`

// Social Media Icons (inline SVG for email compatibility)
const SOCIAL_ICONS = {
  twitter: `<svg width="20" height="20" fill="${MUTED_COLOR}" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  instagram: `<svg width="20" height="20" fill="${MUTED_COLOR}" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
  linkedin: `<svg width="20" height="20" fill="${MUTED_COLOR}" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  github: `<svg width="20" height="20" fill="${MUTED_COLOR}" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`,
}

export const getEmailHeader = (title: string, subtitle?: string): string => `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          line-height: 1.6;
          color: ${TEXT_COLOR};
          background-color: #f3f4f6;
          -webkit-font-smoothing: antialiased;
        }
        
        .email-wrapper {
          width: 100%;
          background-color: #f3f4f6;
          padding: 40px 20px;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .email-header {
          text-align: center;
          padding: 40px 40px 30px;
          border-bottom: 1px solid ${BORDER_COLOR};
        }
        
        .logo {
          margin-bottom: 24px;
        }
        
        .email-title {
          font-size: 24px;
          font-weight: 700;
          color: ${TEXT_COLOR};
          margin-bottom: 8px;
        }
        
        .email-subtitle {
          font-size: 14px;
          color: ${MUTED_COLOR};
        }
        
        .email-body {
          padding: 32px 40px;
        }
        
        .greeting {
          font-size: 15px;
          color: ${TEXT_COLOR};
          margin-bottom: 16px;
        }
        
        .content-text {
          font-size: 15px;
          color: ${TEXT_COLOR};
          margin-bottom: 24px;
          line-height: 1.7;
        }
        
        .button-container {
          text-align: center;
          margin: 32px 0;
        }
        
        .primary-button {
          display: inline-block;
          background-color: ${BRAND_COLOR};
          color: #ffffff !important;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          transition: background-color 0.2s;
        }
        
        .primary-button:hover {
          background-color: #3b5ce5;
        }
        
        .link-text {
          text-align: center;
          font-size: 13px;
          color: ${MUTED_COLOR};
          margin-top: 16px;
        }
        
        .link-url {
          color: ${BRAND_COLOR};
          word-break: break-all;
          font-size: 12px;
        }
        
        .notice-box {
          background-color: ${BG_COLOR};
          border-left: 4px solid ${BRAND_COLOR};
          padding: 16px 20px;
          margin: 24px 0;
          border-radius: 0 8px 8px 0;
        }
        
        .notice-title {
          font-weight: 600;
          font-size: 14px;
          color: ${TEXT_COLOR};
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .notice-text {
          font-size: 13px;
          color: ${MUTED_COLOR};
          line-height: 1.5;
        }
        
        .help-section {
          border-top: 1px solid ${BORDER_COLOR};
          padding: 24px 40px;
          background-color: #ffffff;
        }
        
        .help-title {
          font-size: 16px;
          font-weight: 600;
          color: ${TEXT_COLOR};
          margin-bottom: 12px;
        }
        
        .help-text {
          font-size: 14px;
          color: ${MUTED_COLOR};
          margin-bottom: 16px;
        }
        
        .help-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: ${TEXT_COLOR};
          margin-bottom: 8px;
        }
        
        .help-icon {
          width: 20px;
          height: 20px;
          color: ${MUTED_COLOR};
        }
        
        .email-footer {
          background-color: ${BG_COLOR};
          padding: 32px 40px;
          text-align: center;
          border-top: 1px solid ${BORDER_COLOR};
        }
        
        .social-links {
          margin-bottom: 20px;
        }
        
        .social-link {
          display: inline-block;
          margin: 0 8px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        
        .social-link:hover {
          opacity: 1;
        }
        
        .footer-copyright {
          font-size: 13px;
          color: ${MUTED_COLOR};
          margin-bottom: 16px;
          line-height: 1.6;
        }
        
        .footer-links {
          font-size: 12px;
          color: ${MUTED_COLOR};
        }
        
        .footer-link {
          color: ${MUTED_COLOR};
          text-decoration: none;
          margin: 0 8px;
        }
        
        .footer-link:hover {
          color: ${BRAND_COLOR};
          text-decoration: underline;
        }
        
        .footer-divider {
          color: ${BORDER_COLOR};
        }
        
        .code-box {
          background-color: ${BG_COLOR};
          border: 2px solid ${BORDER_COLOR};
          padding: 24px;
          text-align: center;
          border-radius: 8px;
          margin: 24px 0;
        }
        
        .code-value {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 8px;
          color: ${BRAND_COLOR};
          font-family: 'Courier New', monospace;
        }
        
        .role-change-box {
          background-color: ${BG_COLOR};
          border: 2px solid ${BRAND_COLOR};
          padding: 20px;
          text-align: center;
          border-radius: 8px;
          margin: 24px 0;
        }
        
        .warning-box {
          background-color: #fef2f2;
          border-left: 4px solid #dc2626;
          padding: 16px 20px;
          margin: 24px 0;
          border-radius: 0 8px 8px 0;
        }
        
        .warning-title {
          font-weight: 600;
          font-size: 14px;
          color: #991b1b;
          margin-bottom: 4px;
        }
        
        .warning-text {
          font-size: 13px;
          color: #7f1d1d;
          line-height: 1.5;
        }

        @media only screen and (max-width: 600px) {
          .email-wrapper {
            padding: 20px 10px;
          }
          .email-header,
          .email-body,
          .help-section,
          .email-footer {
            padding-left: 24px;
            padding-right: 24px;
          }
          .email-title {
            font-size: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          <div class="email-header">
            <div class="logo">
              ${LOGO_SVG}
            </div>
            <h1 class="email-title">${title}</h1>
            ${subtitle ? `<p class="email-subtitle">${subtitle}</p>` : ""}
          </div>
          <div class="email-body">
`

export const getEmailFooter = (): string => {
  const currentYear = new Date().getFullYear()
  
  return `
          </div>
          
          <div class="help-section">
            <h3 class="help-title">Need Help?</h3>
            <p class="help-text">Our support team is available to assist you:</p>
            <div class="help-item">
              <span>📧</span>
              <span>support@mavibase.com</span>
            </div>
            <div class="help-item">
              <span>🌐</span>
              <a href="https://eightve.com" style="color: ${BRAND_COLOR}; text-decoration: none;">Visit Eightve</a>
            </div>
          </div>
          
          <div class="email-footer">
            <div class="social-links">
              <a href="https://twitter.com/mavibase" class="social-link" title="Twitter">${SOCIAL_ICONS.twitter}</a>
              <a href="https://instagram.com/mavibase" class="social-link" title="Instagram">${SOCIAL_ICONS.instagram}</a>
              <a href="https://linkedin.com/company/mavibase" class="social-link" title="LinkedIn">${SOCIAL_ICONS.linkedin}</a>
              <a href="https://github.com/mavibase" class="social-link" title="GitHub">${SOCIAL_ICONS.github}</a>
            </div>
            
            <p class="footer-copyright">
              © ${currentYear} Mavibase™. Mavibase is a trademark of Eightve Limited.<br>
              All rights reserved.
            </p>
            
            <div class="footer-links">
              <a href="https://mavibase.com/privacy" class="footer-link">Privacy Policy</a>
              <span class="footer-divider">|</span>
              <a href="https://mavibase.com/terms" class="footer-link">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>
  `
}

export const getButton = (text: string, url: string): string => `
  <div class="button-container">
    <a href="${url}" class="primary-button">${text}</a>
  </div>
  <p class="link-text">
    Or copy and paste this link into your browser:<br>
    <a href="${url}" class="link-url">${url}</a>
  </p>
`

export const getNoticeBox = (title: string, text: string): string => `
  <div class="notice-box">
    <p class="notice-title">🔒 ${title}</p>
    <p class="notice-text">${text}</p>
  </div>
`

export const getWarningBox = (title: string, text: string): string => `
  <div class="warning-box">
    <p class="warning-title">⚠️ ${title}</p>
    <p class="warning-text">${text}</p>
  </div>
`

export const getCodeBox = (code: string): string => `
  <div class="code-box">
    <div class="code-value">${code}</div>
  </div>
`

export const getRoleChangeBox = (oldRole: string, newRole: string): string => `
  <div class="role-change-box">
    <p style="margin: 0; color: ${MUTED_COLOR}; font-size: 14px;">Previous Role: <strong>${oldRole}</strong></p>
    <p style="margin: 10px 0 0 0; font-size: 18px;">New Role: <strong style="color: ${BRAND_COLOR};">${newRole}</strong></p>
  </div>
`
