import type { NextConfig } from "next"
import { config } from "dotenv"
import { resolve } from "path"

// Load .env from monorepo root so NEXT_PUBLIC_* vars are available
config({ path: resolve(__dirname, "../../.env") })

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_ENABLE_EMAIL_SERVICE: process.env.NEXT_PUBLIC_ENABLE_EMAIL_SERVICE || "false",
  },
}

export default nextConfig
