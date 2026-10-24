import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { DirectiveAttack, DirectiveType } from '../components/directives.js'
import { shipDefinition, ShipKind } from '../components/ships.js'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { arrivedShipsIn, clearFoughtCombat, crewVehiclesIn, currentCombatOf } from './combat.js'
import { rollCombat } from './combatRolls.js'
import { recordTurnProgress } from './turnRecord.js'
import { canAttack } from './escalation.js'
import {
    capabilitiesOf,
    currentCombat,
    drewMarkers,
    hasArrived,
    isCrippled,
    loseShipNow
} from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { HitOutcome } from './hits.js'
import {
    type Combat,
    CombatKind,
    CombatLoss,
    CombatRolls,
    CombatSide,
    FulfilledDirective,
    RaidOutcome,
    RaidRoll,
    type ShipState
} from './pieces.js'
import { raidChoices, resolveRaid, rollRaid } from './raids.js'
import { recordAttack } from './turnRecord.js'

function isArmed(ship: ShipState): boolean {
    return currentCombat(ship) > 0
}

// Rulebook 1.3 and 1.6: only armed CVs attack, and never crippled ones; a raider is undamaged.
function attackingShips(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): ShipState[] {
    return crewVehiclesIn(state, playerId, systemId).filter(
        (ship) => isArmed(ship) && !isCrippled(state, ship)
    )
}

export interface AttackOption {
    kind: CombatKind
    systemId: string
    defenderId: string
    shipIds: string[]
    // The REs an Explorer attack may destroy.
    explorerIds: string[]
}

// Every attack a Player could start: one combat in each system where they have arrived ships or
// a base (rulebook 1.3), an RE attack being that system's combat (campaign plan, slice 5, Q6).
export function attackOptions(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): AttackOption[] {
    if (!canAttack(state, playerId)) {
        return []
    }
    const systemIds = new Set([
        ...state
            .shipsOf(playerId)
            .filter((ship) => hasArrived(ship))
            .map((ship) => ship.systemId),
        ...state.basesOf(playerId).map((base) => base.systemId)
    ])
    const attacked = state.systemAttacks
        .filter((attack) => attack.playerId === playerId)
        .map((attack) => attack.systemId)
    return [...systemIds]
        .toSorted()
        .filter((systemId) => !attacked.includes(systemId))
        .flatMap((systemId) => systemAttackOptions(state, playerId, systemId))
}

function systemAttackOptions(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): AttackOption[] {
    const attackers = attackingShips(state, playerId, systemId).map((ship) => ship.shipId)
    const raiders = attackingShips(state, playerId, systemId)
        .filter((ship) => ship.damage === 0)
        .map((ship) => ship.shipId)
    const ownBase = state.base(playerId, systemId)
    const capabilities = capabilitiesOf(state, playerId)
    return attackablePlayers(state, playerId).flatMap((other) => {
        const defenderId = other.playerId
        const cvs = crewVehiclesIn(state, defenderId, systemId)
        const base = state.base(defenderId, systemId)
        const option = (kind: CombatKind, shipIds: string[], explorerIds: string[] = []) => ({
            kind,
            systemId,
            defenderId,
            shipIds,
            explorerIds
        })
        const options: AttackOption[] = []
        if (attackers.length > 0 && cvs.length > 0) {
            options.push(option(CombatKind.Fleet, attackers))
        }
        if (attackers.length > 0 && base) {
            options.push(option(CombatKind.Assault, attackers))
        }
        if (ownBase && base) {
            options.push(option(CombatKind.Ground, []))
        }
        if (
            raiders.length > 0 &&
            !capabilities.cannotRaid &&
            base &&
            !capabilitiesOf(state, defenderId).raidImmune &&
            !cvs.some(isArmed)
        ) {
            options.push(option(CombatKind.Raid, raiders))
        }
        const explorers = arrivedShipsIn(state, defenderId, systemId).filter(
            (ship) => shipDefinition(ship.shipId).kind === ShipKind.RE
        )
        if (
            systemId !== SOL_SYSTEM_ID &&
            attackers.length > 0 &&
            !base &&
            cvs.length === 0 &&
            explorers.length > 0
        ) {
            options.push(
                option(
                    CombatKind.Explorer,
                    attackers,
                    explorers.map((ship) => ship.shipId)
                )
            )
        }
        return options
    })
}

// Rulebook 5.2's Admiral can only attack, or blockade (slice 5, Q5), Players who have more
// escalation markers.
export function attackablePlayers(state: HydratedStellarHorizonsGameState, playerId: string) {
    const markers = state.getPlayerState(playerId).escalation.length
    return capabilitiesOf(state, playerId).attacksOnlyMoreEscalation
        ? state.otherPlayers(playerId).filter((other) => other.escalation.length > markers)
        : state.otherPlayers(playerId)
}

export function canAttackAnywhere(state: HydratedStellarHorizonsGameState, playerId: string) {
    return attackOptions(state, playerId).length > 0
}

export function queueAttackers(state: HydratedStellarHorizonsGameState) {
    state.systemAttacks = []
    state.remainingAttackers = state
        .initiativeOrder()
        .filter((playerId) => canAttackAnywhere(state, playerId))
}

export function dropIdleAttackers(state: HydratedStellarHorizonsGameState) {
    while (state.remainingAttackers.length > 0) {
        const [playerId] = state.remainingAttackers
        if (state.escalationDiscard?.playerId === playerId || canAttackAnywhere(state, playerId)) {
            return
        }
        state.remainingAttackers = state.remainingAttackers.slice(1)
    }
}

export type AttackDeclaration = Type.Static<typeof AttackDeclaration>
export const AttackDeclaration = Type.Object({
    kind: Type.Enum(CombatKind),
    systemId: Type.String(),
    defenderId: Type.String(),
    shipIds: Type.Array(Type.String()),
    explorerId: Type.Optional(Type.String())
})

// A declaration with the RE named only for an RE attack.
export function attackDeclaration(fields: {
    kind: CombatKind
    systemId: string
    defenderId: string
    shipIds: readonly string[]
    explorerId?: string
}): AttackDeclaration {
    const { kind, systemId, defenderId, shipIds, explorerId } = fields
    return {
        kind,
        systemId,
        defenderId,
        shipIds: [...shipIds],
        ...(explorerId !== undefined ? { explorerId } : {})
    }
}

// The option a declaration would take up: its kind of combat against its defender in its system.
export function attackOptionFor(
    options: readonly AttackOption[],
    declaration: Pick<AttackDeclaration, 'kind' | 'systemId' | 'defenderId'>
): AttackOption | undefined {
    return options.find(
        (candidate) =>
            candidate.kind === declaration.kind &&
            candidate.systemId === declaration.systemId &&
            candidate.defenderId === declaration.defenderId
    )
}

export function isValidAttack(
    state: HydratedStellarHorizonsGameState,
    attackerId: string,
    declaration: AttackDeclaration
): boolean {
    const option = attackOptionFor(attackOptions(state, attackerId), declaration)
    if (!option) {
        return false
    }
    const ships = declaration.shipIds
    const chosen =
        new Set(ships).size === ships.length &&
        ships.every((shipId) => option.shipIds.includes(shipId))
    switch (declaration.kind) {
        case CombatKind.Fleet:
        case CombatKind.Assault:
            return chosen && ships.length > 0
        case CombatKind.Ground:
            return ships.length === 0
        case CombatKind.Raid:
            return chosen && ships.length === 1
        case CombatKind.Explorer:
            return (
                chosen &&
                ships.length === 1 &&
                declaration.explorerId !== undefined &&
                option.explorerIds.includes(declaration.explorerId)
            )
    }
}

// What the defender may still choose before the dice: the base in a fleet combat, or the CVs
// that join an assault or ground combat.
export function defenderCanAnswer(state: HydratedStellarHorizonsGameState, combat: Combat) {
    switch (combat.kind) {
        case CombatKind.Fleet:
            return state.base(combat.defenderId, combat.systemId) !== undefined
        case CombatKind.Assault:
        case CombatKind.Ground:
            return crewVehiclesIn(state, combat.defenderId, combat.systemId).length > 0
        default:
            return false
    }
}

export function defendingShipOptions(state: HydratedStellarHorizonsGameState, combat: Combat) {
    return crewVehiclesIn(state, combat.defenderId, combat.systemId).map((ship) => ship.shipId)
}

export type DeclaredAttack = Type.Static<typeof DeclaredAttack>
export const DeclaredAttack = Type.Object({
    rolls: Type.Optional(CombatRolls),
    hits: Type.Array(HitOutcome),
    raid: Type.Optional(RaidRoll),
    raidOutcome: Type.Optional(RaidOutcome),
    explorerLoss: Type.Optional(CombatLoss),
    directives: Type.Optional(Type.Array(FulfilledDirective))
})

// The dice rolled, or markers drawn, as the attack was declared or answered.
export function revealsAttackDraws(declared: DeclaredAttack): boolean {
    return (
        declared.rolls !== undefined ||
        declared.raid !== undefined ||
        drewMarkers(declared.explorerLoss)
    )
}

// A fleet combat's defence is every CV the defender has there; an RE attack's is the RE. An
// assault's and a ground combat's are chosen by the defender.
function defendingShips(
    state: HydratedStellarHorizonsGameState,
    declaration: AttackDeclaration
): string[] {
    switch (declaration.kind) {
        case CombatKind.Fleet:
            return crewVehiclesIn(state, declaration.defenderId, declaration.systemId).map(
                (ship) => ship.shipId
            )
        case CombatKind.Explorer:
            return declaration.explorerId === undefined ? [] : [declaration.explorerId]
        default:
            return []
    }
}

// The attack begins: every attacking ship's attack is recorded for rulebook 1.7's exception.
export function declareAttack(
    state: HydratedStellarHorizonsGameState,
    attackerId: string,
    declaration: AttackDeclaration
): DeclaredAttack {
    const { kind, systemId, defenderId, shipIds } = declaration
    clearFoughtCombat(state)
    recordAttack(state, attackerId, defenderId)
    state.systemAttacks.push({ playerId: attackerId, systemId })
    for (const shipId of shipIds) {
        state.attacks.push({ shipId, targetId: defenderId, year: state.year })
    }
    const combat: Combat = {
        kind,
        systemId,
        attackerId,
        defenderId,
        forces: {
            [CombatSide.Attacker]: { shipIds: [...shipIds], base: kind === CombatKind.Ground },
            [CombatSide.Defender]: {
                shipIds: defendingShips(state, declaration),
                base: kind !== CombatKind.Fleet && kind !== CombatKind.Explorer
            }
        },
        hits: { [CombatSide.Attacker]: 0, [CombatSide.Defender]: 0 },
        picks: 0,
        defenderLosses: { shipIds: [], settlements: 0, baseEliminated: false },
        mayDecline: false
    }
    state.combat = combat
    const directive = recordAttackDirective(state, attackerId, declaration)
    const declared = startCombat(state, combat, declaration)
    return directive ? { ...declared, directives: [directive] } : declared
}

// Rulebook 5.1's combat directives are met as the raid or fleet combat is declared.
function recordAttackDirective(
    state: HydratedStellarHorizonsGameState,
    attackerId: string,
    declaration: AttackDeclaration
): FulfilledDirective | undefined {
    const attack =
        declaration.kind === CombatKind.Raid
            ? DirectiveAttack.Raid
            : declaration.kind === CombatKind.Fleet
              ? DirectiveAttack.FleetCombat
              : undefined
    return attack === undefined
        ? undefined
        : recordTurnProgress(state, attackerId, {
              kind: DirectiveType.Combat,
              attack,
              targetId: declaration.defenderId
          })
}

function startCombat(
    state: HydratedStellarHorizonsGameState,
    combat: Combat,
    declaration: AttackDeclaration
): DeclaredAttack {
    switch (declaration.kind) {
        case CombatKind.Explorer: {
            assertExists(declaration.explorerId, 'An RE attack names the RE')
            const explorerLoss = loseShipNow(state, state.ship(declaration.explorerId))
            return { hits: [], explorerLoss }
        }
        case CombatKind.Raid: {
            const raid = rollRaid(state, combat)
            const choices = raidChoices(state)
            return choices.length === 1
                ? { hits: [], raid, raidOutcome: resolveRaid(state, choices[0]) }
                : { hits: [], raid }
        }
        default:
            return defenderCanAnswer(state, combat) ? { hits: [] } : rollCombat(state)
    }
}

export function answerAttack(
    state: HydratedStellarHorizonsGameState,
    includeBase: boolean,
    shipIds: readonly string[]
): DeclaredAttack {
    const combat = currentCombatOf(state)
    const defence = combat.forces[CombatSide.Defender]
    if (combat.kind === CombatKind.Fleet) {
        defence.base = includeBase
    } else {
        defence.shipIds = [...shipIds]
    }
    return rollCombat(state)
}

export function isValidAnswer(
    state: HydratedStellarHorizonsGameState,
    includeBase: boolean,
    shipIds: readonly string[]
): boolean {
    const combat = state.combat
    if (!combat || combat.rolls || !defenderCanAnswer(state, combat)) {
        return false
    }
    if (combat.kind === CombatKind.Fleet) {
        return shipIds.length === 0
    }
    const options = defendingShipOptions(state, combat)
    return (
        !includeBase &&
        new Set(shipIds).size === shipIds.length &&
        shipIds.every((shipId) => options.includes(shipId))
    )
}
