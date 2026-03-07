import type { Request } from "express"

/**
 * Extracts the real client IP address from a request, considering various proxy headers
 * Returns the first valid IP address found, or falls back to req.ip
 */
export function getClientIp(req: Request): string {
  // Check common proxy headers in order of preference
  const forwarded = req.headers["x-forwarded-for"]
  const realIp = req.headers["x-real-ip"]
  const cfConnectingIp = req.headers["cf-connecting-ip"] // Cloudflare
  const trueClientIp = req.headers["true-client-ip"] // Cloudflare Enterprise

  // Cloudflare headers take priority if present
  if (typeof cfConnectingIp === "string") {
    return cfConnectingIp.trim()
  }

  if (typeof trueClientIp === "string") {
    return trueClientIp.trim()
  }

  // X-Real-IP is typically set by nginx
  if (typeof realIp === "string") {
    return realIp.trim()
  }

  // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2, ...)
  // The first IP is the original client
  if (typeof forwarded === "string") {
    const ips = forwarded.split(",").map((ip) => ip.trim())
    if (ips.length > 0 && ips[0]) {
      return ips[0]
    }
  }

  // Fallback to Express's req.ip
  // Convert IPv6 localhost to IPv4 for consistency
  const ip = req.ip || "unknown"
  return ip === "::1" ? "127.0.0.1" : ip
}
