import {
    bankExhaustionAtSetEnd,
    certificateWealthItem,
    getCompany,
    marketShareValue,
    type EndingRules
} from '@tabletop/18xx'
import { EighteenThirtyTwoPrivateCatalog } from './privates.js'

// Bankruptcy ends the game at once; a broken bank after the operating set (§13). Shares count
// at market value and privates at face value (§14).
export const EighteenThirtyTwoEndingRules: EndingRules = {
    trigger(state) {
        if (state.bankruptcy) return { reason: 'Bankruptcy' }
        return bankExhaustionAtSetEnd(state)
    },
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        let value = 0
        if (!company.closed)
            value =
                certificate.kind === 'share'
                    ? marketShareValue(state, certificate)
                    : EighteenThirtyTwoPrivateCatalog.faceValue(company.id)
        return [certificateWealthItem(state, certificate, value)]
    }
}
