// Hash PHI (Protected Health Information) before storing in database.
// Uses SHA-256 via Web Crypto API (available in browsers and Node 18+).
// The hash preserves uniqueness for dedup while removing identifiable data.

/** Hash a string with SHA-256, returning a hex digest */
export async function hashPHI(value: string): Promise<string> {
  if (!value) return ''
  const encoder = new TextEncoder()
  const data = encoder.encode(value.trim().toLowerCase())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Batch-hash an array of strings, returning a Map of original → hash */
export async function batchHashPHI(values: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(values)]
  const hashes = await Promise.all(unique.map(v => hashPHI(v)))
  const map = new Map<string, string>()
  unique.forEach((v, i) => map.set(v, hashes[i]))
  return map
}
