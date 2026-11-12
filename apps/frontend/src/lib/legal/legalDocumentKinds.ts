export const LEGAL_DOCUMENT_KINDS = ['privacy', 'terms'] as const

export type LegalDocumentKind = (typeof LEGAL_DOCUMENT_KINDS)[number]

export const LEGAL_DOCUMENT_NAMES: Record<
    LegalDocumentKind,
    { title: string; unpublished: string }
> = {
    privacy: { title: 'Privacy Policy', unpublished: 'a privacy policy' },
    terms: { title: 'Terms of Service', unpublished: 'terms of service' }
}
