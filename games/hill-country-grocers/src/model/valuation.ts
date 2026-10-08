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

export type ValueBreakdown = {
    cities: number
    cityValue: number
    developments: number
    developmentValue: number
    total: number
}

// Grocers count the cities they serve and the developments there; the developer counts every
// development on the map.
export function companyValueBreakdown(
    state: NetworkState & DevelopmentState,
    companyId: CompanyId
): ValueBreakdown {
    if (!isGrocer(companyId)) {
        const developments = markersPlaced(state)
        return {
            cities: 0,
            cityValue: 0,
            developments,
            developmentValue: DEVELOPER_MARKER_VALUE,
            total: developments * DEVELOPER_MARKER_VALUE
        }
    }
    const developmentValue =
        companyId === CompanyId.CompleteComestibles ? COMESTIBLES_MARKER_VALUE : MARKER_VALUE
    const cityIds = connectedCityIds(state, companyId)
    const developments = cityIds.reduce((sum, cityId) => sum + markersIn(state, cityId), 0)
    return {
        cities: cityIds.length,
        cityValue: CITY_VALUE,
        developments,
        developmentValue,
        total: cityIds.length * CITY_VALUE + developments * developmentValue
    }
}

export function companyValue(state: NetworkState & DevelopmentState, companyId: CompanyId): number {
    return companyValueBreakdown(state, companyId).total
}

export function valuePerShare(value: number, sharesHeld: number): number {
    return sharesHeld === 0 ? 0 : Math.ceil(value / sharesHeld)
}
