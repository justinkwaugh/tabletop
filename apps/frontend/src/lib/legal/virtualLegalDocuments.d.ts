declare module 'virtual:legal-documents' {
    import type { LegalDocumentKind } from '$lib/legal/legalDocumentKinds.js'

    const documents: Partial<Record<LegalDocumentKind, string>>
    export default documents
}
