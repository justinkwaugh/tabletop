import { Shikoku1889Names } from './names.js'
import { Shikoku1889Market } from './stockMarket.js'
import {
    bankExhaustionAtSetEnd,
    certificateWealthItem,
    getCompany,
    marketShareValue,
    type EndingRules
} from '@tabletop/18xx'
import { Shikoku1889PrivateCatalog } from './privates.js'
export const Shikoku1889EndingRules: EndingRules = {
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
                    ? marketShareValue(Shikoku1889Market, state, certificate)
                    : Shikoku1889PrivateCatalog.faceValue(company.id)
        }
        return [certificateWealthItem(Shikoku1889Names, certificate, value)]
    }
}
