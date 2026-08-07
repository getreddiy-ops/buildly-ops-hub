import type { ComponentType, ReactElement } from 'npm:react@18.3.1'
import { template as documentShare } from './document-share.tsx'
import { template as crewInvite } from './crew-invite.tsx'

export interface TemplateEntry {
  component: ComponentType<any> | ((props: any) => ReactElement)
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'document-share': documentShare,
  'crew-invite': crewInvite,
}
