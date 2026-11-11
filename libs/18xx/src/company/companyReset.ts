import { assert } from '@tabletop/common'
import { getCompany, removeCertificates, type FinancialState } from '../finance/finance.js'
import { homeStationId, type Station, type StationState } from '../map/station.js'
import { removeStockMarker, type StockMarket } from '../stock/stockMarket.js'

/** How a title's reset charter is left for its restart. */
export interface CompanyResetTerms {
    /**
     * The pool every certificate returns to in the bank; when omitted only the president's
     * certificate returns, outside any pool, while the other shares and shorts leave play.
     */
    poolId?: string
    /** Whether the home station stays, unplaced, for the restart; it does unless false. */
    keepsHome?: boolean
}

/**
 * Returns a company whose assets have gone to an unstarted charter that can be started again:
 * its market marker, flags, loans and last run revenue are cleared, its certificates return to
 * the bank as the terms say, and at most its home station remains, unplaced.
 */
export function resetCompany(
    state: FinancialState & StationState & { stockMarket: StockMarket },
    companyId: string,
    shareCount: number,
    terms: CompanyResetTerms = {}
): void {
    const company = getCompany(state, companyId)
    assert(company.kind !== 'private', 'Only a company with shares is reset')
    for (const field of [
        'started',
        'floated',
        'funded',
        'operated',
        'parPrice',
        'president',
        'loans',
        'lastRunRevenue'
    ] as const)
        delete company[field]
    company.shareCount = shareCount
    removeStockMarker(state.stockMarket, companyId)
    if (terms.poolId === undefined) {
        const leaving = state.certificates.filter(
            (certificate) =>
                certificate.companyId === companyId &&
                !(certificate.kind === 'share' && certificate.president)
        )
        removeCertificates(
            state,
            leaving.map((certificate) => certificate.id)
        )
    }
    const returning = state.certificates.filter(
        (certificate) => certificate.companyId === companyId
    )
    assert(returning.length > 0, 'A reset company keeps its president’s certificate')
    for (const certificate of returning) {
        certificate.owner = { kind: 'bank' }
        if (terms.poolId === undefined) delete certificate.poolId
        else certificate.poolId = terms.poolId
    }
    const keepsHome = terms.keepsHome ?? true
    state.stations = state.stations.map((station): Station => {
        if (station.companyId !== companyId) return station
        return keepsHome && station.id === homeStationId(companyId)
            ? { id: station.id, companyId, status: 'available' }
            : { id: station.id, companyId, status: 'removed' }
    })
}
