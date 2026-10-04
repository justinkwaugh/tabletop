import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import {
    WorldSide,
    canTerraformFrom,
    isTerraformTarget,
    maxPopulation,
    worldTile
} from '../components/worlds.js'
import { capabilitiesOf } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { TerraformChoice, WorldPlacement } from './pieces.js'
import { drawWorldTile, returnWorldTile } from './pools.js'
import { placementPopulation } from './surveys.js'

export const TERRAFORM_POPULATION_STEP = 10

export type TerraformTarget = Type.Static<typeof TerraformTarget>
export const TerraformTarget = Type.Object({
    systemId: Type.String(),
    slot: Type.Number()
})

export type TerraformOutcome = Type.Static<typeof TerraformOutcome>
export const TerraformOutcome = Type.Object({
    tileId: Type.String(),
    flipped: Type.Boolean(),
    drawnTileIds: Type.Array(Type.String()),
    awaitingChoice: Type.Boolean()
})

export function terraformTargets(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): TerraformTarget[] {
    if (capabilitiesOf(state, playerId).terraforms === 0) {
        return []
    }
    return state
        .basesOf(playerId)
        .flatMap((base) =>
            state
                .systemState(base.systemId)
                .worlds.flatMap((world, slot) =>
                    canTerraformFrom(worldTile(world.tileId).worldClass, world.side)
                        ? [{ systemId: base.systemId, slot }]
                        : []
                )
        )
}

export function terraformingPlayers(state: HydratedStellarHorizonsGameState): string[] {
    return state
        .initiativeOrder()
        .filter((playerId) => terraformTargets(state, playerId).length > 0)
}

export function terraform(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    target: TerraformTarget
): TerraformOutcome {
    const world = state.systemState(target.systemId).worlds[target.slot]
    if (world.side === WorldSide.I) {
        world.side = WorldSide.II
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
