import { assertExists } from '@tabletop/common'
import {
    companyMarketSpace,
    floatedCompaniesInMarketOrder,
    getCompany,
    marketShareValue,
    type OperatingRules,
    type ValuationRules
} from '@tabletop/18xx'
import { DraftCompanies } from './catalog.js'
export const OperatingRules1846: OperatingRules = {
    roundCount: () => 2,
    companyOrder(state) {
        const majors = floatedCompaniesInMarketOrder(state)
        const first =
            !state.operatingSet ||
            (state.operatingSet.number === 1 && state.operatingSet.roundNumber === 1)
        return [
            ...['MS', 'BIG4'].filter((id) => {
                const company = getCompany(state, id)
                return company.started && !company.closed
            }),
            ...(first
                ? majors.toSorted(
                      (a, b) =>
                          companyMarketSpace(state.stockMarket, a).price -
                          companyMarketSpace(state.stockMarket, b).price
                  )
                : majors)
        ]
    }
}
export const ValuationRules1846: ValuationRules = {
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        if (company.closed) return []
        if (company.kind === 'major')
            return [
                {
                    assetId: certificate.id,
                    label: company.name,
                    value: marketShareValue(state, certificate)
                }
            ]
        const privateCompany = DraftCompanies.find((entry) => entry.id === company.id)
        assertExists(privateCompany, 'A private or independent has a printed value')
        return [{ assetId: certificate.id, label: company.name, value: privateCompany.price }]
    }
}
