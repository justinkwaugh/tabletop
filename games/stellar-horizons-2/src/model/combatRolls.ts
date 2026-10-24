import { combatHits } from '../components/combatTables.js'
import { isCrewVehicle, shipDefinition } from '../components/ships.js'
import { baseEffects, resolvedAnomaly } from './anomalies.js'
import type { RollEffect } from './capabilities.js'
import {
    MAX_BASE_COMBAT,
    MODIFIER_TENTH,
    currentCombatOf,
    isGroundCombat,
    opposite,
    sideBaseSettlements,
    sideOwner,
    sideShips
} from './combat.js'
import { capabilitiesOf, combatValue, isFast } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { type HitOutcome, settleForcedHits } from './hits.js'
import {
    type Combat,
    CombatKind,
    type CombatRolls,
    CombatSide,
    type RollModifier,
    type SideRoll
} from './pieces.js'
import { roundHalfUp } from './turn.js'
import { DECADE } from './turnCycle.js'

export function modifierTotal(modifiers: readonly RollModifier[]): number {
    return modifiers.reduce((total, modifier) => total + modifier.value, 0)
}

// A Player's own modifiers of the given kinds, each named by its faction sheet or card.
export function playerRollModifiers(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    effects: readonly RollEffect[]
): RollModifier[] {
    return capabilitiesOf(state, playerId)
        .rollModifiers.filter((modifier) => effects.includes(modifier.effect))
        .map(({ source, value }) => ({ source, value }))
}

// Tunnel Complex's back: -1 to the non-fleet rolls of whoever fights a Player with a base there,
// attacking or defending (campaign plan, slice 5, Q7).
export function tunnelModifiers(
    state: HydratedStellarHorizonsGameState,
    combat: Combat,
    enemyId: string
): RollModifier[] {
    const value = baseEffects(state, combat.systemId).opponentNonFleetCombat
    const anomaly = resolvedAnomaly(state, combat.systemId)
    return combat.kind !== CombatKind.Fleet &&
        value !== undefined &&
        anomaly &&
        state.base(enemyId, combat.systemId)
        ? [{ source: { kind: 'Anomaly', anomalyId: anomaly.id }, value }]
        : []
}

// Rulebook 1.5, and the card, faction and anomaly modifiers (campaign plan, slice 5): a side's
// own, and the enemy's that count against an attacker.
function sideModifiers(
    state: HydratedStellarHorizonsGameState,
    combat: Combat,
    side: CombatSide
): RollModifier[] {
    const enemyId = sideOwner(combat, opposite(side))
    const ground = isGroundCombat(combat.kind)
    const attacking = side === CombatSide.Attacker
    const enemyEffects: RollEffect[] = attacking
        ? [
              ...(ground ? (['opponentGroundRoll'] as const) : []),
              ...(combat.kind === CombatKind.Assault ? (['opponentAssaultRaidRoll'] as const) : [])
          ]
        : []
    return [
        ...playerRollModifiers(state, sideOwner(combat, side), [
            'combatRoll',
            ...(ground ? (['groundRoll'] as const) : [])
        ]),
        ...playerRollModifiers(state, enemyId, enemyEffects),
        ...tunnelModifiers(state, combat, enemyId)
    ]
}

// Minefields' +3 for a Player defending a system where they have a base (slice 5, Q4).
function sideCombatValue(
    state: HydratedStellarHorizonsGameState,
    combat: Combat,
    side: CombatSide
): number {
    const playerId = sideOwner(combat, side)
    const minefields =
        side === CombatSide.Defender && state.base(playerId, combat.systemId)
            ? capabilitiesOf(state, playerId).defendingCombat
            : 0
    return (
        sideShips(state, combat, side).reduce(
            (total, ship) => total + combatValue(state, ship),
            0
        ) +
        Math.min(MAX_BASE_COMBAT, sideBaseSettlements(state, combat, side)) +
        minefields
    )
}

function sideRoll(
    state: HydratedStellarHorizonsGameState,
    combat: Combat,
    side: CombatSide
): SideRoll {
    const enemySide = opposite(side)
    const enemyShips =
        sideShips(state, combat, enemySide)
            .filter((ship) => isCrewVehicle(shipDefinition(ship.shipId)))
            .reduce(
                (total, ship) =>
                    total + shipDefinition(ship.shipId).size - (isFast(state, ship) ? 1 : 0),
                0
            ) / MODIFIER_TENTH
    const enemySettlements =
        Math.min(MAX_BASE_COMBAT, sideBaseSettlements(state, combat, enemySide)) / MODIFIER_TENTH
    const modifiers = sideModifiers(state, combat, side)
    const die = state.getProtectedPrng().dieRoll(10)
    const total = roundHalfUp(die + enemyShips + enemySettlements + modifierTotal(modifiers))
    const value = sideCombatValue(state, combat, side)
    return {
        die,
        enemyShips,
        enemySettlements,
        modifiers,
        total,
        combatValue: value,
        hits: combatHits(value, total)
    }
}

export interface RolledCombat {
    rolls: CombatRolls
    // The hits placed for the Players where nothing could be chosen.
    hits: HitOutcome[]
}

// Both sides roll; each side's hits land on the other's units. The attacker may decline the
// markers if a defending ship attacked them this turn or last (rulebook 1.7's exception).
export function rollCombat(state: HydratedStellarHorizonsGameState): RolledCombat {
    const combat = currentCombatOf(state)
    const attacker = sideRoll(state, combat, CombatSide.Attacker)
    const defender = sideRoll(state, combat, CombatSide.Defender)
    combat.rolls = { [CombatSide.Attacker]: attacker, [CombatSide.Defender]: defender }
    combat.hits = {
        [CombatSide.Attacker]: defender.hits,
        [CombatSide.Defender]: attacker.hits
    }
    combat.picks = 0
    combat.mayDecline = combat.forces[CombatSide.Defender].shipIds.some((shipId) =>
        state.attacks.some(
            (attack) =>
                attack.shipId === shipId &&
                attack.targetId === combat.attackerId &&
                attack.year >= state.year - DECADE
        )
    )
    return { rolls: combat.rolls, hits: settleForcedHits(state) }
}
