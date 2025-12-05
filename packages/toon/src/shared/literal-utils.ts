import { FALSE_LITERAL, NULL_LITERAL, TRUE_LITERAL } from '../constants'

export function isBooleanOrNullLiteral(token: string): boolean {
  return token === TRUE_LITERAL || token === FALSE_LITERAL || token === NULL_LITERAL
}

/**
 * Checks if a token represents a valid numeric literal.
 *
 * @remarks
 * Rejects numbers with leading zeros (except `"0"` itself or decimals like `"0.5"`).
 */
export function isNumericLiteral(token: string): boolean {
  if (!token)
    return false

  // Enforce JSON-like grammar with no forbidden leading zeros
  const numericPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i
  if (!numericPattern.test(token))
    return false

  const numericValue = Number(token)
  return !Number.isNaN(numericValue) && Number.isFinite(numericValue)
}
