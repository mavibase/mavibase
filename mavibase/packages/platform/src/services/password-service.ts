import * as argon2 from "argon2"

export const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password)
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

export const validatePasswordStrength = (password: string): boolean => {
  const minLength = 8
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumber
}
