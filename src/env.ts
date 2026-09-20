import 'server-only';

/**
 * Server-side configuration. No secret is ever hard-coded; everything comes
 * from the environment. See `.env.example` for the full list.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  get databaseUrl(): string {
    return required('DATABASE_URL');
  },
  get sessionSecret(): string {
    const secret = required('SESSION_SECRET');
    if (secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters.');
    }
    return secret;
  },
  get allowedEmailDomain(): string {
    return (process.env.ALLOWED_EMAIL_DOMAIN ?? '@vodafone.com').toLowerCase();
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  },
};
