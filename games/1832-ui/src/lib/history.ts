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
    isTakeLondonShare
} from '@tabletop/1832'
import type { GameAction } from '@tabletop/common'
import type { HistoryDescription, HistoryNames, MoneyFormat } from '@tabletop/18xx-ui'
import { redemptionHolderName } from './companyShareFacts.js'

const TokenNames = { port: 'Port', cotton: 'Cotton', 'key-west': 'Key West' } as const

/** 1832's own actions, as history rows. */
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
            text: `${companyName(action.companyId)} placed the ${TokenNames[action.kind]} token at ${action.locationId}`
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
                ? { detail: `Its president lost $${action.metadata.forfeit.amount}` }
                : {}),
            omitActor: true,
            important: true
        }
    if (isProtectShares(action))
        return {
            text: action.metadata
                ? `protected the ${companyName(action.companyId)} price, buying the ${action.metadata.shares} ${action.metadata.shares === 1 ? 'share' : 'shares'} sold`
                : `protected the ${companyName(action.companyId)} price`,
            ...(action.metadata ? { value: money(action.metadata.payment.amount) } : {})
        }
    if (isDeclineProtection(action))
        return { text: `declined to protect the ${companyName(action.companyId)} price` }
    if (isCompletePriceProtection(action) && action.metadata?.nextPlayerId)
        return {
            text: 'Play resumed to the left of the last protecting president',
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
