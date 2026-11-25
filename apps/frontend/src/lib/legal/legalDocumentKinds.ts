export const LEGAL_DOCUMENT_KINDS = ['privacy', 'terms'] as const

export type LegalDocumentKind = (typeof LEGAL_DOCUMENT_KINDS)[number]
