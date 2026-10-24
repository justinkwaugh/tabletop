import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import {
    WorldSide,
    canTerraformFrom,
    isTerraformTarget,
    maxPopulation,
    worldTile
} from '../components/worlds.js'
import { shipDefinition } from '../components/ships.js'
import { blocksBases, blocksExploration } from './anomalies.js'
import { gainInfluence } from './campaign.js'
import { capabilitiesOf, hasArrived, isCrippled } from './fleet.js'
import { isHeld } from './holds.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type {
    ShipState,
    ShipTerraform,
    TerraformChoice,
    TerraformTarget,
    WorldPlacement
} from './pieces.js'
export { TerraformTarget } from './pieces.js'
import { drawWorldTile, returnWorldTile } from './pools.js'
import { placementPopulation } from './surveys.js'

export const TERRAFORM_POPULATION_STEP = 10

export type TerraformOutcome = Type.Static<typeof TerraformOutcome>
export const TerraformOutcome = Type.Object({
    tileId: Type.String(),
    flipped: Type.Boolean(),
    drawnTileIds: Type.Array(Type.String()),
    awaitingChoice: Type.Boolean()
})

// Rulebook 4.7: the Givers terraform once more than their tech allows, and Planetary
// Engineering once more than the tech gives, never the same world twice in a phase.
export function terraformsAllowed(state: HydratedStellarHorizonsGameState, playerId: string) {
    return capabilitiesOf(state, playerId).terraforms
}

export const IP_FOR_FLIP = 1
export const IP_FOR_REPLACEMENT = 2

export function terraformTargets(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): TerraformTarget[] {
    if (terraformsAllowed(state, playerId) === 0) {
        return []
    }
    const done = state.terraformedWorlds.filter((record) => record.playerId === playerId)
    return state
        .basesOf(playerId)
        .filter((base) => !blocksBases(state, base.systemId))
        .flatMap((base) =>
            state
                .systemState(base.systemId)
                .worlds.flatMap((world, slot) =>
                    canTerraformFrom(worldTile(world.tileId).worldClass, world.side) &&
                    !done.some(
                        (record) => record.systemId === base.systemId && record.slot === slot
                    )
                        ? [{ systemId: base.systemId, slot }]
                        : []
                )
        )
}

// Each Player who can terraform takes their turns in initiative order, one entry per
// terraforming action.
export function terraformingQueue(state: HydratedStellarHorizonsGameState): string[] {
    return state
        .initiativeOrder()
        .filter((playerId) => terraformTargets(state, playerId).length > 0)
        .flatMap((playerId) =>
            Array.from({ length: terraformsAllowed(state, playerId) }, () => playerId)
        )
}

export function refillWorldPool(state: HydratedStellarHorizonsGameState) {
    const classes = new Set(state.setAsideWorlds.map((tileId) => worldTile(tileId).worldClass))
    for (const worldClass of classes) {
        const index = state.setAsideWorlds.findIndex(
            (tileId) => worldTile(tileId).worldClass === worldClass
        )
        const [tileId] = state.setAsideWorlds.splice(index, 1)
        returnWorldTile(state, tileId)
    }
}

export function terraform(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    target: TerraformTarget
): TerraformOutcome {
    const world = state.systemState(target.systemId).worlds[target.slot]
    state.terraformedWorlds.push({ playerId, ...target })
    if (world.side === WorldSide.I) {
        world.side = WorldSide.II
        gainInfluence(state, playerId, IP_FOR_FLIP)
        return { tileId: world.tileId, flipped: true, drawnTileIds: [], awaitingChoice: false }
    }
    const drawnTileIds: string[] = []
    for (let draw = 0; draw < capabilitiesOf(state, playerId).terraformDraws; draw++) {
        const tileId = drawWorldTile(state, () => true)
        if (tileId) {
            drawnTileIds.push(tileId)
        }
    }
    const choice: TerraformChoice = { playerId, ...target, drawnTileIds }
    const awaitingChoice =
        replacementOptions(state, choice).length > 0 || removalOptions(state, choice).length > 0
    if (awaitingChoice) {
        state.terraformChoice = choice
    } else {
        drawnTileIds.forEach((tileId) => returnWorldTile(state, tileId))
    }
    return { tileId: world.tileId, flipped: false, drawnTileIds, awaitingChoice }
}

function terraformedWorld(state: HydratedStellarHorizonsGameState, choice: TerraformChoice) {
    return state.systemState(choice.systemId).worlds[choice.slot]
}

export function replacementOptions(
    state: HydratedStellarHorizonsGameState,
    choice: TerraformChoice
): string[] {
    const current = placementPopulation(terraformedWorld(state, choice))
    return choice.drawnTileIds.filter((tileId) => {
        const population = maxPopulation(tileId, WorldSide.I)
        return (
            isTerraformTarget(worldTile(tileId).worldClass) &&
            population > current &&
            population <= current + TERRAFORM_POPULATION_STEP
        )
    })
}

export function removalOptions(
    state: HydratedStellarHorizonsGameState,
    choice: TerraformChoice
): string[] {
    const current = placementPopulation(terraformedWorld(state, choice))
    return choice.drawnTileIds.filter((tileId) => maxPopulation(tileId, WorldSide.I) < current)
}

export function isValidTerraformChoice(
    state: HydratedStellarHorizonsGameState,
    replacementTileId: string | undefined,
    removedTileIds: readonly string[]
): boolean {
    const choice = state.terraformChoice
    if (!choice) {
        return false
    }
    const removable = removalOptions(state, choice)
    return (
        (replacementTileId === undefined ||
            replacementOptions(state, choice).includes(replacementTileId)) &&
        new Set(removedTileIds).size === removedTileIds.length &&
        removedTileIds.every((tileId) => tileId !== replacementTileId && removable.includes(tileId))
    )
}

export function applyTerraformChoice(
    state: HydratedStellarHorizonsGameState,
    replacementTileId: string | undefined,
    removedTileIds: readonly string[]
): WorldPlacement | undefined {
    const choice = state.terraformChoice
    assertExists(choice, 'No terraforming choice is pending')
    state.terraformChoice = undefined
    let replaced: WorldPlacement | undefined
    if (replacementTileId !== undefined) {
        const worlds = state.systemState(choice.systemId).worlds
        replaced = worlds[choice.slot]
        worlds[choice.slot] = { tileId: replacementTileId, side: WorldSide.I }
        returnWorldTile(state, replaced.tileId)
        gainInfluence(state, choice.playerId, IP_FOR_REPLACEMENT)
    }
    for (const tileId of choice.drawnTileIds) {
        if (tileId === replacementTileId) {
            continue
        }
        if (removedTileIds.includes(tileId)) {
            state.removedWorlds.push(tileId)
        } else {
            returnWorldTile(state, tileId)
        }
    }
    return replaced
}

// Rulebook 1.18: with Atmosphere Processing a mining ship may use its exploration action to
// terraform a world in its system, any number per system. It is an exploration action, so a
// "no exploration" anomaly stops it, and like any terraforming a "no bases" anomaly does
// (1.16). No base is needed. It is resolved once everyone has explored, in initiative order.
export function shipTerraformSlots(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): number[] {
    if (
        !capabilitiesOf(state, ship.playerId).shipTerraforming ||
        !shipDefinition(ship.shipId).mining ||
        !hasArrived(ship) ||
        ship.explored ||
        isHeld(state, ship) ||
        isCrippled(state, ship) ||
        blocksExploration(state, ship.systemId) ||
        blocksBases(state, ship.systemId)
    ) {
        return []
    }
    return state
        .systemState(ship.systemId)
        .worlds.flatMap((world, slot) =>
            canTerraformFrom(worldTile(world.tileId).worldClass, world.side) ? [slot] : []
        )
}

export function queueShipTerraform(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    slot: number
) {
    ship.explored = true
    state
        .getPlayerState(ship.playerId)
        .shipTerraforms.push({ shipId: ship.shipId, systemId: ship.systemId, slot })
}

export function nextShipTerraformer(state: HydratedStellarHorizonsGameState): string | undefined {
    return state
        .initiativeOrder()
        .find((playerId) => state.getPlayerState(playerId).shipTerraforms.length > 0)
}

// An earlier terraform may have changed the world: a flipped world draws instead, and one that
// can no longer be terraformed is left alone.
export function resolveNextShipTerraform(
    state: HydratedStellarHorizonsGameState
): (ShipTerraform & { playerId: string; outcome?: TerraformOutcome }) | undefined {
    const playerId = nextShipTerraformer(state)
    if (playerId === undefined) {
        return undefined
    }
    const player = state.getPlayerState(playerId)
    const [pending, ...rest] = player.shipTerraforms
    player.shipTerraforms = rest
    const world = state.systemState(pending.systemId).worlds[pending.slot]
    if (!world || !canTerraformFrom(worldTile(world.tileId).worldClass, world.side)) {
        return { playerId, ...pending }
    }
    return { playerId, ...pending, outcome: terraform(state, playerId, pending) }
}
