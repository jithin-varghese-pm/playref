/**
 * Turns the caller's IP address into a short one-way id, so the rate limit and
 * the one-vote-per-person rule work without ever storing an IP address.
 */
export async function clientIdFrom(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}|${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
