import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? ''
const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY') ?? ''
const TWILIO_GATEWAY = 'https://connector-gateway.lovable.dev/twilio'
const PUBLIC_APP_URL = Deno.env.get('FASTTRACT_APP_URL') || Deno.env.get('PUBLIC_APP_URL') || 'https://fasttract-app.vercel.app'

function money(n: number | string | null | undefined) {
  const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0)
  return (v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

async function sendTwilioMessage(to: string, from: string, body: string) {
  const params = new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1500) })

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      },
    )
    const raw = await response.text()
    const data = raw ? JSON.parse(raw) : {}
    if (!response.ok) throw new Error(data?.message || `Twilio ${response.status}`)
    return data
  }

  // Temporary compatibility while existing Twilio credentials are moved into
  // FastTract's Supabase secrets. No GHL dependency is involved.
  if (LOVABLE_API_KEY && TWILIO_API_KEY) {
    const response = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
    const raw = await response.text()
    const data = raw ? JSON.parse(raw) : {}
    if (!response.ok) throw new Error(data?.message || `Twilio ${response.status}`)
    return data
  }

  throw new Error('Twilio is not configured for FastTract yet')
}

async function dispatchEmailQueue() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/process-email-queue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  const raw = await response.text()
  if (!response.ok) {
    console.warn('Document email queued but dispatcher failed', response.status, raw)
    return { ok: false, status: response.status }
  }
  try {
    return { ok: true, result: raw ? JSON.parse(raw) : {} }
  } catch {
    return { ok: true }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const asUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: userRes } = await asUser.auth.getUser()
    const user = userRes?.user
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const {
      docType,
      docId,
      channel = 'email',
      to_email,
      to_phone,
      message,
      from_number,
    } = body as {
      docType: 'estimate' | 'invoice'
      docId: string
      channel: 'email' | 'sms' | 'both'
      to_email?: string
      to_phone?: string
      message?: string
      from_number?: string
    }

    if (!docType || !docId || !['estimate', 'invoice'].includes(docType)) {
      return json({ error: 'docType and docId are required' }, 400)
    }
    if (!['email', 'sms', 'both'].includes(channel)) return json({ error: 'invalid channel' }, 400)
    if ((channel === 'email' || channel === 'both') && !to_email) return json({ error: 'to_email required' }, 400)
    if ((channel === 'sms' || channel === 'both') && !to_phone) return json({ error: 'to_phone required' }, 400)

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE)
    const table = docType === 'estimate' ? 'estimates' : 'invoices'
    const liTable = docType === 'estimate' ? 'estimate_line_items' : 'invoice_line_items'
    const fk = docType === 'estimate' ? 'estimate_id' : 'invoice_id'

    const { data: doc, error: docErr } = await svc
      .from(table)
      .select('*, customers(name,email,phone,address), organizations:organization_id(id,name,email,phone,brand_color)')
      .eq('id', docId)
      .maybeSingle()
    if (docErr || !doc) return json({ error: 'Document not found' }, 404)

    const { data: member } = await svc
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', doc.organization_id)
      .maybeSingle()
    if (!member) return json({ error: 'Forbidden' }, 403)

    const { data: items } = await svc
      .from(liTable)
      .select('description, quantity, unit_price, total')
      .eq(fk, docId)
      .order('position')

    const org = (doc as any).organizations || {}
    const cust = (doc as any).customers || {}
    const docNumber = docType === 'invoice'
      ? (doc as any).number
      : `EST-${String(doc.id).slice(0, 6).toUpperCase()}`

    const templateData = {
      docType,
      docNumber,
      title: (doc as any).title || undefined,
      companyName: org.name,
      companyPhone: org.phone,
      companyEmail: org.email,
      customerName: cust.name,
      message,
      lineItems: (items || []).map((li: any) => ({
        description: li.description,
        quantity: Number(li.quantity),
        unit_price: Number(li.unit_price),
        total: Number(li.total),
      })),
      subtotal: Number((doc as any).subtotal || 0),
      taxAmount: Number((doc as any).tax_amount ?? (doc as any).tax ?? 0),
      total: Number((doc as any).total || 0),
      dueDate: (doc as any).due_date || undefined,
      terms: (doc as any).terms || undefined,
      notes: (doc as any).notes || undefined,
      brandColor: org.brand_color || undefined,
      shareUrl: docType === 'estimate' && (doc as any).share_token
        ? `${PUBLIC_APP_URL}/e/${(doc as any).share_token}`
        : undefined,
    }

    const results: Record<string, any> = {}

    if (channel === 'email' || channel === 'both') {
      const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE}`,
          apikey: SERVICE_ROLE,
        },
        body: JSON.stringify({
          templateName: 'document-share',
          recipientEmail: to_email,
          idempotencyKey: `${docType}-${docId}-${Date.now()}`,
          templateData,
        }),
      })
      const emailJson = await emailRes.json().catch(() => ({}))
      const dispatch = emailRes.ok ? await dispatchEmailQueue() : { ok: false }
      results.email = { ok: emailRes.ok, ...emailJson, dispatched: dispatch.ok }
      if (!emailRes.ok) console.error('email send failed', emailJson)
    }

    if (channel === 'sms' || channel === 'both') {
      const label = docType === 'estimate' ? 'Estimate' : 'Invoice'
      const smsBody =
        `${label}${docNumber ? ` ${docNumber}` : ''} from ${org.name || 'us'}: ` +
        `${money(templateData.total)}` +
        (templateData.dueDate ? ` (due ${templateData.dueDate})` : '') +
        (message ? `\n${message}` : '') +
        (templateData.shareUrl ? `\nReview & accept: ${templateData.shareUrl}` : '') +
        (org.email ? `\nReply or email ${org.email}` : '')

      let sender = from_number || ''
      if (!sender) {
        const { data: phoneAssistant } = await svc
          .from('phone_assistants')
          .select('twilio_phone_number')
          .eq('organization_id', doc.organization_id)
          .eq('enabled', true)
          .not('twilio_phone_number', 'is', null)
          .limit(1)
          .maybeSingle()
        sender = phoneAssistant?.twilio_phone_number || ''
      }

      if (!sender) {
        results.sms = { ok: false, error: 'Configure a FastTract phone number before sending document texts' }
      } else {
        try {
          const sent = await sendTwilioMessage(to_phone!, sender, smsBody)
          results.sms = { ok: true, sid: sent?.sid ?? null, status: sent?.status ?? 'queued' }
          await svc.from('communication_messages').insert({
            organization_id: doc.organization_id,
            customer_id: (doc as any).customer_id ?? null,
            sent_by: user.id,
            channel: 'sms',
            direction: 'outbound',
            recipient: to_phone,
            sender,
            body: smsBody,
            provider: 'twilio',
            provider_id: sent?.sid ?? null,
            status: sent?.status ?? 'queued',
            metadata: { document_type: docType, document_id: docId },
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          results.sms = { ok: false, error: errorMessage }
          console.error('sms send failed', error)
        }
      }
    }

    const anyOk = Boolean(results.email?.ok || results.sms?.ok)
    if (anyOk && (doc as any).status === 'draft') {
      await svc.from(table).update({ status: 'sent' }).eq('id', docId)
    }

    return json({ success: anyOk, results })
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
