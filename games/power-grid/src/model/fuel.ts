import {
    PlantKind,
    plantResources,
    powerPlant,
    storageCapacity,
    type PowerPlant
} from '../components/plants.js'
import {
    RESOURCES,
    noResources,
    subtractResources,
    totalResources,
    type ResourceAmounts
} from '../components/resources.js'

type KindTotals = { coal: number; oil: number; hybrid: number; garbage: number; uranium: number }

export function kindTotals(plants: readonly PowerPlant[], amount: (plant: PowerPlant) => number) {
    const totals: KindTotals = { coal: 0, oil: 0, hybrid: 0, garbage: 0, uranium: 0 }
    for (const plant of plants) {
        switch (plant.kind) {
            case PlantKind.Coal:
            case PlantKind.Oil:
            case PlantKind.Hybrid:
            case PlantKind.Garbage:
            case PlantKind.Uranium:
                totals[plant.kind] += amount(plant)
                break
            case PlantKind.Ecological:
            case PlantKind.Fusion:
                break
        }
    }
    return totals
}

export function plantsOf(numbers: readonly number[]): PowerPlant[] {
    return numbers.map((number) => powerPlant(number))
}

/** Hybrids share their space between coal and oil, so coal and oil also fit as a pair. */
export function canStore(plants: readonly PowerPlant[], held: ResourceAmounts): boolean {
    const capacity = kindTotals(plants, storageCapacity)
    return (
        held.coal <= capacity.coal + capacity.hybrid &&
        held.oil <= capacity.oil + capacity.hybrid &&
        held.coal + held.oil <= capacity.coal + capacity.oil + capacity.hybrid &&
        held.garbage <= capacity.garbage &&
        held.uranium <= capacity.uranium
    )
}

/** The most of each resource the plants could hold on top of what is held, one type at a time. */
export function storageRoom(plants: readonly PowerPlant[], held: ResourceAmounts): ResourceAmounts {
    const capacity = kindTotals(plants, storageCapacity)
    const pairRoom = capacity.coal + capacity.oil + capacity.hybrid - held.coal - held.oil
    return {
        coal: Math.max(0, Math.min(capacity.coal + capacity.hybrid - held.coal, pairRoom)),
        oil: Math.max(0, Math.min(capacity.oil + capacity.hybrid - held.oil, pairRoom)),
        garbage: Math.max(0, capacity.garbage - held.garbage),
        uranium: Math.max(0, capacity.uranium - held.uranium)
    }
}

/** Whether `fuel` is exactly what the plants burn, hybrids taking any mix of coal and oil. */
export function burnsExactly(plants: readonly PowerPlant[], fuel: ResourceAmounts): boolean {
    const need = kindTotals(plants, (plant) => plant.fuel)
    const spareCoal = fuel.coal - need.coal
    const spareOil = fuel.oil - need.oil
    return (
        spareCoal >= 0 &&
        spareOil >= 0 &&
        spareCoal + spareOil === need.hybrid &&
        fuel.garbage === need.garbage &&
        fuel.uranium === need.uranium
    )
}

export function fuelNeeds(plants: readonly PowerPlant[]): KindTotals {
    return kindTotals(plants, (plant) => plant.fuel)
}

/**
 * The fuel the plants burn if `held` covers it. Hybrids burn `hybridCoal` coal and oil for the
 * rest, or as much coal as there is when no split is given.
 */
export function fuelFor(
    plants: readonly PowerPlant[],
    held: ResourceAmounts,
    hybridCoal?: number
): ResourceAmounts | undefined {
    const need = fuelNeeds(plants)
    const fixed: ResourceAmounts = {
        coal: need.coal,
        oil: need.oil,
        garbage: need.garbage,
        uranium: need.uranium
    }
    const spare = subtractResources(held, fixed)
    if (RESOURCES.some((resource) => spare[resource] < 0)) {
        return undefined
    }
    const coal = hybridCoal ?? Math.min(spare.coal, need.hybrid)
    const oil = need.hybrid - coal
    if (coal < 0 || oil < 0 || coal > spare.coal || oil > spare.oil) {
        return undefined
    }
    return { ...fixed, coal: fixed.coal + coal, oil: fixed.oil + oil }
}

export function hybridCoalIn(plants: readonly PowerPlant[], fuel: ResourceAmounts): number {
    return fuel.coal - fuelNeeds(plants).coal
}

export function citiesSupplied(plants: readonly PowerPlant[]): number {
    return plants.reduce((sum, plant) => sum + plant.cities, 0)
}

export type PowerPlan = { plants: number[]; fuel: ResourceAmounts; supplied: number }

function subsets<T>(items: readonly T[]): T[][] {
    return items.reduce<T[][]>(
        (sets, item) => [...sets, ...sets.map((set) => [...set, item])],
        [[]]
    )
}

/**
 * The plan powering the most of `cityCount` cities; among equals, the one burning the fewest
 * resources, so idle plants keep theirs for later.
 */
export function bestPowerPlan(
    plantNumbers: readonly number[],
    held: ResourceAmounts,
    cityCount: number
): PowerPlan {
    let best: PowerPlan = { plants: [], fuel: noResources(), supplied: 0 }
    let bestBurn = 0
    for (const numbers of subsets(plantNumbers)) {
        const plants = plantsOf(numbers)
        const fuel = fuelFor(plants, held)
        if (!fuel) {
            continue
        }
        const supplied = Math.min(citiesSupplied(plants), cityCount)
        const burn = RESOURCES.reduce((sum, resource) => sum + fuel[resource], 0)
        if (supplied > best.supplied || (supplied === best.supplied && burn < bestBurn)) {
            best = { plants: numbers.toSorted((a, b) => a - b), fuel, supplied }
            bestBurn = burn
        }
    }
    return best
}

export function overflow(plants: readonly PowerPlant[], held: ResourceAmounts): number {
    return totalResources(forcedReturn(plants, held))
}

/**
 * The tokens that must go back for the plants to hold the rest. Only the coal–oil split can be
 * chosen; `dropOilFirst` decides which of the two goes when hybrids cannot keep both.
 */
export function forcedReturn(
    plants: readonly PowerPlant[],
    held: ResourceAmounts,
    dropOilFirst = false
): ResourceAmounts {
    const capacity = kindTotals(plants, storageCapacity)
    const coalKept = Math.min(held.coal, capacity.coal + capacity.hybrid)
    const oilKept = Math.min(held.oil, capacity.oil + capacity.hybrid)
    let pairExcess = Math.max(
        0,
        coalKept + oilKept - capacity.coal - capacity.oil - capacity.hybrid
    )
    const returned = {
        ...noResources(),
        coal: held.coal - coalKept,
        oil: held.oil - oilKept,
        garbage: Math.max(0, held.garbage - capacity.garbage),
        uranium: Math.max(0, held.uranium - capacity.uranium)
    }
    const order = dropOilFirst ? (['oil', 'coal'] as const) : (['coal', 'oil'] as const)
    for (const resource of order) {
        const kept = resource === 'coal' ? coalKept : oilKept
        const minimum = resource === 'coal' ? capacity.coal : capacity.oil
        const drop = Math.min(pairExcess, Math.max(0, kept - minimum))
        returned[resource] += drop
        pairExcess -= drop
    }
    return returned
}

/** Pooled resources shown on the plants: single-fuel plants fill first, hybrids take the rest. */
export function storedOnPlants(
    plants: readonly number[],
    held: ResourceAmounts
): Map<number, ResourceAmounts> {
    const left = { ...held }
    const stored = new Map(plants.map((plant) => [plant, noResources()]))
    const fill = (hybrids: boolean) => {
        for (const number of plants) {
            const plant = powerPlant(number)
            const slot = stored.get(number)
            if (!slot || (plant.kind === PlantKind.Hybrid) !== hybrids) {
                continue
            }
            let room = storageCapacity(plant)
            for (const fuel of plantResources(plant.kind)) {
                const take = Math.min(room, left[fuel])
                slot[fuel] += take
                left[fuel] -= take
                room -= take
            }
        }
    }
    fill(false)
    fill(true)
    return stored
}
