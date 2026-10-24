import * as Type from 'typebox'
import { blocksBases } from './anomalies.js'
import { gainInfluence } from './campaign.js'
import { canAttack, drawEscalation } from './escalation.js'
import { halts } from './events.js'
import { capabilitiesOf, fleetCombatIn, hasArrived } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { type Base, type Blockade, BlockadeStep, EscalationDraw } from './pieces.js'

// Rulebook 4.4 and 4.6: before base production, and before growth and migration, Players may
// blockade other Players' bases in reverse initiative order. Each blockaded base draws its
// blockader an escalation marker and gives its owner 1 IP.
export const BLOCKADE_ESCALATION = 1
export const BLOCKADE_INFLUENCE = 1

export function blockadeOf(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): Blockade | undefined {
    return state.blockades.find(
        (blockade) => blockade.systemId === systemId && blockade.targetIds.includes(playerId)
    )
}

export function isBlockaded(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): boolean {
    return blockadeOf(state, playerId, systemId) !== undefined
}

// What a blockader's ships must beat: the target's ships' combat value and settlements there,
// with Minefields' +3 for a Player defending a system where they have a base (slice 5, Q4).
export function blockadeDefence(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): number {
    const base = state.base(playerId, systemId)
    return (
        fleetCombatIn(state, playerId, systemId) +
        (base ? base.settlements + capabilitiesOf(state, playerId).defendingCombat : 0)
    )
}

// Bases a Player could still blockade in a system: other Players' bases not yet blockaded,
// where the step does something. A Player declares once per system, naming every base at once.
export function blockadeableBases(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): Base[] {
    if (
        !canAttack(state, playerId) ||
        blocksBases(state, systemId) ||
        halts(state, systemId) ||
        state.blockades.some(
            (blockade) => blockade.playerId === playerId && blockade.systemId === systemId
        )
    ) {
        return []
    }
    return state
        .allBases()
        .filter(
            (base) =>
                base.systemId === systemId &&
                base.playerId !== playerId &&
                !isBlockaded(state, base.playerId, systemId)
        )
}

export function combinedDefence(
    state: HydratedStellarHorizonsGameState,
    targetIds: readonly string[],
    systemId: string
): number {
    return targetIds.reduce(
        (total, targetId) => total + blockadeDefence(state, targetId, systemId),
        0
    )
}

export function canBlockade(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    targetIds: readonly string[]
): boolean {
    const bases = blockadeableBases(state, playerId, systemId)
    return (
        targetIds.length > 0 &&
        new Set(targetIds).size === targetIds.length &&
        targetIds.every((targetId) => bases.some((base) => base.playerId === targetId)) &&
        fleetCombatIn(state, playerId, systemId) > combinedDefence(state, targetIds, systemId)
    )
}

export function blockadeSystems(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): string[] {
    const systemIds = new Set(
        state
            .shipsOf(playerId)
            .filter((ship) => hasArrived(ship))
            .map((ship) => ship.systemId)
    )
    return [...systemIds]
        .toSorted()
        .filter((systemId) =>
            blockadeableBases(state, playerId, systemId).some((base) =>
                canBlockade(state, playerId, systemId, [base.playerId])
            )
        )
}

export function queueBlockades(state: HydratedStellarHorizonsGameState, step: BlockadeStep) {
    state.blockadeStep = step
    state.blockades = []
    state.remainingBlockaders = state
        .initiativeOrder()
        .toReversed()
        .filter((playerId) => blockadeSystems(state, playerId).length > 0)
}

export function dropIdleBlockaders(state: HydratedStellarHorizonsGameState) {
    while (state.remainingBlockaders.length > 0) {
        const [playerId] = state.remainingBlockaders
        if (
            state.escalationDiscard?.playerId === playerId ||
            blockadeSystems(state, playerId).length > 0
        ) {
            return
        }
        state.remainingBlockaders = state.remainingBlockaders.slice(1)
    }
}

export type BlockadeResult = Type.Static<typeof BlockadeResult>
export const BlockadeResult = Type.Object({
    escalation: EscalationDraw,
    // The combined value the blockader's ships beat.
    force: Type.Number(),
    defence: Type.Number()
})

export function declareBlockade(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    targetIds: readonly string[]
): BlockadeResult {
    const force = fleetCombatIn(state, playerId, systemId)
    const defence = combinedDefence(state, targetIds, systemId)
    state.blockades.push({ playerId, systemId, targetIds: [...targetIds] })
    const escalation = drawEscalation(state, playerId, BLOCKADE_ESCALATION * targetIds.length)
    for (const targetId of targetIds) {
        gainInfluence(state, targetId, BLOCKADE_INFLUENCE)
    }
    return { escalation, force, defence }
}

export function endBlockades(state: HydratedStellarHorizonsGameState) {
    state.blockadeStep = undefined
    state.remainingBlockaders = []
    state.blockades = []
}
