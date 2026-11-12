import type { CertificateLimitChange } from '@tabletop/18xx'
import type { HistoryBankBreak } from './historyStates.js'

/** A table-wide event called out under the action that caused it. */
export type HistoryCallout = {
    kind: 'bank-broken' | 'certificate-limit'
    title: string
    text?: string
}

export function bankBreakCallout(bankBreak: HistoryBankBreak): HistoryCallout {
    return {
        kind: 'bank-broken',
        title: 'The bank is broken',
        ...(bankBreak.ending
            ? {
                  text: `The game ends after ${
                      bankBreak.ending.lastRound
                          ? `operating round ${bankBreak.ending.lastRound}`
                          : 'the next set of operating rounds'
                  }.`
              }
            : {})
    }
}

export function certificateLimitCallout(change: CertificateLimitChange): HistoryCallout {
    return {
        kind: 'certificate-limit',
        title: 'Certificate limit drops',
        text: `From ${change.from} to ${change.to} certificates per player.`
    }
}
