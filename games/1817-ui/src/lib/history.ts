import { isFormCompany, type CashPayment } from '@tabletop/18xx'
import {
    describeSizedCompanyAction,
    joinDetails,
    type HistoryDescription,
    type HistoryNames,
    type MoneyFormat
} from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'
import {
    EighteenSeventeenLoanRules,
    EighteenSeventeenMap,
    LoanSharkCash,
    LoanSharkId
} from '@tabletop/1817'

/** 1817's own history rows, and the shared ones it adds to. */
export function eighteenSeventeenHistoryDescription(
    action: GameAction,
    names: HistoryNames & { poolName: (poolId: string) => string },
    money: MoneyFormat,
    shared: () => HistoryDescription
): HistoryDescription | undefined {
    const { companyName, playerName } = names
    if (isFormCompany(action) && action.privateIds.includes(LoanSharkId)) {
        const description = shared()
        return {
            ...description,
            detail: joinDetails(
                description.detail,
                `Loan Shark paid ${companyName(action.companyId)} ${money(LoanSharkCash)}`
            )
        }
    }
    return describeSizedCompanyAction(
        action,
        names,
        money,
        {
            poolName: names.poolName,
            place: (locationId) => EighteenSeventeenMap.location(locationId).name ?? locationId,
            loanValue: EighteenSeventeenLoanRules.value,
            salePayment: (payment: CashPayment) =>
                payment.to.kind === 'player'
                    ? `Golden Parachute paid ${playerName(payment.to.playerId)} ${money(payment.amount)}`
                    : undefined
        },
        shared
    )
}
