import type { BridgeLeasePayer } from '@tabletop/18royalgorge'

/** How the lease's payer is named: on its button, and in the history afterwards. */
export const BridgeLeasePayerWords: Readonly<
    Record<BridgeLeasePayer, { pays: string; paidFrom: string }>
> = {
    company: { pays: 'Treasury pays', paidFrom: 'From its treasury' },
    president: { pays: 'President pays', paidFrom: 'From its president' }
}
