import {
    certificateWealthItem,
    getCompany,
    marketShareValue,
    type EndingRules
} from '@tabletop/18xx'
import { Shikoku1889PrivateCatalog } from './privates.js'
export const Shikoku1889EndingRules: EndingRules = {
    trigger(state) {
        if (state.bankruptcy) return { reason: 'Bankruptcy' }
        if (state.bank.broken)
            return {
                reason: 'Bank broken',
                finalOperatingSet:
                    (state.operatingSet?.number ?? 0) +
                    (!state.operatingSet || state.operatingSet.completed ? 1 : 0)
            }
        return undefined
    },
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        let value = 0
        if (!company.closed) {
            value =
                certificate.kind === 'share'
                    ? marketShareValue(state, certificate)
                    : Shikoku1889PrivateCatalog.faceValue(company.id)
        }
        return [certificateWealthItem(state, certificate, value)]
    }
}
