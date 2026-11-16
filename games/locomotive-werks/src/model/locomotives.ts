import { assertExists } from '@tabletop/common'

export enum LocomotiveKind {
    Passenger = 'Passenger',
    Fast = 'Fast',
    Freight = 'Freight',
    Special = 'Special'
}

export enum LocomotiveId {
    Passenger1 = 'passenger-1',
    Fast1 = 'fast-1',
    Freight1 = 'freight-1',
    Special1 = 'special-1',
    Passenger2 = 'passenger-2',
    Fast2 = 'fast-2',
    Freight2 = 'freight-2',
    Passenger3 = 'passenger-3',
    Special2 = 'special-2',
    Fast3 = 'fast-3',
    Passenger4 = 'passenger-4',
    Freight3 = 'freight-3',
    Fast4 = 'fast-4',
    Passenger5 = 'passenger-5'
}

export type Locomotive = {
    id: LocomotiveId
    kind: LocomotiveKind
    generation: number
    developmentCost: number
    productionCost: number
    income: number
    // Customer Base boxes, which are also the most dice the locomotive's market may hold.
    customerBaseBoxes: number
    cards: number
}

function locomotive(
    id: LocomotiveId,
    kind: LocomotiveKind,
    generation: number,
    developmentCost: number,
    customerBaseBoxes: number,
    cards: number
): Locomotive {
    return {
        id,
        kind,
        generation,
        developmentCost,
        productionCost: developmentCost / 2,
        income: developmentCost / 4,
        customerBaseBoxes,
        cards
    }
}

// The board's chain: each locomotive's development rolls the next one's Initial Orders die.
export const LOCOMOTIVES: readonly Locomotive[] = [
    locomotive(LocomotiveId.Passenger1, LocomotiveKind.Passenger, 1, 4, 3, 4),
    locomotive(LocomotiveId.Fast1, LocomotiveKind.Fast, 1, 8, 3, 3),
    locomotive(LocomotiveId.Freight1, LocomotiveKind.Freight, 1, 12, 2, 2),
    locomotive(LocomotiveId.Special1, LocomotiveKind.Special, 1, 16, 1, 1),
    locomotive(LocomotiveId.Passenger2, LocomotiveKind.Passenger, 2, 20, 4, 4),
    locomotive(LocomotiveId.Fast2, LocomotiveKind.Fast, 2, 24, 3, 3),
    locomotive(LocomotiveId.Freight2, LocomotiveKind.Freight, 2, 28, 3, 2),
    locomotive(LocomotiveId.Passenger3, LocomotiveKind.Passenger, 3, 32, 4, 4),
    locomotive(LocomotiveId.Special2, LocomotiveKind.Special, 2, 36, 2, 2),
    locomotive(LocomotiveId.Fast3, LocomotiveKind.Fast, 3, 40, 4, 3),
    locomotive(LocomotiveId.Passenger4, LocomotiveKind.Passenger, 4, 44, 5, 4),
    locomotive(LocomotiveId.Freight3, LocomotiveKind.Freight, 3, 48, 3, 3),
    locomotive(LocomotiveId.Fast4, LocomotiveKind.Fast, 4, 52, 4, 4),
    locomotive(LocomotiveId.Passenger5, LocomotiveKind.Passenger, 5, 56, 5, 4)
]

// Market Demands treats the kinds in this order.
export const MARKET_ORDER: readonly LocomotiveKind[] = [
    LocomotiveKind.Passenger,
    LocomotiveKind.Fast,
    LocomotiveKind.Freight,
    LocomotiveKind.Special
]

export const DICE = 20
export const WINNING_CASH = 300

export function locomotiveData(locomotiveId: LocomotiveId): Locomotive {
    const found = LOCOMOTIVES.find((candidate) => candidate.id === locomotiveId)
    assertExists(found, `Unknown locomotive ${locomotiveId}`)
    return found
}

export function chainIndex(locomotiveId: LocomotiveId): number {
    return LOCOMOTIVES.findIndex((candidate) => candidate.id === locomotiveId)
}

export function nextInChain(locomotiveId: LocomotiveId): Locomotive | undefined {
    return LOCOMOTIVES[chainIndex(locomotiveId) + 1]
}

export function generationsOf(kind: LocomotiveKind): Locomotive[] {
    return LOCOMOTIVES.filter((candidate) => candidate.kind === kind)
}

// Production units move only to newer technology, which the chain lists later.
export function isNewer(to: LocomotiveId, from: LocomotiveId): boolean {
    return chainIndex(to) > chainIndex(from)
}
