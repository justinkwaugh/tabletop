import {
    ALAMO_CITY_CUBES_PER_BUILD,
    CUBE_BANK_COST,
    CUBE_FEE,
    CompanyId,
    MAX_CUBES_PER_BUILD,
    companyDefinition
} from '../components/companies.js'
import { HEXES, HEX_CUBE_LIMIT, cityInHex, hasCubeLimit, neighbours } from '../components/map.js'
import type { PlacedCube } from './companyState.js'

export type NetworkState = { cubes: readonly PlacedCube[] }

export type CubeFee = { companyId: CompanyId; amount: number }

export type BuildCost = {
    bank: number
    fees: CubeFee[]
    waived: number
    total: number
}

export function companiesIn(state: NetworkState, hexId: string): CompanyId[] {
    return [
        ...new Set(state.cubes.filter((cube) => cube.hexId === hexId).map((cube) => cube.companyId))
    ]
}

export function companyHexes(state: NetworkState, companyId: CompanyId): Set<string> {
    return new Set(
        state.cubes.filter((cube) => cube.companyId === companyId).map((cube) => cube.hexId)
    )
}

export function connectedCityIds(state: NetworkState, companyId: CompanyId): string[] {
    return [...companyHexes(state, companyId)].flatMap((hexId) => {
        const found = cityInHex(hexId)
        return found ? [found.id] : []
    })
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

function withPlaced(state: NetworkState, companyId: CompanyId, hexIds: readonly string[]) {
    return {
        cubes: [...state.cubes, ...hexIds.map((hexId) => ({ hexId, companyId }))]
    }
}

// A company expands into hexes next to its network and never doubles up in a hex it serves.
export function placeableHexes(
    state: NetworkState,
    companyId: CompanyId,
    placed: readonly string[] = []
): string[] {
    const network = withPlaced(state, companyId, placed)
    const occupied = companyHexes(network, companyId)
    return HEXES.map((candidate) => candidate.id).filter(
        (hexId) =>
            !occupied.has(hexId) &&
            neighbours(hexId).some((neighbour) => occupied.has(neighbour)) &&
            (!hasCubeLimit(hexId) ||
                network.cubes.filter((cube) => cube.hexId === hexId).length < HEX_CUBE_LIMIT)
    )
}

export function isPlacementSequenceLegal(
    state: NetworkState,
    companyId: CompanyId,
    hexIds: readonly string[]
): boolean {
    return hexIds.every((hexId, index) =>
        placeableHexes(state, companyId, hexIds.slice(0, index)).includes(hexId)
    )
}

export function buildCost(
    state: NetworkState,
    companyId: CompanyId,
    hexIds: readonly string[]
): BuildCost {
    const feesPerCube = hexIds.map((hexId) =>
        companiesIn(state, hexId).filter((present) => present !== companyId)
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
    const bank = hexIds.length * CUBE_BANK_COST
    return {
        bank,
        fees,
        waived,
        total: bank + fees.reduce((sum, fee) => sum + fee.amount, 0)
    }
}
