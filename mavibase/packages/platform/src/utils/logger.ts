const log = (level: string, message: string, meta?: any) => {
  const timestamp = new Date().toISOString()
  console.log(JSON.stringify({ timestamp, level, message, ...meta }))
}

export const logger = {
  info: (message: string, meta?: any) => log("INFO", message, meta),
  error: (message: string, meta?: any) => log("ERROR", message, meta),
  warn: (message: string, meta?: any) => log("WARN", message, meta),
  debug: (message: string, meta?: any) => log("DEBUG", message, meta),
}
