import {
    isAnswerMerger,
    isCompleteMergerPhase,
    isCompleteTakeover,
    isDiscardMergedTrain,
    isPassMerger,
    isProposeMerger,
    isSellTakeoverShares,
    isStartMergerPhase,
    type MergerOutcome,
    isBuyCoalRights,
    isCapitalizeCompany,
    isCloseCompany,
    isCompletePriceProtection,
    isDeclineProtection,
    isProtectShares,
    isAnswerRedemption,
    isRedeemShare,
    isReissueShares,
    isStartPriceProtection,
    isPlaceRevenueToken,
    isRecordMiamiRun,
    isTakeLondonShare,
    EighteenThirtyTwoMap,
    EighteenThirtyTwoMarket
} from '@tabletop/1832'
import type { StockMarketMove } from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import type {
    HistoryDescription,
    HistoryMapPlacement,
    HistoryNames,
    MoneyFormat
} from '@tabletop/18xx-ui'
import { redemptionHolderName } from './companyShareFacts.js'

const TokenNames = { port: 'Port', cotton: 'Cotton', 'key-west': 'Key West' } as const

/** 1832's revenue tokens, for their history rows' map previews. */
export function eighteenThirtyTwoMapPlacement(
    action: GameAction
): HistoryMapPlacement | undefined {
    if (isPlaceRevenueToken(action))
        return {
            kind: `${TokenNames[action.kind]} token`,
            companyId: action.companyId,
            locationIds: [action.locationId]
        }
    return undefined
}

/** 1832's own actions, as history rows. */
const placeName = (locationId: string) =>
    EighteenThirtyTwoMap.definition.locations.find((location) => location.id === locationId)
        ?.name ?? locationId

/** Each price that fell, naming its company unless it is the row's own and falls alone. */
function marketMoveDetail(
    moves: readonly StockMarketMove[] | undefined,
    companyName: (id: string) => string,
    money: MoneyFormat,
    rowCompanyId?: string
): string | undefined {
    const price = (spaceId: string) => money(EighteenThirtyTwoMarket.space(spaceId).price)
    const fell = moves?.filter((move) => move.fromMarketSpaceId !== move.toMarketSpaceId) ?? []
    const label = (companyId: string) =>
        fell.length === 1 && companyId === rowCompanyId
            ? 'Market'
            : `${companyName(companyId)} market`
    return (
        fell
            .map(
                (move) =>
                    `${label(move.companyId)} ${price(move.fromMarketSpaceId)} → ${price(move.toMarketSpaceId)}`
            )
            .join(' · ') || undefined
    )
}

export function describe1832Action(
    action: GameAction,
    names: HistoryNames,
    money: MoneyFormat
): HistoryDescription | undefined {
    const { companyName, playerName } = names
    if (isCapitalizeCompany(action))
        return {
            text: `${companyName(action.companyId)} received its capital`,
            ...(action.metadata ? { value: money(action.metadata.payment.amount) } : {}),
            omitActor: true
        }
    if (isBuyCoalRights(action))
        return {
            text: `${companyName(action.companyId)} bought a West Virginia Coal Fields token`,
            ...(action.metadata
                ? {
                      value: money(
                          action.metadata.payments.reduce((sum, payment) => sum + payment.amount, 0)
                      )
                  }
                : {})
        }
    if (isPlaceRevenueToken(action))
        return {
            text: `${companyName(action.companyId)} placed the ${TokenNames[action.kind]} token in ${placeName(action.locationId)}`
        }
    if (isTakeLondonShare(action))
        return {
            text: action.metadata
                ? `took a free ${companyName(action.metadata.companyId)} share with the London Investment Company`
                : 'took a free share with the London Investment Company'
        }
    if (isRedeemShare(action)) {
        const holder = action.metadata?.holder
        const from = holder ? redemptionHolderName(holder, playerName) : 'the market'
        return action.metadata?.payment
            ? {
                  text: `redeemed a ${companyName(action.companyId)} share from ${from}`,
                  value: money(action.metadata.payment.amount)
              }
            : { text: `asked ${from} to let ${companyName(action.companyId)} redeem a share` }
    }
    if (isAnswerRedemption(action))
        return {
            text: action.accept
                ? `allowed ${action.metadata ? companyName(action.metadata.request.companyId) : 'the company'} to redeem their share`
                : `refused to let ${action.metadata ? companyName(action.metadata.request.companyId) : 'the company'} redeem their share`,
            ...(action.metadata?.payment ? { value: money(action.metadata.payment.amount) } : {})
        }
    if (isReissueShares(action))
        return {
            text: action.metadata
                ? `reissued ${action.metadata.certificateIds.length} ${companyName(action.companyId)} ${action.metadata.certificateIds.length === 1 ? 'share' : 'shares'} at ${money(action.metadata.parPrice)}`
                : `reissued ${companyName(action.companyId)} shares`
        }
    const merged = (outcome: MergerOutcome): HistoryDescription => {
        const [first, second] = outcome.companyIds.map(companyName)
        if (outcome.kind === 'system')
            return {
                text: `${companyName(outcome.survivorId)} formed from ${first} and ${second}`,
                omitActor: true,
                important: true
            }
        const paid = (outcome.payments ?? [])
            .filter((payment) => payment.from.kind === 'company')
            .reduce((total, payment) => total + payment.amount, 0)
        return {
            text: `${first} took over ${second}`,
            value: money(paid),
            omitActor: true,
            important: true
        }
    }
    if (isStartMergerPhase(action) || isCompleteMergerPhase(action) || isPassMerger(action))
        return {
            text: isPassMerger(action) ? 'passed on mergers' : 'Merger phase',
            routine: !isPassMerger(action),
            omitActor: !isPassMerger(action)
        }
    if (isProposeMerger(action)) {
        const outcome = action.metadata?.outcome
        if (outcome) return merged(outcome)
        const verb =
            action.kind === 'system'
                ? `proposed a System of ${companyName(action.companyId)} and ${companyName(action.partnerId)}`
                : action.yielded
                  ? `offered ${companyName(action.partnerId)} a takeover of ${companyName(action.companyId)}`
                  : `proposed that ${companyName(action.companyId)} take over ${companyName(action.partnerId)}`
        return { text: verb }
    }
    if (isAnswerMerger(action)) {
        const outcome = action.metadata?.outcome
        if (outcome) return merged(outcome)
        return { text: action.accept ? 'agreed to the merger' : 'refused the merger' }
    }
    if (isCompleteTakeover(action) && action.metadata) return merged(action.metadata)
    if (isSellTakeoverShares(action))
        return {
            text: `sold ${action.shares} ${companyName(action.companyId)} to fund a takeover`,
            ...(action.metadata ? { value: money(action.metadata.proceeds) } : {})
        }
    if (isDiscardMergedTrain(action)) return { text: 'discarded a train after the takeover' }
    if (isCloseCompany(action))
        return {
            text: `${companyName(action.companyId)} closed, its price in the black area`,
            ...(action.metadata?.forfeit
                ? { detail: `Its president lost ${money(action.metadata.forfeit.amount)}` }
                : {}),
            omitActor: true,
            important: true
        }
    if (isProtectShares(action))
        return {
            text: action.metadata
                ? `protected the ${companyName(action.companyId)} price, buying the ${action.metadata.shares} ${action.metadata.shares === 1 ? 'share' : 'shares'} sold`
                : `protected the ${companyName(action.companyId)} price`,
            ...(action.metadata ? { value: money(action.metadata.payment.amount) } : {}),
            detail: marketMoveDetail(action.metadata?.marketMoves, companyName, money)
        }
    if (isDeclineProtection(action))
        return {
            text: `declined to protect the ${companyName(action.companyId)} price`,
            detail: marketMoveDetail(
                action.metadata?.marketMoves,
                companyName,
                money,
                action.companyId
            )
        }
    if (isCompletePriceProtection(action) && action.metadata?.nextPlayerId)
        return {
            text: 'Play resumed to the left of the last protecting president',
            omitActor: true
        }
    if (isStartPriceProtection(action) && action.metadata?.marketMoves)
        return {
            text: 'Sales no president could protect reached the market',
            detail: marketMoveDetail(action.metadata.marketMoves, companyName, money),
            omitActor: true
        }
    if (isStartPriceProtection(action) || isCompletePriceProtection(action))
        return { text: 'Price protection', omitActor: true, routine: true }
    if (isRecordMiamiRun(action))
        return {
            text: 'Miami has been run to; it now pays its value',
            omitActor: true,
            routine: true
        }
    return undefined
}
