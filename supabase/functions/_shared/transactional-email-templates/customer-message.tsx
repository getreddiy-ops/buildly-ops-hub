import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

type Props = {
  companyName?: string
  customerName?: string
  subject?: string
  message?: string
}

const Email = ({ companyName = 'FastTract customer', customerName, subject = 'A message for you', message = '' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>{companyName}</Text>
        <Heading style={heading}>{subject}</Heading>
        {customerName ? <Text style={muted}>Hi {customerName},</Text> : null}
        <Text style={body}>{message}</Text>
        <Hr style={hr} />
        <Text style={muted}>Sent securely through FastTract.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => d?.subject || `Message from ${d?.companyName || 'FastTract'}`,
  displayName: 'Customer Message',
  previewData: {
    companyName: 'Sunrise Concrete Co.',
    customerName: 'Alex Johnson',
    subject: 'Schedule update',
    message: 'We are scheduled to arrive tomorrow morning between 8 and 9.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '28px 28px 40px', maxWidth: '620px' }
const eyebrow = { fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8a8a8a', margin: '0 0 6px' }
const heading = { fontSize: '24px', margin: '0 0 18px', fontWeight: 700, color: '#222222' }
const body = { fontSize: '15px', lineHeight: '1.6', color: '#333333', whiteSpace: 'pre-wrap' as const }
const muted = { fontSize: '13px', color: '#6b6b6b' }
const hr = { borderTop: '1px solid #eeeeee', margin: '24px 0' }
