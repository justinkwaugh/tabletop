import {
    isBuyCoalRights,
    isCapitalizeCompany,
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
    if (isRecordMiamiRun(action))
        return {
            text: 'Miami has been run to; it now pays its value',
            omitActor: true,
            routine: true
        }
    return undefined
}
