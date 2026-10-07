import {
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
import type { TitleActionDescription } from '@tabletop/18xx-ui'

const TokenNames = { port: 'Port', cotton: 'Cotton', 'key-west': 'Key West' } as const

/** 1832's own actions, as history rows. */
export const describe1832Action =
    (playerName: (playerId: string) => string): TitleActionDescription =>
    (action, companyName) => {
        if (isCapitalizeCompany(action))
            return {
                text: `${companyName(action.companyId)} received its capital`,
                ...(action.metadata ? { value: `$${action.metadata.payment.amount}` } : {}),
                omitActor: true
            }
        if (isBuyCoalRights(action))
            return {
                text: `${companyName(action.companyId)} bought a West Virginia Coal Fields token`,
                ...(action.metadata
                    ? {
                          value: `$${action.metadata.payments.reduce((sum, payment) => sum + payment.amount, 0)}`
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
            const from = holder?.kind === 'player' ? playerName(holder.playerId) : 'the market'
            return action.metadata?.payment
                ? {
                      text: `redeemed a ${companyName(action.companyId)} share from ${from}`,
                      value: `$${action.metadata.payment.amount}`
                  }
                : { text: `asked ${from} to let ${companyName(action.companyId)} redeem a share` }
        }
        if (isAnswerRedemption(action))
            return {
                text: action.accept
                    ? `allowed ${action.metadata ? companyName(action.metadata.request.companyId) : 'the company'} to redeem their share`
                    : `refused to let ${action.metadata ? companyName(action.metadata.request.companyId) : 'the company'} redeem their share`,
                ...(action.metadata?.payment ? { value: `$${action.metadata.payment.amount}` } : {})
            }
        if (isReissueShares(action))
            return {
                text: action.metadata
                    ? `reissued ${action.metadata.certificateIds.length} ${companyName(action.companyId)} ${action.metadata.certificateIds.length === 1 ? 'share' : 'shares'} at $${action.metadata.parPrice}`
                    : `reissued ${companyName(action.companyId)} shares`
            }
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
                ...(action.metadata ? { value: `$${action.metadata.payment.amount}` } : {})
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
