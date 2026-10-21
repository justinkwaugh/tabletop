import { Charters1846 } from './charters.js'
import { Names1846 } from './names.js'
import { Market1846 } from './stock.js'
import { Phases1846 } from './trains.js'
import { assertExists } from '@tabletop/common'
import {
    floatedCompaniesInMarketOrder,
    getCompany,
    marketShareValue,
    type OperatingRules,
    type ValuationRules
} from '@tabletop/18xx'
import { DraftCompanies } from './catalog.js'
export const OperatingRules1846: OperatingRules = {
    charters: Charters1846,
    roundCount: (state) => Phases1846.phase(state.phaseId).operatingRounds,
    companyOrder(state) {
        const majors = floatedCompaniesInMarketOrder(Market1846, state)
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
                          Market1846.companySpace(state.stockMarket, a).price -
                          Market1846.companySpace(state.stockMarket, b).price
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
                    label: Names1846.company(company.id),
                    value: marketShareValue(Market1846, state, certificate)
                }
            ]
        const privateCompany = DraftCompanies.find((entry) => entry.id === company.id)
        assertExists(privateCompany, 'A private or independent has a printed value')
        return [
            {
                assetId: certificate.id,
                label: Names1846.company(company.id),
                value: privateCompany.price
            }
        ]
    }
}
