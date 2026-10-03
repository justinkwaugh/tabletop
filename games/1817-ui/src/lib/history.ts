import { isFormCompany, type CashPayment, type DeparturePayment } from '@tabletop/18xx'
import {
    departurePaymentsDetail,
    joinDetails,
    type HistoryDescription,
    type HistoryNames,
    type MoneyFormat
} from '@tabletop/18xx-ui'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    EighteenSeventeenLoanRules,
    LoanSharkCash,
    LoanSharkId,
    isAcquireCompany,
    isBidToAcquire,
    isCloseCompanySale,
    isDeclineOffer,
    isFinishAcquisitionLoans,
    isOfferCompany,
    isOpenCompanySale,
    isPassOnCompany,
    isRepayAcquiredLoan,
    isSkipCompanySale,
    isBuyBackShares,
    isBuyConvertedShare,
    isBuyOwedStations,
    isCloseMarketShorts,
    isConvertCompany,
    isDiscardMergedTrain,
    isFinishConversionLoans,
    isLiquidateCompany,
    isMergeCompanies,
    isPassConvertedShares,
    isPassMerger,
    isRemoveStation,
    isShortShare
} from '@tabletop/1817'
import { plural } from './plural.js'

const reasons = {
    'no-train': 'it has no train',
    'unpaid-stations': 'it did not pay for its stations'
}

/** 1817's own history rows, and the shared ones it adds to. */
export function eighteenSeventeenHistoryDescription(
    action: GameAction,
    names: HistoryNames,
    money: MoneyFormat,
    shared: () => HistoryDescription
): HistoryDescription | undefined {
    const { companyName, playerName } = names
    const parachute = (payment: CashPayment | undefined) =>
        payment && payment.to.kind === 'player'
            ? `Golden Parachute paid ${playerName(payment.to.playerId)} ${money(payment.amount)}`
            : undefined
    const paid = (payments: readonly DeparturePayment[] = []) =>
        departurePaymentsDetail(payments, names, money)
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
    if (isLiquidateCompany(action))
        return {
            text: `${companyName(action.companyId)} liquidated: ${reasons[action.reason]}`,
            omitActor: true,
            important: true
        }
    if (isBuyOwedStations(action) && action.metadata)
        return {
            text: `${companyName(action.companyId)} bought ${plural(action.metadata.stations, 'station')}`,
            omitActor: true,
            value: money(action.metadata.payment.amount)
        }
    if (isBuyBackShares(action))
        return {
            text: `Bought back ${plural(action.certificateIds.length, `${companyName(action.companyId)} share`)}`,
            value: action.metadata ? money(action.metadata.payment.amount) : undefined
        }
    if (isShortShare(action))
        return {
            text: `Shorted ${companyName(action.companyId)}`,
            value: money(action.expectedPrice)
        }
    if (isConvertCompany(action) && action.metadata)
        return {
            text: `Converted ${companyName(action.companyId)} to ${action.metadata.shareCount} shares`,
            important: true
        }
    if (isMergeCompanies(action) && action.metadata)
        return {
            text: `Merged ${companyName(action.targetId)} into ${companyName(action.companyId)}`,
            value: money(action.metadata.price),
            important: true
        }
    if (isPassMerger(action) && action.source === ActionSource.User)
        return { text: `Passed with ${companyName(action.companyId)}`, routine: true }
    if (isBuyConvertedShare(action))
        return {
            text: `Bought a ${companyName(action.companyId)} share`,
            value: money(action.expectedPrice)
        }
    if (isPassConvertedShares(action) && action.source === ActionSource.User)
        return {
            text: `Bought no more ${companyName(action.companyId)} shares`,
            routine: true
        }
    if (isFinishConversionLoans(action) && action.metadata?.liquidation)
        return {
            text: `${companyName(action.companyId)} liquidated: it could not pay for its stations`,
            omitActor: true,
            important: true
        }
    if (isFinishConversionLoans(action) && action.metadata?.payment)
        return {
            text: `${companyName(action.companyId)} bought ${plural(action.metadata.stations, 'station')}`,
            omitActor: true,
            value: money(action.metadata.payment.amount)
        }
    if (isRemoveStation(action))
        return { text: `Removed a ${companyName(action.companyId)} station` }
    if (isDiscardMergedTrain(action))
        return {
            text: `Discarded a ${companyName(action.companyId)} train`,
            detail: paid(action.metadata?.departurePayments)
        }
    if (isOfferCompany(action)) return { text: `Offered ${companyName(action.companyId)} for sale` }
    if (isDeclineOffer(action)) return { text: `Kept ${companyName(action.companyId)}` }
    if (isOpenCompanySale(action) && action.metadata)
        return {
            text: `${companyName(action.companyId)} auctioned from the ${action.metadata.kind} zone`,
            omitActor: true,
            important: true
        }
    if (isSkipCompanySale(action) && action.reason === 'entered-zone')
        return {
            text: `${companyName(action.companyId)} entered a closing zone and sits out`,
            omitActor: true
        }
    if (isBidToAcquire(action))
        return {
            text: `Bid for ${companyName(action.companyId)}`,
            value: money(action.amount)
        }
    if (isPassOnCompany(action)) return { text: `Passed on ${companyName(action.companyId)}` }
    if (isCloseCompanySale(action))
        return {
            text: action.metadata
                ? `The bank liquidated ${companyName(action.companyId)}`
                : `${companyName(action.companyId)} was not sold`,
            omitActor: true,
            detail: joinDetails(
                paid(action.metadata?.departurePayments),
                parachute(action.metadata?.parachute)
            ),
            important: !!action.metadata
        }
    if (isAcquireCompany(action) && action.metadata)
        return {
            text: `${companyName(action.buyerId)} acquired ${companyName(action.companyId)}`,
            value: money(action.metadata.price),
            detail: parachute(action.metadata.parachute),
            important: true
        }
    if (isRepayAcquiredLoan(action))
        return {
            text: `Repaid a loan ${companyName(action.companyId)} took on`,
            value: money(EighteenSeventeenLoanRules.value)
        }
    if (isFinishAcquisitionLoans(action) && action.metadata)
        return {
            text: `${companyName(action.metadata.targetId)} holders received ${money(action.metadata.settlement.perShare)} a share`,
            omitActor: true
        }
    if (isCloseMarketShorts(action) && action.metadata)
        return {
            text: `Market closed ${plural(action.metadata.closed, `${companyName(action.companyId)} short`)}`,
            omitActor: true,
            detail: action.metadata.payments.length
                ? `The bank bought ${action.metadata.payments.length} from the treasury`
                : undefined
        }
    return undefined
}
