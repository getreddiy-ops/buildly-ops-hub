// Pure helpers for FastTract's own email stack (Supabase Auth "Send Email" hook + Resend).
// No Deno or npm imports here, so the same file is unit-tested with vitest.

export const AUTH_EMAIL_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'reauthentication'] as const
export type AuthEmailType = (typeof AUTH_EMAIL_TYPES)[number]

export interface SupabaseSendEmailHookPayload {
  user: { email?: string; new_email?: string }
  email_data: {
    token?: string
    token_hash?: string
    redirect_to?: string
    email_action_type?: string
    site_url?: string
    token_new?: string
    token_hash_new?: string
  }
}

export interface AuthEmailToSend {
  to: string
  type: AuthEmailType
  confirmationUrl: string
  token?: string
  oldEmail?: string
  newEmail?: string
}

export function verifyUrl(supabaseUrl: string, tokenHash: string, type: string, redirectTo?: string): string {
  const url = new URL('/auth/v1/verify', supabaseUrl)
  url.searchParams.set('token', tokenHash)
  url.searchParams.set('type', type)
  if (redirectTo) url.searchParams.set('redirect_to', redirectTo)
  return url.toString()
}

/**
 * Turns one Supabase Send Email hook call into the emails to send.
 * Secure email change sends two: Supabase pairs `token_hash_new` with the CURRENT
 * address and `token_hash` with the NEW address (the field names read backwards).
 */
export function authEmailsFromHook(payload: SupabaseSendEmailHookPayload, supabaseUrl: string): AuthEmailToSend[] {
  const action = String(payload?.email_data?.email_action_type || '')
  const data = payload?.email_data || {}
  const email = String(payload?.user?.email || '')
  const newEmail = payload?.user?.new_email ? String(payload.user.new_email) : undefined
  if (!email) throw new Error('Hook payload has no user email')

  if (action === 'email_change' || action === 'email_change_new') {
    const out: AuthEmailToSend[] = []
    if (data.token_hash_new) {
      out.push({ to: email, type: 'email_change', confirmationUrl: verifyUrl(supabaseUrl, data.token_hash_new, 'email_change', data.redirect_to), token: data.token_new, oldEmail: email, newEmail })
    }
    if (data.token_hash && newEmail) {
      out.push({ to: newEmail, type: 'email_change', confirmationUrl: verifyUrl(supabaseUrl, data.token_hash, 'email_change', data.redirect_to), token: data.token, oldEmail: email, newEmail })
    }
    if (!out.length) throw new Error('Email change hook payload has no token hash')
    return out
  }

  if (!(AUTH_EMAIL_TYPES as readonly string[]).includes(action)) throw new Error(`Unknown email type: ${action}`)
  const type = action as AuthEmailType
  if (type === 'reauthentication') {
    if (!data.token) throw new Error('Reauthentication hook payload has no token')
    return [{ to: email, type, confirmationUrl: '', token: data.token }]
  }
  if (!data.token_hash) throw new Error('Hook payload has no token hash')
  return [{ to: email, type, confirmationUrl: verifyUrl(supabaseUrl, data.token_hash, type, data.redirect_to), token: data.token }]
}

/** Resend webhook events that should stop future sends to an address. */
export function suppressionFromResendEvent(event: unknown): { email: string; reason: 'bounce' | 'complaint' } | null {
  const e = event as { type?: string; data?: { to?: string[] | string; bounce?: { type?: string } } }
  const to = Array.isArray(e?.data?.to) ? e.data.to[0] : e?.data?.to
  if (!to) return null
  if (e.type === 'email.complained') return { email: to.toLowerCase(), reason: 'complaint' }
  if (e.type === 'email.bounced') {
    // Only permanent bounces suppress; a full mailbox or a temporary failure should retry later.
    const kind = String(e.data?.bounce?.type || 'Permanent').toLowerCase()
    return kind === 'permanent' ? { email: to.toLowerCase(), reason: 'bounce' } : null
  }
  return null
}

/** Supabase stores hook secrets as "v1,whsec_<base64>"; standardwebhooks wants the "whsec_" part. */
export function hookSecret(raw: string): string {
  return raw.replace(/^v1,/, '')
}
