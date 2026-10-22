import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison that tolerates different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) {
    timingSafeEqual(x, x);
    return false;
  }
  return timingSafeEqual(x, y);
}

/**
 * Outbound webhook signature: hex HMAC-SHA256 over `<timestamp>.<body>` with the shared secret,
 * sent as `X-Lobby-Signature: sha256=<hex>` next to `X-Lobby-Timestamp: <unix seconds>`.
 */
export function signWebhook(secret: string, timestamp: number, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/** For receivers: checks the signature and refuses timestamps older than `toleranceSeconds`. */
export function verifyWebhookSignature(
  secret: string,
  header: { signature: string | null; timestamp: string | null },
  body: string,
  now = Date.now(),
  toleranceSeconds = 300,
): boolean {
  const ts = Number(header.timestamp);
  if (!header.signature || !Number.isFinite(ts)) return false;
  if (Math.abs(now / 1000 - ts) > toleranceSeconds) return false;
  return safeEqual(header.signature, signWebhook(secret, ts, body));
}
