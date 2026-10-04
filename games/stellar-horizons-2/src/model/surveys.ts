import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { starSystemDefinition } from '../components/systems.js'
import {
    WorldSide,
    isEarthlikeClass,
    isRevealedWorld,
    maxPopulation,
    worldTile
} from '../components/worlds.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { PendingSurvey, WorldPlacement } from './pieces.js'
import { drawWorldTile, returnWorldTile } from './pools.js'

export const SURVEY_REPLACEMENT_POPULATION = 12

export type SurveyResolution = Type.Static<typeof SurveyResolution>
export const SurveyResolution = Type.Object({
    playerId: Type.String(),
    shipId: Type.String(),
    systemId: Type.String(),
    completed: Type.Boolean(),
    explorationMarker: Type.Number(),
    drawnTileId: Type.Optional(Type.String()),
    placedSlot: Type.Optional(Type.Number()),
    awaitingChoice: Type.Boolean()
})

export function placementPopulation(world: WorldPlacement): number {
    return maxPopulation(world.tileId, world.side)
}

export function nextPendingSurvey(state: HydratedStellarHorizonsGameState): PendingSurvey {
    const order = state.initiativeOrder()
    const next = state.pendingSurveys.reduce((best, survey) =>
        order.indexOf(survey.playerId) < order.indexOf(best.playerId) ? survey : best
    )
    assertExists(next, 'No pending survey to resolve')
    return next
}

export function resolveNextSurvey(state: HydratedStellarHorizonsGameState): SurveyResolution {
    const survey = nextPendingSurvey(state)
    state.pendingSurveys = state.pendingSurveys.filter((pending) => pending !== survey)
    const system = state.systemState(survey.systemId)
    const resolution: SurveyResolution = {
        ...survey,
        completed: false,
        explorationMarker: system.explorationMarker,
        awaitingChoice: false
    }
    if (system.explorationMarker === 0) {
        return resolution
    }
    system.explorationMarker -= 1
    resolution.completed = true
    resolution.explorationMarker = system.explorationMarker

    const definition = starSystemDefinition(survey.systemId)
    const isLegal = (tileId: string) =>
        !definition.earthlikeRestricted || !isEarthlikeClass(worldTile(tileId).worldClass)

    if (system.worlds.length < definition.worldSlots) {
        const tileId = drawWorldTile(state, isLegal)
        if (tileId) {
            system.worlds.push({ tileId, side: WorldSide.I })
            resolution.drawnTileId = tileId
            resolution.placedSlot = system.worlds.length - 1
        }
        return resolution
    }

    const hasSmallWorld = system.worlds.some(
        (world) => placementPopulation(world) < SURVEY_REPLACEMENT_POPULATION
    )
    if (!hasSmallWorld) {
        return resolution
    }
    const tileId = drawWorldTile(state, isLegal)
    if (!tileId) {
        return resolution
    }
    resolution.drawnTileId = tileId
    if (surveySwapSlots(state, survey.systemId, tileId).length > 0) {
        state.surveyChoice = {
            playerId: survey.playerId,
            systemId: survey.systemId,
            drawnTileId: tileId
        }
        resolution.awaitingChoice = true
    } else {
        returnWorldTile(state, tileId)
    }
    return resolution
}

export function surveySwapSlots(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    drawnTileId: string
): number[] {
    const drawnPopulation = maxPopulation(drawnTileId, WorldSide.I)
    if (drawnPopulation > SURVEY_REPLACEMENT_POPULATION) {
        return []
    }
    return state
        .systemState(systemId)
        .worlds.flatMap((world, slot) =>
            placementPopulation(world) < drawnPopulation ? [slot] : []
        )
}

export function applySurveyChoice(
    state: HydratedStellarHorizonsGameState,
    slot: number | undefined
): WorldPlacement | undefined {
    const choice = state.surveyChoice
    assertExists(choice, 'No survey world choice is pending')
    state.surveyChoice = undefined
    if (slot === undefined) {
        returnWorldTile(state, choice.drawnTileId)
        return undefined
    }
    const system = state.systemState(choice.systemId)
    const replaced = system.worlds[slot]
    system.worlds[slot] = { tileId: choice.drawnTileId, side: WorldSide.I }
    if (isRevealedWorld(replaced.tileId)) {
        returnWorldTile(state, replaced.tileId)
    } else {
        state.removedWorlds.push(replaced.tileId)
    }
    return replaced
}
