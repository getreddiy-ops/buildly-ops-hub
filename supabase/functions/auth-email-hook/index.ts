import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { authEmailsFromHook, hookSecret } from '../_shared/auth-email.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirm your email',
  invite: "You've been invited",
  magiclink: 'Your login link',
  recovery: 'Reset your password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your verification code',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

const SITE_NAME = 'FastTract'
// Sender and links come from configuration so the domain can move without a code change.
const SITE_URL = (Deno.env.get('PUBLIC_APP_URL') || 'https://fasttract.org').replace(/\/$/, '')
const FROM_ADDRESS = Deno.env.get('RESEND_FROM_EMAIL') || `${SITE_NAME} <noreply@fasttract.org>`

const SAMPLE_PROJECT_URL = SITE_URL
const SAMPLE_EMAIL = 'user@example.test'
const SAMPLE_DATA: Record<string, object> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  magiclink: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  recovery: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  invite: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, confirmationUrl: SAMPLE_PROJECT_URL },
  email_change: {
    siteName: SITE_NAME,
    oldEmail: SAMPLE_EMAIL,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: { token: '123456' },
}

async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: previewCorsHeaders })

  // Template previews are for FastTract staff: gated by a dedicated secret, never the service key.
  const apiKey = Deno.env.get('EMAIL_PREVIEW_SECRET')
  if (!apiKey || req.headers.get('Authorization') !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type = ''
  try {
    type = (await req.json()).type
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]
  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const html = await renderAsync(React.createElement(EmailTemplate, SAMPLE_DATA[type] || {}))
  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

async function dispatchEmailQueue(supabaseUrl: string, serviceRole: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/process-email-queue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRole}`,
        apikey: serviceRole,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    const raw = await response.text()
    if (!response.ok) {
      console.warn('Auth email queued but dispatcher returned an error', response.status, raw)
      return false
    }
    return true
  } catch (error) {
    console.warn('Auth email queued but dispatcher could not be started', error)
    return false
  }
}

function hookError(status: number, message: string): Response {
  // Supabase Auth reads { error: { http_code, message } } from a failed hook.
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function handleWebhook(req: Request): Promise<Response> {
  const hookSecretRaw = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!hookSecretRaw || !supabaseUrl || !serviceRole) {
    console.error('Missing required auth-email configuration')
    return hookError(500, 'Server configuration error')
  }

  const rawBody = await req.text()
  let payload: any
  try {
    payload = new Webhook(hookSecret(hookSecretRaw)).verify(rawBody, Object.fromEntries(req.headers))
  } catch (error) {
    console.error('Send-email hook signature check failed', error)
    return hookError(401, 'Invalid signature')
  }

  let emails
  try {
    emails = authEmailsFromHook(payload, supabaseUrl)
  } catch (error) {
    return hookError(400, error instanceof Error ? error.message : 'Invalid webhook payload')
  }

  const supabase = createClient(supabaseUrl, serviceRole)
  for (const mail of emails) {
    const EmailTemplate = EMAIL_TEMPLATES[mail.type]
    const templateProps = {
      siteName: SITE_NAME,
      siteUrl: SITE_URL,
      recipient: mail.to,
      confirmationUrl: mail.confirmationUrl,
      token: mail.token,
      email: mail.to,
      oldEmail: mail.oldEmail,
      newEmail: mail.newEmail,
    }
    const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
    const text = await renderAsync(React.createElement(EmailTemplate, templateProps), { plainText: true })
    const messageId = crypto.randomUUID()

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: mail.type,
      recipient_email: mail.to,
      status: 'pending',
    })

    const { error: enqueueError } = await supabase.rpc('enqueue_email', {
      queue_name: 'auth_emails',
      payload: {
        message_id: messageId,
        to: mail.to,
        from: FROM_ADDRESS,
        subject: EMAIL_SUBJECTS[mail.type] || 'Notification',
        html,
        text,
        purpose: 'transactional',
        label: mail.type,
        idempotency_key: `auth-${messageId}`,
        queued_at: new Date().toISOString(),
      },
    })

    if (enqueueError) {
      console.error('Failed to enqueue auth email', { enqueueError, type: mail.type })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: mail.type,
        recipient_email: mail.to,
        status: 'failed',
        error_message: 'Failed to enqueue email',
      })
      return hookError(500, 'Failed to enqueue email')
    }
  }

  const dispatched = await dispatchEmailQueue(supabaseUrl, serviceRole)
  console.log('Auth email queued', { types: emails.map((m) => m.type), dispatched })
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (url.pathname.endsWith('/preview')) return handlePreview(req)

  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
