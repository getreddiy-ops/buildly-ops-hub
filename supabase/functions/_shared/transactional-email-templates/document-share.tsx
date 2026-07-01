import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Row, Column, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface LineItem { description: string; quantity: number; unit_price: number; total: number }
interface Props {
  docType?: 'estimate' | 'invoice'
  docNumber?: string
  title?: string
  companyName?: string
  companyPhone?: string
  companyEmail?: string
  customerName?: string
  message?: string
  lineItems?: LineItem[]
  subtotal?: number
  taxAmount?: number
  total?: number
  dueDate?: string
  terms?: string
  notes?: string
  brandColor?: string
}

const money = (n?: number) =>
  typeof n === 'number' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—'

const Email = (props: Props) => {
  const {
    docType = 'invoice',
    docNumber,
    title,
    companyName = 'Your contractor',
    companyPhone,
    companyEmail,
    customerName,
    message,
    lineItems = [],
    subtotal,
    taxAmount,
    total,
    dueDate,
    terms,
    notes,
    brandColor = '#d9531e',
  } = props
  const label = docType === 'estimate' ? 'Estimate' : 'Invoice'
  const heading = title || `${label}${docNumber ? ` ${docNumber}` : ''}`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${label} from ${companyName}${total ? ` — ${money(total)}` : ''}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={eyebrow}>{companyName}</Text>
            <Heading style={{ ...h1, color: brandColor }}>{heading}</Heading>
            {customerName && <Text style={muted}>Prepared for {customerName}</Text>}
          </Section>

          {message && (
            <Section style={messageBox}>
              <Text style={messageText}>{message}</Text>
            </Section>
          )}

          {lineItems.length > 0 && (
            <Section style={{ marginTop: '20px' }}>
              <Row style={theadRow}>
                <Column style={{ ...th, width: '58%' }}>Description</Column>
                <Column style={{ ...th, width: '12%', textAlign: 'right' }}>Qty</Column>
                <Column style={{ ...th, width: '15%', textAlign: 'right' }}>Price</Column>
                <Column style={{ ...th, width: '15%', textAlign: 'right' }}>Total</Column>
              </Row>
              {lineItems.map((li, i) => (
                <Row key={i} style={tbodyRow}>
                  <Column style={{ ...td, width: '58%' }}>{li.description}</Column>
                  <Column style={{ ...td, width: '12%', textAlign: 'right' }}>{li.quantity}</Column>
                  <Column style={{ ...td, width: '15%', textAlign: 'right' }}>{money(li.unit_price)}</Column>
                  <Column style={{ ...td, width: '15%', textAlign: 'right' }}>{money(li.total)}</Column>
                </Row>
              ))}
              <Hr style={hr} />
              <Row>
                <Column style={{ width: '70%' }}></Column>
                <Column style={totalsCol}>
                  <Text style={totalsLine}><span style={totalsLabel}>Subtotal</span> {money(subtotal)}</Text>
                  {taxAmount ? <Text style={totalsLine}><span style={totalsLabel}>Tax</span> {money(taxAmount)}</Text> : null}
                  <Text style={{ ...totalsLine, color: brandColor, fontWeight: 700, fontSize: '16px' }}>
                    <span style={totalsLabel}>Total</span> {money(total)}
                  </Text>
                </Column>
              </Row>
            </Section>
          )}

          {dueDate && (
            <Text style={{ ...muted, marginTop: '16px' }}>Payment due: <strong>{dueDate}</strong></Text>
          )}

          {notes && (
            <Section style={{ marginTop: '18px' }}>
              <Text style={sectionTitle}>Notes</Text>
              <Text style={body}>{notes}</Text>
            </Section>
          )}
          {terms && (
            <Section style={{ marginTop: '10px' }}>
              <Text style={sectionTitle}>Terms</Text>
              <Text style={body}>{terms}</Text>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={muted}>
            Questions? Reply to this email
            {companyPhone ? <> or call <Link href={`tel:${companyPhone}`} style={{ color: brandColor }}>{companyPhone}</Link></> : null}
            {companyEmail ? <> · <Link href={`mailto:${companyEmail}`} style={{ color: brandColor }}>{companyEmail}</Link></> : null}
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => {
    const label = d?.docType === 'estimate' ? 'Estimate' : 'Invoice'
    const num = d?.docNumber ? ` ${d.docNumber}` : ''
    const from = d?.companyName ? ` from ${d.companyName}` : ''
    return `${label}${num}${from}`
  },
  displayName: 'Estimate / Invoice Share',
  previewData: {
    docType: 'invoice',
    docNumber: 'INV-000123',
    companyName: 'Sunrise Concrete Co.',
    customerName: 'Alex Johnson',
    message: 'Thanks for your business — full breakdown attached below.',
    lineItems: [
      { description: '20x30 concrete slab', quantity: 1, unit_price: 4200, total: 4200 },
      { description: 'Rebar #4 grid', quantity: 32, unit_price: 12.5, total: 400 },
    ],
    subtotal: 4600,
    taxAmount: 368,
    total: 4968,
    dueDate: '2026-08-01',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '28px 28px 40px', maxWidth: '620px' }
const eyebrow = { fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8a8a8a', margin: '0 0 6px' }
const h1 = { fontSize: '26px', margin: '0 0 6px', fontWeight: 700 }
const muted = { fontSize: '13px', color: '#6b6b6b', margin: '0 0 4px' }
const messageBox = { background: '#fff7f0', border: '1px solid #f2d4bd', borderRadius: '8px', padding: '14px 16px', margin: '18px 0 4px' }
const messageText = { fontSize: '14px', color: '#3d2a1a', margin: 0, whiteSpace: 'pre-wrap' as const }
const theadRow = { borderBottom: '1px solid #e6e6e6' }
const th = { fontSize: '11px', color: '#8a8a8a', textTransform: 'uppercase' as const, letterSpacing: '0.06em', padding: '8px 4px' }
const tbodyRow = { borderBottom: '1px solid #f2f2f2' }
const td = { fontSize: '13px', color: '#222', padding: '10px 4px', verticalAlign: 'top' as const }
const totalsCol = { width: '30%', padding: '10px 4px' }
const totalsLine = { fontSize: '13px', color: '#333', margin: '2px 0', display: 'flex', justifyContent: 'space-between' as const }
const totalsLabel = { color: '#8a8a8a', marginRight: '12px' }
const hr = { borderTop: '1px solid #eee', margin: '22px 0' }
const sectionTitle = { fontSize: '12px', color: '#8a8a8a', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }
const body = { fontSize: '13px', color: '#333', margin: 0, whiteSpace: 'pre-wrap' as const }
