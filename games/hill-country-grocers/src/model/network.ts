import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import {
    ALAMO_CITY_CUBES_PER_BUILD,
    CUBE_BANK_COST,
    CUBE_FEE,
    CompanyId,
    MAX_CUBES_PER_BUILD,
    companyDefinition
} from '../components/companies.js'
import { HEX_CUBE_LIMIT, HILL_COUNTRY_MAP, hasCubeLimit, hexKey } from '../components/map.js'
import type { PlacedCube } from './companyState.js'

export type NetworkState = { cubes: readonly PlacedCube[] }

export type CubeFee = { companyId: CompanyId; amount: number }

export type BuildCost = {
    bank: number
    fees: CubeFee[]
    waived: number
    total: number
}

function cubesAt(state: NetworkState, coords: AxialCoordinates): PlacedCube[] {
    return state.cubes.filter((cube) => sameCoordinates(cube.coords, coords))
}

export function companiesIn(state: NetworkState, coords: AxialCoordinates): CompanyId[] {
    return [...new Set(cubesAt(state, coords).map((cube) => cube.companyId))]
}

function companyHexKeys(state: NetworkState, companyId: CompanyId): Set<number> {
    return new Set(
        state.cubes
            .filter((cube) => cube.companyId === companyId)
            .map((cube) => hexKey(cube.coords))
    )
}

export function connectedCityIds(state: NetworkState, companyId: CompanyId): string[] {
    const served = companyHexKeys(state, companyId)
    return HILL_COUNTRY_MAP.hexes().flatMap((place) =>
        place.cityId !== undefined && served.has(hexKey(place.coords)) ? [place.cityId] : []
    )
}

export function cubesRemaining(state: NetworkState, companyId: CompanyId): number {
    return (
        companyDefinition(companyId).supply -
        state.cubes.filter((cube) => cube.companyId === companyId).length
    )
}

export function cubesPerBuild(companyId: CompanyId): number {
    return companyId === CompanyId.AlamoCity ? ALAMO_CITY_CUBES_PER_BUILD : MAX_CUBES_PER_BUILD
}

function withPlaced(
    state: NetworkState,
    companyId: CompanyId,
    hexes: readonly AxialCoordinates[]
): NetworkState {
    return { cubes: [...state.cubes, ...hexes.map((coords) => ({ coords, companyId }))] }
}

// A company expands into hexes next to its network and never doubles up in a hex it serves.
export function placeableHexes(
    state: NetworkState,
    companyId: CompanyId,
    placed: readonly AxialCoordinates[] = []
): AxialCoordinates[] {
    const network = withPlaced(state, companyId, placed)
    const occupied = companyHexKeys(network, companyId)
    return HILL_COUNTRY_MAP.hexes()
        .filter(
            (place) =>
                !occupied.has(hexKey(place.coords)) &&
                HILL_COUNTRY_MAP.neighborsOf(place).some((neighbour) =>
                    occupied.has(hexKey(neighbour.coords))
                ) &&
                (!hasCubeLimit(place.coords) ||
                    cubesAt(network, place.coords).length < HEX_CUBE_LIMIT)
        )
        .map((place) => place.coords)
}

export function isPlacementSequenceLegal(
    state: NetworkState,
    companyId: CompanyId,
    hexes: readonly AxialCoordinates[]
): boolean {
    return hexes.every((coords, index) =>
        placeableHexes(state, companyId, hexes.slice(0, index)).some((candidate) =>
            sameCoordinates(candidate, coords)
        )
    )
}

export function buildCost(
    state: NetworkState,
    companyId: CompanyId,
    hexes: readonly AxialCoordinates[]
): BuildCost {
    const feesPerCube = hexes.map((coords) =>
        companiesIn(state, coords).filter((present) => present !== companyId)
    )
    // Verbena waives the fees on whichever of its cubes owes the most.
    const waivedIndex =
        companyId === CompanyId.Verbena
            ? feesPerCube.reduce(
                  (best, payees, index) =>
                      payees.length > feesPerCube[best].length ? index : best,
                  0
              )
            : -1
    const amounts = new Map<CompanyId, number>()
    let waived = 0
    feesPerCube.forEach((payees, index) => {
        if (index === waivedIndex) {
            waived = payees.length * CUBE_FEE
            return
        }
        for (const payee of payees) {
            amounts.set(payee, (amounts.get(payee) ?? 0) + CUBE_FEE)
        }
    })
    const fees = [...amounts].map(([payee, amount]) => ({ companyId: payee, amount }))
    const bank = hexes.length * CUBE_BANK_COST
    return {
        bank,
        fees,
        waived,
        total: bank + fees.reduce((sum, fee) => sum + fee.amount, 0)
    }
}
