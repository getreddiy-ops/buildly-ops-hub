import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  companyName?: string
  inviterName?: string
  role?: string
  inviteUrl?: string
}

const Email = ({ companyName = 'your team', inviterName, role, inviteUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`You've been invited to join ${companyName} on FastTract`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Join {companyName} on FastTract</Heading>
        <Text style={text}>
          {inviterName ? `${inviterName} invited you` : 'You have been invited'} to join{' '}
          <strong>{companyName}</strong>
          {role ? ` as a ${role}` : ''} on FastTract — the app the crew uses to see jobs,
          clock in and out, and keep the office up to date.
        </Text>
        {inviteUrl && (
          <Section style={{ margin: '28px 0' }}>
            <Button href={inviteUrl} style={button}>Accept invitation</Button>
          </Section>
        )}
        <Text style={muted}>
          This link is personal to you. If you weren't expecting this invitation, you can ignore this email.
        </Text>
        <Hr style={hr} />
        <Text style={muted}>FastTract</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Props) => `You're invited to join ${data?.companyName ?? 'a team'} on FastTract`,
  displayName: 'Crew invitation',
  previewData: {
    companyName: 'Lynchmarc LLC',
    inviterName: 'Kevin',
    role: 'worker',
    inviteUrl: 'https://fasttract.org/signup?invite=example',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', lineHeight: '1.3', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '1.6', color: '#1f2937' }
const muted = { fontSize: '13px', lineHeight: '1.6', color: '#6b7280' }
const button = {
  backgroundColor: '#f97316',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '12px 22px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
}
const hr = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
