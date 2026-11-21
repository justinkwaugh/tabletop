import {
    isAcquireCompany,
    isBidToAcquire,
    isBuyBackShares,
    isBuyConvertedShare,
    isBuyOwedStations,
    isCloseCompanySale,
    isCloseMarketShorts,
    isConvertCompany,
    isDeclineOffer,
    isDiscardMergedTrain,
    isFinishAcquisitionLoans,
    isFinishConversionLoans,
    isLiquidateCompany,
    isMergeCompanies,
    isOfferCompany,
    isOpenCompanySale,
    isPassConversion,
    isPassConvertedShares,
    isPassOnCompany,
    isRemoveStation,
    isRemoveStationMarker,
    isRepayAcquiredLoan,
    isSellConvertedShares,
    isShortShare,
    isSizedCompanyGoBankrupt,
    isSkipCompanySale,
    type CashPayment,
    type DeparturePayment
} from '@tabletop/18xx'
import { ActionSource, type GameAction } from '@tabletop/common'
import { counted } from '../presentation/count.js'
import type { MoneyFormat } from '../presentation/money.js'
import {
    departurePaymentsDetail,
    joinDetails,
    type HistoryDescription,
    type HistoryNames
} from '../table/historyDescription.js'

const reasons = {
    'no-train': 'it has no train',
    'unpaid-stations': 'it did not pay for its stations',
    'unsold-shares': 'players held less than half its shares after its first stock round'
}

/** What the history needs beyond names to describe a sized-company title's actions. */
export type SizedCompanyHistoryTerms = {
    poolName: (poolId: string) => string
    place: (locationId: string) => string
    /** What one of the title's loans costs to repay. */
    loanValue: number
    /** The title's payment on a company's sale or liquidation, as 1817's Golden Parachute's. */
    salePayment?: (payment: CashPayment) => string | undefined
}

/**
 * The history rows of the sized-company mechanisms: liquidation, owed stations, buy-backs,
 * shorts, the merger and acquisition rounds, and a bankruptcy's liquidations, added to the shared
 * row by `shared`.
 */
export function describeSizedCompanyAction(
    action: GameAction,
    names: HistoryNames,
    money: MoneyFormat,
    terms: SizedCompanyHistoryTerms,
    shared: () => HistoryDescription
): HistoryDescription | undefined {
    const { companyName } = names
    const salePayment = (payment: CashPayment | undefined) =>
        payment && terms.salePayment?.(payment)
    const paid = (payments: readonly DeparturePayment[] = []) =>
        departurePaymentsDetail(payments, names, money)
    if (isSizedCompanyGoBankrupt(action) && action.metadata?.changes.liquidatedCompanyIds.length) {
        const description = shared()
        return {
            ...description,
            detail: joinDetails(
                description.detail,
                `Liquidated ${action.metadata.changes.liquidatedCompanyIds.map(companyName).join(', ')}`
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
            text: `${companyName(action.companyId)} bought ${counted(action.metadata.stations, 'station')}`,
            omitActor: true,
            value: money(action.metadata.payment.amount)
        }
    if (isBuyBackShares(action))
        return {
            text: `Bought back ${counted(action.certificateIds.length, `${companyName(action.companyId)} share`)}`,
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
    if (isPassConversion(action) && action.source === ActionSource.User)
        return { text: `Passed with ${companyName(action.companyId)}`, routine: true }
    if (isBuyConvertedShare(action)) {
        const poolId = action.metadata?.poolId
        return {
            text: `Bought a ${companyName(action.companyId)} share${poolId ? ` from ${terms.poolName(poolId)}` : ''}`,
            value: money(action.expectedPrice)
        }
    }
    if (isSellConvertedShares(action))
        return {
            text: `Sold ${counted(action.shares, `${companyName(action.companyId)} share`)}`,
            value: money(action.expectedProceeds)
        }
    if (isPassConvertedShares(action) && action.source === ActionSource.User)
        return {
            text: `Passed on ${companyName(action.companyId)} shares`,
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
            text: `${companyName(action.companyId)} bought ${counted(action.metadata.stations, 'station')}`,
            omitActor: true,
            value: money(action.metadata.payment.amount)
        }
    if (isRemoveStation(action))
        return {
            text:
                action.metadata?.destination === 'available'
                    ? `Returned a ${companyName(action.companyId)} station to its charter`
                    : `Removed a ${companyName(action.companyId)} station`,
            detail: action.metadata && terms.place(action.metadata.locationId)
        }
    if (isRemoveStationMarker(action))
        return {
            text: `Removed a ${companyName(action.companyId)} marker counted as a station`,
            detail: terms.place(action.locationId)
        }
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
                salePayment(action.metadata?.parachute)
            ),
            important: !!action.metadata
        }
    if (isAcquireCompany(action) && action.metadata)
        return {
            text: `${companyName(action.buyerId)} acquired ${companyName(action.companyId)}`,
            value: money(action.metadata.price),
            detail: salePayment(action.metadata.parachute),
            important: true
        }
    if (isRepayAcquiredLoan(action))
        return {
            text: `Repaid a loan ${companyName(action.companyId)} took on`,
            value: money(terms.loanValue)
        }
    if (isFinishAcquisitionLoans(action) && action.metadata)
        return {
            text: `${companyName(action.metadata.targetId)} holders received ${money(action.metadata.settlement.perShare)} a share`,
            omitActor: true
        }
    if (isCloseMarketShorts(action) && action.metadata)
        return {
            text: `Market closed ${counted(action.metadata.closed, `${companyName(action.companyId)} short`)}`,
            omitActor: true,
            detail: action.metadata.payments.length
                ? `The bank bought ${action.metadata.payments.length} from the treasury`
                : undefined
        }
    return undefined
}
