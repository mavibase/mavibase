import type { Request, Response, NextFunction } from "express"

/**
 * Security Headers Middleware
 * 
 * Implements HTTPS enforcement, HSTS, and additional security headers
 * to protect against common web vulnerabilities.
 * 
 * Environment Variables:
 * - ENABLE_SECURITY_HEADERS: Enable/disable security headers (default: true in production)
 * - HSTS_MAX_AGE: HSTS max-age in seconds (default: 31536000 = 1 year)
 * - ENFORCE_HTTPS: Redirect HTTP to HTTPS in production (default: true)
 */

interface SecurityHeadersOptions {
  enableSecurityHeaders?: boolean
  hstsMaxAge?: number
  enforceHttps?: boolean
  includeSubDomains?: boolean
  preload?: boolean
}

const getSecurityOptions = (): SecurityHeadersOptions => {
  const isProduction = process.env.NODE_ENV === "production"
  
  return {
    enableSecurityHeaders: process.env.ENABLE_SECURITY_HEADERS !== "false",
    hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE || "31536000", 10),
    enforceHttps: isProduction && process.env.ENFORCE_HTTPS !== "false",
    includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== "false",
    preload: process.env.HSTS_PRELOAD === "true",
  }
}

/**
 * Check if request is secure (HTTPS)
 * Handles various proxy scenarios (X-Forwarded-Proto, etc.)
 */
const isSecureRequest = (req: Request): boolean => {
  // Direct HTTPS
  if (req.secure) return true
  
  // Behind proxy (Nginx, Load Balancer, Cloudflare, etc.)
  const forwardedProto = req.headers["x-forwarded-proto"]
  if (forwardedProto === "https") return true
  
  // AWS ELB
  const awsProto = req.headers["x-forwarded-protocol"]
  if (awsProto === "https") return true
  
  // Azure
  const azureProto = req.headers["x-arr-ssl"]
  if (azureProto) return true
  
  return false
}

/**
 * HTTPS Enforcement Middleware
 * Redirects HTTP requests to HTTPS in production
 */
export const httpsEnforcement = (req: Request, res: Response, next: NextFunction) => {
  const options = getSecurityOptions()
  
  // Skip if not enforcing HTTPS or already secure
  if (!options.enforceHttps || isSecureRequest(req)) {
    return next()
  }
  
  // Skip for localhost/development testing (production mode but local environment)
  const host = req.hostname || req.headers.host || ""
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return next()
  }
  
  // Skip for health check endpoints (allow monitoring tools)
  if (req.path === "/health" || req.path.includes("/health") || req.path.includes("/live") || req.path.includes("/ready")) {
    return next()
  }
  
  // Redirect to HTTPS
  const httpsUrl = `https://${req.hostname}${req.originalUrl}`
  return res.redirect(301, httpsUrl)
}

/**
 * Security Headers Middleware
 * Sets comprehensive security headers including HSTS, CSP, and others
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  const options = getSecurityOptions()
  
  if (!options.enableSecurityHeaders) {
    return next()
  }
  
  // HSTS - Strict Transport Security
  // Only set on HTTPS responses to avoid issues with HTTP-only development
  if (isSecureRequest(req) || process.env.NODE_ENV === "production") {
    let hstsValue = `max-age=${options.hstsMaxAge}`
    if (options.includeSubDomains) {
      hstsValue += "; includeSubDomains"
    }
    if (options.preload) {
      hstsValue += "; preload"
    }
    res.setHeader("Strict-Transport-Security", hstsValue)
  }
  
  // X-Content-Type-Options - Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff")
  
  // X-Frame-Options - Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY")
  
  // X-XSS-Protection - Enable XSS filtering (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block")
  
  // Referrer-Policy - Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  
  // Permissions-Policy - Disable unnecessary browser features
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  )
  
  // X-DNS-Prefetch-Control - Disable DNS prefetching
  res.setHeader("X-DNS-Prefetch-Control", "off")
  
  // X-Download-Options - Prevent IE from executing downloads
  res.setHeader("X-Download-Options", "noopen")
  
  // X-Permitted-Cross-Domain-Policies - Restrict Adobe Flash/PDF
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none")
  
  next()
}

/**
 * Content Security Policy Middleware
 * Configurable CSP for API responses
 */
export const contentSecurityPolicy = (req: Request, res: Response, next: NextFunction) => {
  const options = getSecurityOptions()
  
  if (!options.enableSecurityHeaders) {
    return next()
  }
  
  // CSP for API - restrictive by default
  // Can be customized via environment variable if needed
  const cspDirectives = process.env.CSP_DIRECTIVES || [
    "default-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ")
  
  res.setHeader("Content-Security-Policy", cspDirectives)
  
  next()
}

/**
 * Combined security middleware for convenience
 * Applies HTTPS enforcement, security headers, and CSP
 */
export const applySecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  httpsEnforcement(req, res, (err?: any) => {
    if (err) return next(err)
    if (res.headersSent) return // Redirect happened
    
    securityHeaders(req, res, (err?: any) => {
      if (err) return next(err)
      contentSecurityPolicy(req, res, next)
    })
  })
}

export default applySecurityMiddleware
