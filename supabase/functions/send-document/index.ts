import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY')
const TWILIO_GATEWAY = 'https://connector-gateway.lovable.dev/twilio'

function money(n: number | string | null | undefined) {
  const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0)
  return (v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }
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

    // Load document + org + line items
    const table = docType === 'estimate' ? 'estimates' : 'invoices'
    const liTable = docType === 'estimate' ? 'estimate_line_items' : 'invoice_line_items'
    const fk = docType === 'estimate' ? 'estimate_id' : 'invoice_id'

    const { data: doc, error: docErr } = await svc
      .from(table).select('*, customers(name,email,phone,address), organizations:organization_id(id,name,email,phone,brand_color)')
      .eq('id', docId).maybeSingle()
    if (docErr || !doc) return json({ error: 'Document not found' }, 404)

    // Auth check: caller must be member of this org
    const { data: member } = await svc.from('organization_members')
      .select('id').eq('user_id', user.id).eq('organization_id', doc.organization_id).maybeSingle()
    if (!member) return json({ error: 'Forbidden' }, 403)

    // Resolve the state from the job/customer address and freeze the currently
    // approved rule before anything leaves FastTract. This fails closed.
    const { data: compliance, error: complianceError } = await svc.rpc('prepare_document_compliance', {
      p_document_type: docType,
      p_document_id: docId,
    })
    if (complianceError || !compliance) {
      return json({
        error: complianceError?.message || 'State compliance review is required before sending this document.',
        code: 'compliance_review_required',
      }, 409)
    }

    const { data: items } = await svc.from(liTable)
      .select('description, quantity, unit_price, total').eq(fk, docId).order('position')

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
      compliance,
      brandColor: org.brand_color || undefined,
    }

    const results: Record<string, any> = {}

    // EMAIL
    if (channel === 'email' || channel === 'both') {
      const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({
          templateName: 'document-share',
          recipientEmail: to_email,
          idempotencyKey: `${docType}-${docId}-${Date.now()}`,
          templateData,
        }),
      })
      const emailJson = await emailRes.json().catch(() => ({}))
      results.email = { ok: emailRes.ok, ...emailJson }
      if (!emailRes.ok) console.error('email send failed', emailJson)
    }

    // SMS
    if (channel === 'sms' || channel === 'both') {
      if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
        results.sms = { ok: false, error: 'Twilio not connected' }
      } else {
        const label = docType === 'estimate' ? 'Estimate' : 'Invoice'
        const smsBody =
          `${label}${docNumber ? ` ${docNumber}` : ''} from ${org.name || 'us'}: ` +
          `${money(templateData.total)}` +
          (templateData.dueDate ? ` (due ${templateData.dueDate})` : '') +
          (message ? `\n${message}` : '') +
          (org.email ? `\nReply or email ${org.email}` : '')

        // Look up first Twilio number if from_number not provided
        let sender = from_number
        if (!sender) {
          const numRes = await fetch(`${TWILIO_GATEWAY}/IncomingPhoneNumbers.json?PageSize=1`, {
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': TWILIO_API_KEY,
            },
          })
          const numJson = await numRes.json().catch(() => ({}))
          sender = numJson?.incoming_phone_numbers?.[0]?.phone_number
        }
        if (!sender) {
          results.sms = { ok: false, error: 'No Twilio sender number available' }
        } else {
          const smsRes = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': TWILIO_API_KEY,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ To: to_phone!, From: sender, Body: smsBody.slice(0, 1500) }),
          })
          const smsJson = await smsRes.json().catch(() => ({}))
          results.sms = { ok: smsRes.ok, sid: smsJson?.sid, error: smsRes.ok ? undefined : smsJson }
          if (!smsRes.ok) console.error('sms send failed', smsJson)
        }
      }
    }

    // Mark as sent if either channel succeeded and status is currently draft
    const anyOk = (results.email?.ok) || (results.sms?.ok)
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
