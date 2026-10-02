import { assert } from '@tabletop/common'
import { getCompany, type FinancialState } from '../finance/finance.js'
import { homeStationId, type Station, type StationState } from '../map/station.js'
import { removeStockMarker, type StockMarket } from '../stock/stockMarket.js'

/**
 * Returns a company whose assets have gone to an unstarted charter that can be started again:
 * its market marker, flags and loans are cleared, its president's certificate returns to the
 * bank while its other shares and shorts leave play, and only its home station remains,
 * unplaced.
 */
export function resetCompany(
    state: FinancialState & StationState & { stockMarket: StockMarket },
    companyId: string,
    shareCount: number
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
        'loans'
    ] as const)
        delete company[field]
    company.shareCount = shareCount
    removeStockMarker(state.stockMarket, companyId)
    state.certificates = state.certificates.map((certificate) => {
        if (certificate.retired || certificate.companyId !== companyId) return certificate
        const { owner: _owner, poolId: _poolId, ...interest } = certificate
        return interest.kind === 'share' && interest.president
            ? { ...interest, retired: false, owner: { kind: 'bank' } }
            : { ...interest, retired: true }
    })
    state.stations = state.stations.map((station): Station => {
        if (station.companyId !== companyId) return station
        return station.id === homeStationId(companyId)
            ? { id: station.id, companyId, status: 'available' }
            : { id: station.id, companyId, status: 'removed' }
    })
}
