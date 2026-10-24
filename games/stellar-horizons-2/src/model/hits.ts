import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { type ShipDefinition, shipDefinition } from '../components/ships.js'
import {
    currentCombatOf,
    opposite,
    sideBaseSettlements,
    sideBeingHit,
    sideOwner,
    sideShips
} from './combat.js'
import { damageCapacity, loseShipNow } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { type Combat, CombatLoss, CombatSide } from './pieces.js'
import { removeBaseSettlement } from './settling.js'

export type HitTarget = Type.Static<typeof HitTarget>
export const HitTarget = Type.Union([
    Type.Object({ kind: Type.Literal('Ship'), shipId: Type.String() }),
    Type.Object({ kind: Type.Literal('Base') })
])

export type HitOutcome = Type.Static<typeof HitOutcome>
export const HitOutcome = Type.Object({
    side: Type.Enum(CombatSide),
    target: HitTarget,
    // Chosen by this Player; absent where nothing could be chosen.
    chooserId: Type.Optional(Type.String()),
    lost: Type.Optional(CombatLoss),
    baseEliminated: Type.Boolean()
})

export function sameHitTarget(a: HitTarget, b: HitTarget): boolean {
    return a.kind === 'Base' ? b.kind === 'Base' : b.kind === 'Ship' && a.shipId === b.shipId
}

// Rulebook 1.5: on each side's units, the owner and the other side take turns choosing where
// the hits go, the owner first.
export function hitChooser(combat: Combat): string | undefined {
    const side = sideBeingHit(combat)
    if (side === undefined) {
        return undefined
    }
    return combat.picks % 2 === 0 ? sideOwner(combat, side) : sideOwner(combat, opposite(side))
}

export function hitTargets(state: HydratedStellarHorizonsGameState): HitTarget[] {
    const combat = currentCombatOf(state)
    const side = sideBeingHit(combat)
    if (side === undefined) {
        return []
    }
    const ships: HitTarget[] = sideShips(state, combat, side).map((ship) => ({
        kind: 'Ship',
        shipId: ship.shipId
    }))
    return sideBaseSettlements(state, combat, side) > 0 ? [...ships, { kind: 'Base' }] : ships
}

function remainingCapacity(
    state: HydratedStellarHorizonsGameState,
    combat: Combat,
    side: CombatSide,
    target: HitTarget
): number {
    if (target.kind === 'Base') {
        return sideBaseSettlements(state, combat, side)
    }
    const ship = state.ship(target.shipId)
    return damageCapacity(state, ship) - ship.damage
}

// Two counters printed alike but for their names.
function samePrinting(a: ShipDefinition, b: ShipDefinition): boolean {
    return (Object.keys(a) as (keyof ShipDefinition)[]).every(
        (key) => key === 'id' || key === 'name' || a[key] === b[key]
    )
}

// Targets a choice could not tell apart: settlements of one base, or ships alike in every
// respect a hit could matter to.
function alike(state: HydratedStellarHorizonsGameState, a: HitTarget, b: HitTarget): boolean {
    if (a.kind === 'Base' || b.kind === 'Base') {
        return a.kind === b.kind
    }
    const first = state.ship(a.shipId)
    const second = state.ship(b.shipId)
    const firstGoods = first.goods.toSorted()
    const secondGoods = second.goods.toSorted()
    return (
        samePrinting(shipDefinition(first.shipId), shipDefinition(second.shipId)) &&
        first.damage === second.damage &&
        first.settlements === second.settlements &&
        firstGoods.length === secondGoods.length &&
        firstGoods.every((good, index) => good === secondGoods[index])
    )
}

export function isValidHitTarget(
    state: HydratedStellarHorizonsGameState,
    target: HitTarget
): boolean {
    return hitTargets(state).some((candidate) => sameHitTarget(candidate, target))
}

export function assignHit(
    state: HydratedStellarHorizonsGameState,
    target: HitTarget,
    chooserId?: string
): HitOutcome {
    const combat = currentCombatOf(state)
    const side = sideBeingHit(combat)
    assertExists(side, 'No hits are left to assign')
    const defending = side === CombatSide.Defender
    let lost: CombatLoss | undefined
    let baseEliminated = false
    if (target.kind === 'Ship') {
        const ship = state.ship(target.shipId)
        ship.damage += 1
        if (ship.damage >= damageCapacity(state, ship)) {
            lost = loseShipNow(state, ship)
            if (defending) {
                combat.defenderLosses.shipIds.push(ship.shipId)
                combat.defenderLosses.settlements += lost.settlementsLost
            }
        }
    } else {
        const playerId = sideOwner(combat, side)
        removeBaseSettlement(state, playerId, combat.systemId)
        baseEliminated = state.base(playerId, combat.systemId) === undefined
        if (defending) {
            combat.defenderLosses.settlements += 1
            combat.defenderLosses.baseEliminated ||= baseEliminated
        }
    }
    combat.hits[side] -= 1
    combat.picks += 1
    if (combat.hits[side] === 0) {
        combat.picks = 0
    }
    return {
        side,
        target,
        ...(chooserId ? { chooserId } : {}),
        ...(lost ? { lost } : {}),
        baseEliminated
    }
}

// Hits are placed for the Players wherever the choice cannot matter (campaign plan, slice 5,
// Q9): one kind of target left, or enough hits to destroy every unit. Hits with nothing left to
// take them are lost.
export function settleForcedHits(state: HydratedStellarHorizonsGameState): HitOutcome[] {
    const outcomes: HitOutcome[] = []
    for (;;) {
        const combat = currentCombatOf(state)
        const side = sideBeingHit(combat)
        if (side === undefined) {
            return outcomes
        }
        const targets = hitTargets(state)
        if (targets.length === 0) {
            combat.hits[side] = 0
            combat.picks = 0
            continue
        }
        const capacity = targets.reduce(
            (total, target) => total + remainingCapacity(state, combat, side, target),
            0
        )
        const [first] = targets
        const oneKind = targets.every((target) => alike(state, first, target))
        if (combat.hits[side] < capacity && !oneKind) {
            return outcomes
        }
        outcomes.push(assignHit(state, first))
    }
}
