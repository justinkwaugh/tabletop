import {
    isBuyCoalRights,
    isCapitalizeCompany,
    isCloseCompany,
    isCompletePriceProtection,
    isDeclineProtection,
    isProtectShares,
    isStartPriceProtection,
    isPlaceRevenueToken,
    isRecordMiamiRun,
    isTakeLondonShare
} from '@tabletop/1832'
import type { TitleActionDescription } from '@tabletop/18xx-ui'

const TokenNames = { port: 'Port', cotton: 'Cotton', 'key-west': 'Key West' } as const

export const describe1832Action: TitleActionDescription = (action, companyName) => {
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
