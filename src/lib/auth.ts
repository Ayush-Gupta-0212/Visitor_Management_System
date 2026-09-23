/*
 * Password checking for the demo sign-in. Accounts store only a salted SHA-256
 * hash (the email is the salt, so two people with the same password still get
 * different hashes); the password itself is never stored.
 *
 * With no backend, this check runs in the browser and stands in for the server.
 * Production would verify on the server with a slow hash such as Argon2 or
 * bcrypt, or hand sign-in to the company's identity provider (SSO).
 */

/** Hex SHA-256 of `email:password`. Needs Web Crypto, i.e. https:// or localhost. */
export async function hashPassword(email: string, password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${email.trim().toLowerCase()}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
