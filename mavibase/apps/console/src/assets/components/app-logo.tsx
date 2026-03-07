import Image from "next/image"
import shortLogo from "../minimized-logo.png"
import longLogo from "../full-logo.png"

interface AppLogoProps {
  type?: "long" | "short"
  width?: number
  height?: number
  className?: string
  priority?: boolean
}

export default function AppLogo({
  type = "long",
  width,
  height,
  className,
  priority = false,
}: AppLogoProps) {
  const isShort = type === "short"

  return (
    <Image
      src={isShort ? shortLogo : longLogo}
      alt="App Logo"
      width={width ?? (isShort ? 40 : 140)}
      height={height ?? 40}
      className={`dark:brightness-0 dark:invert${className ? ` ${className}` : ""}`}
      priority={priority}
    />
  )
}
