import {
    bankExhaustionAtSetEnd,
    certificateWealthItem,
    getCompany,
    marketShareValue,
    type EndingRules
} from '@tabletop/18xx'
import { EighteenThirtyPrivateCatalog } from './privates.js'
export const EighteenThirtyEndingRules: EndingRules = {
    trigger(state) {
        if (state.bankruptcy) return { reason: 'Bankruptcy' }
        return bankExhaustionAtSetEnd(state)
    },
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        let value = 0
        if (!company.closed) {
            value =
                certificate.kind === 'share'
                    ? marketShareValue(state, certificate)
                    : EighteenThirtyPrivateCatalog.faceValue(company.id)
        }
        return [certificateWealthItem(state, certificate, value)]
    }
}
