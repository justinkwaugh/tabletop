import { getCompany, marketShareValue, type EndingRules } from '@tabletop/18xx'
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
        return [
            {
                assetId: certificate.id,
                label:
                    certificate.kind === 'share'
                        ? `${company.name} · ${certificate.shares} share${certificate.shares === 1 ? '' : 's'}`
                        : company.name,
                value
            }
        ]
    }
}
