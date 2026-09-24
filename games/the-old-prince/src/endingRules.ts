import {
    certificateWealthItem,
    getCompany,
    marketShareValue,
    portfolioWealth,
    type EndingRules
} from '@tabletop/18xx'
import { TheOldPrincePrivateCatalog } from './privates.js'
export const TheOldPrinceEndingRules: EndingRules = {
    trigger(state) {
        if (state.bankruptcy) return { reason: 'Bankruptcy' }
        if (state.phaseId === 'D')
            return {
                reason: 'First diesel',
                finalOperatingSet: (state.operatingSet?.number ?? 0) + 1
            }
        return undefined
    },
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        if (company.id === 'UB' && !company.closed)
            return portfolioWealth(
                state,
                { kind: 'company', companyId: 'UB' },
                TheOldPrinceEndingRules
            ).map((item) => ({ ...item, label: `Union Bank: ${item.label}` }))
        let value = 0
        if (certificate.kind === 'share' && company.id === 'PEIR') value = 80 * certificate.shares
        else if (!company.closed) {
            value =
                certificate.kind === 'share'
                    ? marketShareValue(state, certificate)
                    : TheOldPrincePrivateCatalog.faceValue(company.id)
        }
        return [certificateWealthItem(state, certificate, value)]
    }
}
