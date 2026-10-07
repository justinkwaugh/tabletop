import { CompanyId, isGrocer } from '../components/companies.js'
import { connectedCityIds, type NetworkState } from './network.js'

export type DevelopmentState = { developments: Record<string, number> }

export const CITY_VALUE = 1
export const MARKER_VALUE = 2
export const COMESTIBLES_MARKER_VALUE = 3
export const DEVELOPER_MARKER_VALUE = 1

export function markersIn(state: DevelopmentState, cityId: string): number {
    return state.developments[cityId] ?? 0
}

export function markersPlaced(state: DevelopmentState): number {
    return Object.values(state.developments).reduce((sum, count) => sum + count, 0)
}

export function companyValue(state: NetworkState & DevelopmentState, companyId: CompanyId): number {
    if (!isGrocer(companyId)) {
        return markersPlaced(state) * DEVELOPER_MARKER_VALUE
    }
    const markerValue =
        companyId === CompanyId.CompleteComestibles ? COMESTIBLES_MARKER_VALUE : MARKER_VALUE
    return connectedCityIds(state, companyId).reduce(
        (sum, cityId) => sum + CITY_VALUE + markersIn(state, cityId) * markerValue,
        0
    )
}

export function valuePerShare(value: number, sharesHeld: number): number {
    return sharesHeld === 0 ? 0 : Math.ceil(value / sharesHeld)
}
