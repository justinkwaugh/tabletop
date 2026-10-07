import { assertExists } from '@tabletop/common'
import {
    sameStopCounts,
    type ConstructionState,
    type MapStateData,
    type TileFace,
    type TrackRules
} from '@tabletop/18xx'
import { requireEighteenThirtyTwoState } from './state.js'
import { EighteenThirtyTwoMap, MediumCityLocationIds } from './map.js'
import { EighteenThirtyTwoTileSet } from './tiles.js'
import { coalFieldsOpen } from './coalAccess.js'
import { currentTileFace } from './tileState.js'
import { sameOperatingTurn } from './titleState.js'
import { EighteenThirtyTwoPhases } from './trains.js'
import { migrateRevenueTokens } from './revenueTokens.js'
import { isSystem } from './systems.js'

const Tampa = 'Z25'

// Atlanta's green tile joins its three cities into one brown city (§6.4.4).
function atlantaJoinsCities(before: TileFace, after: TileFace): boolean {
    return before.labels.includes('A') && after.labels.includes('A') && after.color === 'brown'
}

const stopCount = (face: TileFace, kind: 'city' | 'town') =>
    face.nodes.filter((node) => node.kind === kind).length

/**
 * From phase 3 a medium city's yellow town tile may become a yellow city tile, the upgrade of
 * that turn (§4.2.1, §6.4.2).
 */
function promotesMediumCity(state: ConstructionState, locationId: string, after: TileFace) {
    if (!MediumCityLocationIds.includes(locationId)) return false
    const before = currentTileFace(state, locationId)
    return (
        EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '3') &&
        before.color === 'yellow' &&
        stopCount(before, 'town') === 1 &&
        stopCount(before, 'city') === 0 &&
        after.color === 'yellow' &&
        stopCount(after, 'city') === 1 &&
        stopCount(after, 'town') === 0
    )
}

function laidUpgrade(state: ConstructionState, lay: { locationId: string; color: string }) {
    return (
        lay.color !== 'yellow' ||
        (MediumCityLocationIds.includes(lay.locationId) &&
            stopCount(currentTileFace(state, lay.locationId), 'city') > 0)
    )
}

/** This turn's lays, each as whether it was an upgrade; a WVCF token counts as a yellow (§6.5.2). */
function laysThisTurn(state: ConstructionState): boolean[] {
    const title = requireEighteenThirtyTwoState(state)
    const companyId = state.trackStep?.companyId
    const coal = title.coalPurchase
    return [
        ...(state.trackStep?.lays ?? []).map((lay) => laidUpgrade(state, lay)),
        ...(coal && coal.companyId === companyId && sameOperatingTurn(coal.turn, title.operatingSet)
            ? [false]
            : [])
    ]
}

/** Medium cities not yet promoted: untiled, or still with their yellow town tile (§6.4.2). */
export function unpromotedMediumCities(state: MapStateData): string[] {
    return MediumCityLocationIds.filter((locationId) => {
        const face = currentTileFace(state, locationId)
        return face.color === 'white' || (face.color === 'yellow' && !stopCount(face, 'city'))
    })
}

export const EighteenThirtyTwoTrackRules: TrackRules = {
    map: EighteenThirtyTwoMap,
    tileSet: EighteenThirtyTwoTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors: (state) => EighteenThirtyTwoPhases.phase(state.phaseId).tileColors,
    // A company lays two yellow tiles or upgrades one tile (§6); a System lays three yellow
    // tiles, or one yellow tile and one upgrade (§11.6.8).
    allowance(state, color, upgrade) {
        const lays = [...laysThisTurn(state), color !== 'yellow' || !!upgrade]
        const upgrades = lays.filter((lay) => lay).length
        const yellows = lays.length - upgrades
        const companyId = state.trackStep?.companyId
        if (companyId && isSystem(requireEighteenThirtyTwoState(state), companyId))
            return (upgrades === 0 && yellows <= 3) || (upgrades === 1 && yellows <= 1)
                ? { cost: 0 }
                : {
                      reason: 'A System lays three yellow tiles, or one yellow tile and one upgrade.'
                  }
        return (upgrades === 0 && yellows <= 2) || (upgrades === 1 && yellows === 0)
            ? { cost: 0 }
            : { reason: 'A company lays two yellow tiles or upgrades one tile.' }
    },
    upgradesWithinColor: promotesMediumCity,
    stopAllowed: coalFieldsOpen,
    preservesStops: (before, after) =>
        sameStopCounts(before, after) || atlantaJoinsCities(before, after),
    // New track must be usable, or the new tile's city or town on the company's route (§6.1–6.2).
    useful: ({ home, newTrack, connectedCity, connectedTown }) =>
        home || newTrack || connectedCity || connectedTown,
    homeLocations: (companyId) => EighteenThirtyTwoMap.reservedLocationIds(companyId),
    // A company lays its first tile in its own home hex without the terrain cost (§6.5.1).
    terrainCost: (_state, request, cost) =>
        EighteenThirtyTwoMap.reservedLocationIds(request.companyId).includes(request.locationId)
            ? 0
            : cost,
    afterLay(state, details) {
        migrateRevenueTokens(
            requireEighteenThirtyTwoState(state),
            details.locationId,
            details.nodeMapping
        )
        return { payments: [], closedPrivateIds: [] }
    },
    restriction(state, request) {
        // A System's upgrade is of a different tile from its yellow lay (§11.6.8).
        if (state.trackStep?.lays.some((lay) => lay.locationId === request.locationId))
            return 'A tile laid this turn cannot be replaced'
        const definition = EighteenThirtyTwoTileSet.definitions.find(
            (tile) => tile.id === request.definitionId
        )
        assertExists(definition, 'A track request names a tile of the set')
        if (request.locationId === Tampa && definition.face.color === 'brown')
            return 'Tampa has no brown upgrade'
        return undefined
    }
}
