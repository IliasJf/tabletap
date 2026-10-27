declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** Resend API key for sign-in emails (a secret, never committed). */
    RESEND_API_KEY?: string;
    /** Verified sender, e.g. "TableTap <login@your-domain.com>". */
    EMAIL_FROM?: string;
  }
}
