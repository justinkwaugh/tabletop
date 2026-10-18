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
import { AnomalySearch, searchForAnomaly } from './anomalies.js'
import { gainInfluence, isCampaign } from './campaign.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { WorldPlacement } from './pieces.js'
import type { HydratedStellarHorizonsPlayerState } from './playerState.js'
import { drawWorldTile, returnWorldTile } from './pools.js'

export const SURVEY_REPLACEMENT_POPULATION = 12
export const LAST_SURVEY_INFLUENCE = 1

export type SurveyResolution = Type.Static<typeof SurveyResolution>
export const SurveyResolution = Type.Object({
    playerId: Type.String(),
    shipId: Type.String(),
    systemId: Type.String(),
    completed: Type.Boolean(),
    explorationMarker: Type.Number(),
    drawnTileId: Type.Optional(Type.String()),
    placedSlot: Type.Optional(Type.Number()),
    awaitingChoice: Type.Boolean(),
    anomaly: Type.Optional(AnomalySearch)
})

export function placementPopulation(world: WorldPlacement): number {
    return maxPopulation(world.tileId, world.side)
}

export function canStartInSystem(systemId: string, tileId: string): boolean {
    return (
        !starSystemDefinition(systemId).earthlikeRestricted ||
        !isEarthlikeClass(worldTile(tileId).worldClass)
    )
}

export function fillWorldSlots(state: HydratedStellarHorizonsGameState, systemId: string) {
    const system = state.systemState(systemId)
    while (system.worlds.length < starSystemDefinition(systemId).worldSlots) {
        const tileId = drawWorldTile(state, (candidate) => canStartInSystem(systemId, candidate))
        assertExists(tileId, `No world tile left to fill ${systemId}`)
        system.worlds.push({ tileId, side: WorldSide.I })
    }
}

export function anyPendingSurveys(state: HydratedStellarHorizonsGameState): boolean {
    return state.players.some((player) => player.pendingSurveys.length > 0)
}

function nextSurveyor(state: HydratedStellarHorizonsGameState): HydratedStellarHorizonsPlayerState {
    const playerId = state
        .initiativeOrder()
        .find((candidate) => state.getPlayerState(candidate).pendingSurveys.length > 0)
    assertExists(playerId, 'No pending survey to resolve')
    return state.getPlayerState(playerId)
}

export function resolveNextSurvey(state: HydratedStellarHorizonsGameState): SurveyResolution {
    const player = nextSurveyor(state)
    const [survey, ...remaining] = player.pendingSurveys
    player.pendingSurveys = remaining
    const system = state.systemState(survey.systemId)
    const resolution: SurveyResolution = {
        playerId: player.playerId,
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
    // Campaign: whoever completes the last survey keeps the marker and earns 1 IP.
    if (system.explorationMarker === 0 && isCampaign(state)) {
        player.explorationMarkers += 1
        gainInfluence(state, player.playerId, LAST_SURVEY_INFLUENCE)
    }
    drawSurveyWorld(state, resolution)
    resolution.anomaly = searchForAnomaly(state, survey.systemId, player.playerId)
    return resolution
}

function drawSurveyWorld(state: HydratedStellarHorizonsGameState, resolution: SurveyResolution) {
    const system = state.systemState(resolution.systemId)
    const isLegal = (tileId: string) => canStartInSystem(resolution.systemId, tileId)

    if (system.worlds.length < starSystemDefinition(resolution.systemId).worldSlots) {
        const tileId = drawWorldTile(state, isLegal)
        if (tileId) {
            system.worlds.push({ tileId, side: WorldSide.I })
            resolution.drawnTileId = tileId
            resolution.placedSlot = system.worlds.length - 1
        }
        return
    }

    const hasSmallWorld = system.worlds.some(
        (world) => placementPopulation(world) < SURVEY_REPLACEMENT_POPULATION
    )
    if (!hasSmallWorld) {
        return
    }
    const tileId = drawWorldTile(state, isLegal)
    if (!tileId) {
        return
    }
    resolution.drawnTileId = tileId
    if (surveySwapSlots(state, resolution.systemId, tileId).length > 0) {
        state.surveyChoice = {
            playerId: resolution.playerId,
            systemId: resolution.systemId,
            drawnTileId: tileId
        }
        resolution.awaitingChoice = true
    } else {
        returnWorldTile(state, tileId)
    }
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
