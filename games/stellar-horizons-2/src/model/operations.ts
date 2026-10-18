import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { shipDefinition } from '../components/ships.js'
import { TechField } from '../components/techFields.js'
import { worldFace } from '../components/worlds.js'
import { blocksExploration } from './anomalies.js'
import { factionAbilities, isCampaign } from './campaign.js'
import { currentCombat, currentExploration, hasArrived, isCrippled } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { isHeld } from './holds.js'
import { MarkerReason, OperationKind, type ShipState } from './pieces.js'
import { earnMarkers } from './pools.js'
import { hasRevealedWorld } from './settling.js'
import { roundHalfUp } from './turn.js'

// Rulebook 1.17. Mining and research are exploration actions of the campaign, so a "no
// exploration" anomaly stops them too, and they roll no malfunction (designer ruling). "A
// system may be mined or researched only once per turn" is read as once per Player, since
// Players explore unseen by each other.
export const MINING_CASH = 1
export const RICH_MINING_CASH = 2

export function canOperate(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    kind: OperationKind
): boolean {
    const definition = shipDefinition(ship.shipId)
    const capable = kind === OperationKind.Mining ? definition.mining : definition.research
    return (
        isCampaign(state) &&
        capable &&
        hasArrived(ship) &&
        !ship.explored &&
        !isHeld(state, ship) &&
        !isCrippled(ship) &&
        ship.systemId !== SOL_SYSTEM_ID &&
        hasRevealedWorld(state, ship.systemId) &&
        state.base(ship.playerId, ship.systemId) === undefined &&
        !blocksExploration(state, ship.systemId) &&
        !state
            .getPlayerState(ship.playerId)
            .operations.some((operation) => operation.systemId === ship.systemId)
    )
}

export function operableWorldSlots(state: HydratedStellarHorizonsGameState, systemId: string) {
    return state
        .systemState(systemId)
        .worlds.flatMap((world, slot) => (worldFace(world.tileId, world.side) ? [slot] : []))
}

export function canOperateAnyShip(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    kind: OperationKind
): boolean {
    return state.shipsOf(playerId).some((ship) => canOperate(state, ship, kind))
}

export type OperationResult = Type.Static<typeof OperationResult>
export const OperationResult = Type.Object({
    systemId: Type.String(),
    roll: Type.Number(),
    target: Type.Number(),
    success: Type.Boolean(),
    cash: Type.Number(),
    field: Type.Optional(Type.Enum(TechField))
})

function face(state: HydratedStellarHorizonsGameState, systemId: string, slot: number) {
    const world = state.systemState(systemId).worlds[slot]
    assertExists(world, `No world in slot ${slot} of ${systemId}`)
    const printed = worldFace(world.tileId, world.side)
    assertExists(printed, `Slot ${slot} of ${systemId} holds no world`)
    return printed
}

function recordOperation(
    ship: ShipState,
    state: HydratedStellarHorizonsGameState,
    kind: OperationKind
) {
    ship.explored = true
    state.getPlayerState(ship.playerId).operations.push({
        shipId: ship.shipId,
        systemId: ship.systemId,
        kind
    })
}

export function miningTarget(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    slot: number
): number {
    return face(state, ship.systemId, slot).cash
}

export function researchTarget(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    slot: number
): number {
    return face(state, ship.systemId, slot).techValue + roundHalfUp(currentExploration(ship) / 2)
}

// Mining earns $1B, or $2B on a die at or under the world's cash value.
export function mine(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    slot: number
): OperationResult {
    const target = miningTarget(state, ship, slot)
    const roll = state.getPlayerPrng(ship.playerId).dieRoll(10)
    const success = roll <= target
    const cash = success ? RICH_MINING_CASH : MINING_CASH
    state.getPlayerState(ship.playerId).cash += cash
    recordOperation(ship, state, OperationKind.Mining)
    return { systemId: ship.systemId, roll, target, success, cash }
}

// Research earns one marker of the world's type on a die at or under its research value plus
// half the ship's exploration value, rounded up; the marker is drawn once everyone has explored.
export function research(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    slot: number
): OperationResult {
    const printed = face(state, ship.systemId, slot)
    const target = researchTarget(state, ship, slot)
    const roll = state.getPlayerPrng(ship.playerId).dieRoll(10)
    const success = roll <= target
    if (success) {
        earnMarkers(state, ship.playerId, {
            shipId: ship.shipId,
            systemId: ship.systemId,
            field: printed.techField,
            count: 1,
            reason: MarkerReason.Research
        })
    }
    recordOperation(ship, state, OperationKind.Research)
    return { systemId: ship.systemId, roll, target, success, cash: 0, field: printed.techField }
}

// The Syndicate's third ability: $1B from each Player mining or researching in a system where
// the Syndicate's ships have more combat value than that Player's. Settled once everyone has
// explored, in initiative order.
export const SYNDICATE_TAKE = 1

export type SyndicateTake = Type.Static<typeof SyndicateTake>
export const SyndicateTake = Type.Object({
    fromPlayerId: Type.String(),
    toPlayerId: Type.String(),
    systemId: Type.String(),
    cash: Type.Number()
})

function combatIn(state: HydratedStellarHorizonsGameState, playerId: string, systemId: string) {
    return state
        .shipsOf(playerId)
        .filter((ship) => ship.systemId === systemId && hasArrived(ship))
        .reduce((total, ship) => total + currentCombat(ship), 0)
}

export function pendingSyndicateTakes(state: HydratedStellarHorizonsGameState): SyndicateTake[] {
    const takers = state.players.filter(
        (player) => factionAbilities(state, player.playerId).takesFromOperations
    )
    return state.initiativeOrder().flatMap((playerId) =>
        state.getPlayerState(playerId).operations.flatMap((operation) =>
            takers
                .filter(
                    (taker) =>
                        taker.playerId !== playerId &&
                        combatIn(state, taker.playerId, operation.systemId) >
                            combatIn(state, playerId, operation.systemId)
                )
                .map((taker) => ({
                    fromPlayerId: playerId,
                    toPlayerId: taker.playerId,
                    systemId: operation.systemId,
                    cash: SYNDICATE_TAKE
                }))
        )
    )
}

export function settleSyndicateTakes(state: HydratedStellarHorizonsGameState): SyndicateTake[] {
    const takes = pendingSyndicateTakes(state).map((take) => {
        const from = state.getPlayerState(take.fromPlayerId)
        const cash = Math.min(take.cash, from.cash)
        from.cash -= cash
        state.getPlayerState(take.toPlayerId).cash += cash
        return { ...take, cash }
    })
    return takes
}
