import { assertExists } from '@tabletop/common'
import { isCrewVehicle, shipDefinition } from '../components/ships.js'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { gainInfluence } from './campaign.js'
import { drawEscalation } from './escalation.js'
import { hasArrived } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import {
    type Combat,
    CombatKind,
    type CombatOutcome,
    CombatSide,
    type ShipState
} from './pieces.js'
import { roundHalfUp } from './turn.js'

// The combat being fought, which the attack (attacks.ts), the rolls (combatRolls.ts), the hits
// (hits.ts) and raids (raids.ts) share, and how it ends.

// Rulebook 1.5: a base fights with its settlements, up to 30; the die is modified by a tenth of
// the enemy CVs' sizes and settlements.
export const MAX_BASE_COMBAT = 30
export const MODIFIER_TENTH = 10

const GROUND_KINDS: readonly CombatKind[] = [CombatKind.Assault, CombatKind.Ground]
const BATTLE_KINDS: readonly CombatKind[] = [
    CombatKind.Fleet,
    CombatKind.Assault,
    CombatKind.Ground
]

export function isBattle(kind: CombatKind): boolean {
    return BATTLE_KINDS.includes(kind)
}

export function isGroundCombat(kind: CombatKind): boolean {
    return GROUND_KINDS.includes(kind)
}

export function arrivedShipsIn(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): ShipState[] {
    return state.shipsOf(playerId).filter((ship) => ship.systemId === systemId && hasArrived(ship))
}

export function crewVehiclesIn(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): ShipState[] {
    return arrivedShipsIn(state, playerId, systemId).filter((ship) =>
        isCrewVehicle(shipDefinition(ship.shipId))
    )
}

export function currentCombatOf(state: HydratedStellarHorizonsGameState): Combat {
    const combat = state.combat
    assertExists(combat, 'No combat is being fought')
    return combat
}

export function sideOwner(combat: Combat, side: CombatSide): string {
    return side === CombatSide.Attacker ? combat.attackerId : combat.defenderId
}

export function opposite(side: CombatSide): CombatSide {
    return side === CombatSide.Attacker ? CombatSide.Defender : CombatSide.Attacker
}

// A side's ships still in the combat; those destroyed are gone from the state.
export function sideShips(
    state: HydratedStellarHorizonsGameState,
    combat: Combat,
    side: CombatSide
): ShipState[] {
    return combat.forces[side].shipIds.flatMap((shipId) => {
        const ship = state.findShip(shipId)
        return ship ? [ship] : []
    })
}

// Ships a side has lost in the combat so far.
export function lostShipIds(
    state: HydratedStellarHorizonsGameState,
    combat: Combat,
    side: CombatSide
): string[] {
    return combat.forces[side].shipIds.filter((shipId) => state.findShip(shipId) === undefined)
}

export function sideBaseSettlements(
    state: HydratedStellarHorizonsGameState,
    combat: Combat,
    side: CombatSide
): number {
    return combat.forces[side].base
        ? (state.base(sideOwner(combat, side), combat.systemId)?.settlements ?? 0)
        : 0
}

// Rulebook 1.5: hits on the attacker's units are assigned first, then the defender's.
export function sideBeingHit(combat: Combat): CombatSide | undefined {
    if (combat.hits[CombatSide.Attacker] > 0) {
        return CombatSide.Attacker
    }
    return combat.hits[CombatSide.Defender] > 0 ? CombatSide.Defender : undefined
}

// Rulebook 1.7: 1 for any combat but a raid with no effect, +1 per defending CV destroyed, +0.5
// per settlement destroyed, +2 for eliminating the base and +2 at Sol, rounded once. Only the
// defender's losses count, as in the Player Guide's example.
export function owedEscalation(combat: Combat): number {
    if (combat.kind === CombatKind.Raid && !combat.raidOutcome?.effective) {
        return 0
    }
    const losses = combat.defenderLosses
    return roundHalfUp(
        1 +
            losses.shipIds.length +
            losses.settlements / 2 +
            (losses.baseEliminated ? 2 : 0) +
            (combat.systemId === SOL_SYSTEM_ID ? 2 : 0)
    )
}

// The attacker draws the markers owed and the defender gains as many IP, unless the attacker
// declines both under rulebook 1.7's exception. The combat stays in view until the next.
export function endCombat(
    state: HydratedStellarHorizonsGameState,
    declined: boolean
): CombatOutcome {
    const combat = currentCombatOf(state)
    const owed = owedEscalation(combat)
    state.combat = undefined
    let outcome: CombatOutcome = { owed, declined, influence: 0 }
    if (!declined) {
        const escalation = drawEscalation(state, combat.attackerId, owed)
        gainInfluence(state, combat.defenderId, owed)
        outcome = { owed, declined, escalation, influence: owed }
    }
    state.foughtCombat = { ...combat, outcome }
    return outcome
}

// The combat just fought stops being shown once another begins or the movement phase ends.
export function clearFoughtCombat(state: HydratedStellarHorizonsGameState) {
    state.foughtCombat = undefined
}

export function isCombatOver(combat: Combat): boolean {
    switch (combat.kind) {
        case CombatKind.Explorer:
            return true
        case CombatKind.Raid:
            return combat.raidOutcome !== undefined
        default:
            return combat.rolls !== undefined && sideBeingHit(combat) === undefined
    }
}
