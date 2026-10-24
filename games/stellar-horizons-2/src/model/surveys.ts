import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { DirectiveType } from '../components/directives.js'
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
import { recordDirectiveProgress } from './directives.js'
import { drawDemand } from './demand.js'
import { capabilitiesOf } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { FulfilledDirective, type WorldPlacement } from './pieces.js'
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
    // Planetary Surveys draw two worlds to choose from.
    drawnTileIds: Type.Optional(Type.Array(Type.String())),
    placedSlot: Type.Optional(Type.Number()),
    awaitingChoice: Type.Boolean(),
    anomaly: Type.Optional(AnomalySearch),
    directives: Type.Optional(Type.Array(FulfilledDirective))
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
    // Rulebook 5.1: any survey of the named system meets a survey directive (slice 6, Q8).
    const directive = recordDirectiveProgress(state, player.playerId, {
        kind: DirectiveType.Survey,
        systemId: survey.systemId
    })
    if (directive) {
        resolution.directives = [directive]
    }
    // Campaign: whoever completes the last survey keeps the marker, earns 1 IP and draws the
    // system's demand marker if it has none.
    if (system.explorationMarker === 0 && isCampaign(state)) {
        player.explorationMarkers += 1
        gainInfluence(state, player.playerId, LAST_SURVEY_INFLUENCE)
        drawDemand(state, player.playerId, survey.systemId)
    }
    drawSurveyWorld(state, resolution)
    resolution.anomaly = searchForAnomaly(state, survey.systemId, player.playerId, survey.shipId)
    return resolution
}

function drawSurveyWorld(state: HydratedStellarHorizonsGameState, resolution: SurveyResolution) {
    const system = state.systemState(resolution.systemId)
    const isLegal = (tileId: string) => canStartInSystem(resolution.systemId, tileId)
    const fillsSlot = system.worlds.length < starSystemDefinition(resolution.systemId).worldSlots
    const hasSmallWorld = system.worlds.some(
        (world) => placementPopulation(world) < SURVEY_REPLACEMENT_POPULATION
    )
    if (!fillsSlot && !hasSmallWorld) {
        return
    }
    const drawnTileIds = drawSurveyTiles(state, resolution.playerId, isLegal)
    if (drawnTileIds.length === 0) {
        return
    }
    resolution.drawnTileId = drawnTileIds[0]
    if (drawnTileIds.length > 1) {
        resolution.drawnTileIds = drawnTileIds
    }
    if (fillsSlot && drawnTileIds.length === 1) {
        system.worlds.push({ tileId: drawnTileIds[0], side: WorldSide.I })
        resolution.placedSlot = system.worlds.length - 1
        return
    }
    const usable =
        fillsSlot ||
        drawnTileIds.some(
            (tileId) => surveySwapSlots(state, resolution.systemId, tileId).length > 0
        )
    if (usable) {
        state.surveyChoice = {
            playerId: resolution.playerId,
            systemId: resolution.systemId,
            drawnTileIds,
            fillsSlot
        }
        resolution.awaitingChoice = true
    } else {
        drawnTileIds.forEach((tileId) => returnWorldTile(state, tileId))
    }
}

// Planetary Surveys draw two worlds for the Player's completed surveys.
function drawSurveyTiles(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    isLegal: (tileId: string) => boolean
): string[] {
    return Array.from({ length: capabilitiesOf(state, playerId).surveyDraws }).flatMap(() => {
        const tileId = drawWorldTile(state, isLegal)
        return tileId === undefined ? [] : [tileId]
    })
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

// The surveyor's choice: which drawn world fills the empty slot, or which replaces a smaller
// world in a full system, if any. The other drawn worlds go back to the pool.
export function surveyChoiceProblem(
    state: HydratedStellarHorizonsGameState,
    tileId: string | undefined,
    slot: number | undefined
): string | undefined {
    const choice = state.surveyChoice
    if (!choice) {
        return 'No survey world choice is pending'
    }
    if (choice.fillsSlot) {
        return tileId !== undefined && choice.drawnTileIds.includes(tileId) && slot === undefined
            ? undefined
            : 'Choose one of the drawn worlds'
    }
    if (tileId === undefined && slot === undefined) {
        return undefined
    }
    return tileId !== undefined &&
        slot !== undefined &&
        choice.drawnTileIds.includes(tileId) &&
        surveySwapSlots(state, choice.systemId, tileId).includes(slot)
        ? undefined
        : 'That world cannot replace that one'
}

export function applySurveyChoice(
    state: HydratedStellarHorizonsGameState,
    tileId: string | undefined,
    slot: number | undefined
): WorldPlacement | undefined {
    const choice = state.surveyChoice
    assertExists(choice, 'No survey world choice is pending')
    state.surveyChoice = undefined
    for (const drawn of choice.drawnTileIds) {
        if (drawn !== tileId) {
            returnWorldTile(state, drawn)
        }
    }
    if (tileId === undefined) {
        return undefined
    }
    const system = state.systemState(choice.systemId)
    if (choice.fillsSlot || slot === undefined) {
        system.worlds.push({ tileId, side: WorldSide.I })
        return undefined
    }
    const replaced = system.worlds[slot]
    system.worlds[slot] = { tileId, side: WorldSide.I }
    if (isRevealedWorld(replaced.tileId)) {
        returnWorldTile(state, replaced.tileId)
    } else {
        state.removedWorlds.push(replaced.tileId)
    }
    return replaced
}
