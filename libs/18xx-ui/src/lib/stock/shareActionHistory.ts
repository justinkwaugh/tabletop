import {
    isAnswerRedemption,
    isCompletePriceProtection,
    isDeclineProtection,
    isProtectShares,
    isRedeemShare,
    isReissueShares,
    isStartPriceProtection,
    type StockMarketChart,
    type StockMarketMove
} from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import type { MoneyFormat } from '../presentation/money.js'
import type { HistoryDescription, HistoryNames } from '../table/historyDescription.js'
import { redemptionHolderName } from './shareActions.svelte.js'

function marketMoveDetail(
    moves: readonly StockMarketMove[] | undefined,
    market: StockMarketChart,
    companyName: (id: string) => string,
    money: MoneyFormat,
    rowCompanyId?: string
): string | undefined {
    const price = (spaceId: string) => money(market.space(spaceId).price)
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

export function describeShareAction(
    action: GameAction,
    { companyName, playerName }: Pick<HistoryNames, 'companyName' | 'playerName'>,
    money: MoneyFormat,
    market: StockMarketChart
): HistoryDescription | undefined {
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
    if (isProtectShares(action))
        return {
            text: action.metadata
                ? `protected the ${companyName(action.companyId)} price, buying the ${action.metadata.shares} ${action.metadata.shares === 1 ? 'share' : 'shares'} sold`
                : `protected the ${companyName(action.companyId)} price`,
            ...(action.metadata ? { value: money(action.metadata.payment.amount) } : {}),
            detail: marketMoveDetail(action.metadata?.marketMoves, market, companyName, money)
        }
    if (isDeclineProtection(action))
        return {
            text: `declined to protect the ${companyName(action.companyId)} price`,
            detail: marketMoveDetail(
                action.metadata?.marketMoves,
                market,
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
            detail: marketMoveDetail(action.metadata.marketMoves, market, companyName, money),
            omitActor: true
        }
    if (isStartPriceProtection(action) || isCompletePriceProtection(action))
        return { text: 'Price protection', omitActor: true, routine: true }
    return undefined
}
