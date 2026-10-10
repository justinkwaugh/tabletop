import { EighteenSeventeenLoanRules } from '@tabletop/1817'
import type { CardAction } from '@tabletop/18xx-ui'
import type { EighteenSeventeenSession } from './session.svelte.js'

/** Borrowing for a company, as each round's card offers it. */
export function takeLoanAction(
    session: EighteenSeventeenSession,
    companyId: string,
    ariaLabel: string,
    disabled: boolean
): CardAction {
    return {
        label: 'Take a loan',
        detail: `+${session.presentation.money(EighteenSeventeenLoanRules.value)}`,
        ariaLabel,
        disabled,
        onclick: () => session.loans.take(companyId)
    }
}
