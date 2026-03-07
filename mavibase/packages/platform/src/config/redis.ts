import { createClient } from "redis"
import { logger } from "../utils/logger"

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  logger.warn("REDIS_URL not found in environment variables, using default: redis://localhost:6379")
}

export const redisClient = createClient({
  url: redisUrl || "redis://localhost:6379",
})

redisClient.on("error", (err) => {
  logger.error("Redis Client Error", err)
})

redisClient.on("connect", () => {
  logger.info("Redis connected successfully")
})

redisClient.on("reconnecting", () => {
  logger.info("Redis reconnecting...")
})

export const connectRedis = async () => {
  try {
    if (redisClient.isOpen) {
      logger.info("Redis already connected")
      return true
    }
    await redisClient.connect()
    return true
  } catch (error) {
    logger.error("Redis connection failed", error)
    return false
  }
}

export { redisClient as redis }
