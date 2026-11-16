import * as Type from 'typebox'
import { LocomotiveId, LocomotiveKind, generationsOf, locomotiveData } from './locomotives.js'

// A locomotive's space on the board: its dice and the cards still in the supply.
export type LocomotiveSpace = Type.Static<typeof LocomotiveSpace>
export const LocomotiveSpace = Type.Object({
    locomotiveId: Type.Enum(LocomotiveId),
    initialOrder: Type.Optional(Type.Number()),
    existingOrders: Type.Array(Type.Number()),
    customerBase: Type.Array(Type.Number()),
    cards: Type.Number()
})

export enum SaleOutcome {
    // The units shipped equal a die: that die moves to the Customer Base.
    Matched = 'Matched',
    // Fewer units than the highest die and none equal: the highest die drops by the units.
    Reduced = 'Reduced',
    // More units than the highest die: that many ship and the die moves to the Customer Base.
    Exceeded = 'Exceeded'
}

export type SalePlan = {
    units: number
    face: number
    outcome: SaleOutcome
}

export function planSale(
    existingOrders: readonly number[],
    available: number
): SalePlan | undefined {
    if (existingOrders.length === 0 || available <= 0) {
        return undefined
    }
    if (existingOrders.includes(available)) {
        return { units: available, face: available, outcome: SaleOutcome.Matched }
    }
    const highest = Math.max(...existingOrders)
    return available < highest
        ? { units: available, face: highest, outcome: SaleOutcome.Reduced }
        : { units: highest, face: highest, outcome: SaleOutcome.Exceeded }
}

export function applySale(space: LocomotiveSpace, plan: SalePlan) {
    const index = space.existingOrders.indexOf(plan.face)
    if (plan.outcome === SaleOutcome.Reduced) {
        space.existingOrders[index] = plan.face - plan.units
        return
    }
    space.existingOrders.splice(index, 1)
    space.customerBase.push(plan.face)
}

export function diceOnSpace(space: LocomotiveSpace): number {
    return (
        space.existingOrders.length +
        space.customerBase.length +
        (space.initialOrder === undefined ? 0 : 1)
    )
}

export function generationExists(space: LocomotiveSpace): boolean {
    return space.existingOrders.length + space.customerBase.length > 0
}

export enum DemandChange {
    Grown = 'Grown',
    Shrunk = 'Shrunk',
    Filled = 'Filled',
    Obsolete = 'Obsolete'
}

export type MarketStep = Type.Static<typeof MarketStep>
export const MarketStep = Type.Object({
    locomotiveId: Type.Enum(LocomotiveId),
    change: Type.Enum(DemandChange),
    added: Type.Number(),
    returned: Type.Number(),
    rolls: Type.Array(Type.Number())
})

export type DicePool = {
    available(): number
    roll(): number
}

function rollCustomerBase(space: LocomotiveSpace, pool: DicePool): number[] {
    const rolls = space.customerBase.map(() => pool.roll())
    space.customerBase = []
    space.existingOrders.push(...rolls)
    return rolls
}

function addDice(space: LocomotiveSpace, wanted: number, pool: DicePool): number {
    const added = Math.max(0, Math.min(wanted, pool.available()))
    space.customerBase.push(...Array.from({ length: added }, () => 0))
    return added
}

function demand(space: LocomotiveSpace): number {
    return space.existingOrders.length + space.customerBase.length
}

function grow(space: LocomotiveSpace, pool: DicePool): MarketStep {
    const room = locomotiveData(space.locomotiveId).customerBaseBoxes - demand(space)
    const added = addDice(space, Math.min(1, room), pool)
    return {
        locomotiveId: space.locomotiveId,
        change: DemandChange.Grown,
        added,
        returned: 0,
        rolls: rollCustomerBase(space, pool)
    }
}

function fill(space: LocomotiveSpace, pool: DicePool): MarketStep {
    const room = locomotiveData(space.locomotiveId).customerBaseBoxes - demand(space)
    const added = addDice(space, room, pool)
    return {
        locomotiveId: space.locomotiveId,
        change: DemandChange.Filled,
        added,
        returned: 0,
        rolls: rollCustomerBase(space, pool)
    }
}

function shrink(space: LocomotiveSpace, pool: DicePool): MarketStep {
    if (space.customerBase.length > 0) {
        space.customerBase.pop()
    } else {
        const lowest = Math.min(...space.existingOrders)
        space.existingOrders.splice(space.existingOrders.indexOf(lowest), 1)
    }
    return {
        locomotiveId: space.locomotiveId,
        change: DemandChange.Shrunk,
        added: 0,
        returned: 1,
        rolls: rollCustomerBase(space, pool)
    }
}

function retire(space: LocomotiveSpace): MarketStep {
    const returned = demand(space)
    space.existingOrders = []
    space.customerBase = []
    return {
        locomotiveId: space.locomotiveId,
        change: DemandChange.Obsolete,
        added: 0,
        returned,
        rolls: []
    }
}

// Market Demands for one kind, oldest generation first. The rules cover up to three generations;
// with more, every generation older than the newest two is obsolete like the oldest of three.
export function adjustDemand(
    kind: LocomotiveKind,
    spaceOf: (locomotiveId: LocomotiveId) => LocomotiveSpace,
    pool: DicePool
): MarketStep[] {
    const existing = generationsOf(kind)
        .map((locomotive) => spaceOf(locomotive.id))
        .filter(generationExists)
    if (existing.length === 0) {
        return []
    }
    const newest = existing[existing.length - 1]
    if (existing.length === 1) {
        return [grow(newest, pool)]
    }
    if (existing.length === 2) {
        return [shrink(existing[0], pool), grow(newest, pool)]
    }
    const middle = existing[existing.length - 2]
    return [...existing.slice(0, -2).map(retire), fill(middle, pool), grow(newest, pool)]
}
