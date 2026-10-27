import { assertExists } from '@tabletop/common'
import { Resource } from './resources.js'

export enum PlantKind {
    Coal = 'coal',
    Oil = 'oil',
    Hybrid = 'hybrid',
    Garbage = 'garbage',
    Uranium = 'uranium',
    Ecological = 'ecological',
    Fusion = 'fusion'
}

export enum PlantBack {
    Plug = 'plug',
    Socket = 'socket'
}

export type PowerPlant = {
    number: number
    kind: PlantKind
    fuel: number
    cities: number
}

function plant(number: number, kind: PlantKind, fuel: number, cities: number): PowerPlant {
    return { number, kind, fuel, cities }
}

const { Coal, Oil, Hybrid, Garbage, Uranium, Ecological, Fusion } = PlantKind

export const POWER_PLANTS: readonly PowerPlant[] = [
    plant(3, Oil, 2, 1),
    plant(4, Coal, 2, 1),
    plant(5, Hybrid, 2, 1),
    plant(6, Garbage, 1, 1),
    plant(7, Oil, 3, 2),
    plant(8, Coal, 3, 2),
    plant(9, Oil, 1, 1),
    plant(10, Coal, 2, 2),
    plant(11, Uranium, 1, 2),
    plant(12, Hybrid, 2, 2),
    plant(13, Ecological, 0, 1),
    plant(14, Garbage, 2, 2),
    plant(15, Coal, 2, 3),
    plant(16, Oil, 2, 3),
    plant(17, Uranium, 1, 2),
    plant(18, Ecological, 0, 2),
    plant(19, Garbage, 2, 3),
    plant(20, Coal, 3, 5),
    plant(21, Hybrid, 2, 4),
    plant(22, Ecological, 0, 2),
    plant(23, Uranium, 1, 3),
    plant(24, Garbage, 2, 4),
    plant(25, Coal, 2, 5),
    plant(26, Oil, 2, 5),
    plant(27, Ecological, 0, 3),
    plant(28, Uranium, 1, 4),
    plant(29, Hybrid, 1, 4),
    plant(30, Garbage, 3, 6),
    plant(31, Coal, 3, 6),
    plant(32, Oil, 3, 6),
    plant(33, Ecological, 0, 4),
    plant(34, Uranium, 1, 5),
    plant(35, Oil, 1, 5),
    plant(36, Coal, 3, 7),
    plant(37, Ecological, 0, 4),
    plant(38, Garbage, 3, 7),
    plant(39, Uranium, 1, 6),
    plant(40, Oil, 2, 6),
    plant(42, Coal, 2, 6),
    plant(44, Ecological, 0, 5),
    plant(46, Hybrid, 3, 7),
    plant(50, Fusion, 0, 6)
]

const PLANTS_BY_NUMBER = new Map(POWER_PLANTS.map((plant) => [plant.number, plant]))

export function powerPlant(number: number): PowerPlant {
    const found = PLANTS_BY_NUMBER.get(number)
    assertExists(found, `No power plant ${number}`)
    return found
}

export function isPowerPlantNumber(number: number): boolean {
    return PLANTS_BY_NUMBER.has(number)
}

// Recharged backs: a plug on 03–15, a socket on the rest.
export const LAST_PLUG_PLANT = 15

export function plantBack(number: number): PlantBack {
    return number <= LAST_PLUG_PLANT ? PlantBack.Plug : PlantBack.Socket
}

export function plantResources(kind: PlantKind): readonly Resource[] {
    switch (kind) {
        case PlantKind.Coal:
            return [Resource.Coal]
        case PlantKind.Oil:
            return [Resource.Oil]
        case PlantKind.Hybrid:
            return [Resource.Coal, Resource.Oil]
        case PlantKind.Garbage:
            return [Resource.Garbage]
        case PlantKind.Uranium:
            return [Resource.Uranium]
        case PlantKind.Ecological:
        case PlantKind.Fusion:
            return []
    }
}

export function needsFuel(plant: PowerPlant): boolean {
    return plant.fuel > 0
}

export function storageCapacity(plant: PowerPlant): number {
    return plant.fuel * 2
}
