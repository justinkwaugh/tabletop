import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    type ConstructionState,
    type TileFace,
    type TileNode,
    type TrackRequest,
    type TrackRules
} from '@tabletop/18xx'
import { PrivateCatalog1856 } from './companies.js'
import { Homes1856, Map1856 } from './map.js'
import { TileSet1856, preservesStops1856 } from './tiles.js'
import { Phases1856, TownUpgradePhaseId } from './trains.js'

const stopCount = (face: TileFace, kind: TileNode['kind']) =>
    face.nodes.filter((node) => node.kind === kind).length
const hasNoStops = (face: TileFace) => face.nodes.every((node) => node.kind === 'junction')
const isYellowSmallCity = (face: TileFace) =>
    face.color === 'yellow' && stopCount(face, 'town') === 1 && stopCount(face, 'city') === 0

/** A single small city's yellow tile becoming a yellow large city (#3→#5, #4→#57, #58→#6). */
function upgradesSmallCity(before: TileFace, after: TileFace): boolean {
    return (
        isYellowSmallCity(before) &&
        after.color === 'yellow' &&
        stopCount(after, 'city') === 1 &&
        stopCount(after, 'town') === 0
    )
}

/** A single small city's yellow tile becoming plain yellow track (#3→#7, #4→#9, #58→#8). */
function downgradesSmallCity(before: TileFace, after: TileFace): boolean {
    return isYellowSmallCity(before) && after.color === 'yellow' && hasNoStops(after)
}

/**
 * A double small city's yellow tile becoming the green large city on its four sides (#1, #55→#14;
 * #2, #56→#15): its two cities' track is rebuilt into the one city, keeping the tile's exits.
 */
function upgradesDoubleSmallCity(before: TileFace, after: TileFace): boolean {
    return (
        before.color === 'yellow' &&
        stopCount(before, 'town') === 2 &&
        stopCount(before, 'city') === 0 &&
        after.color === 'green' &&
        stopCount(after, 'city') === 1 &&
        stopCount(after, 'town') === 0 &&
        !after.labels.length
    )
}

function tileFace(definitionId: string): TileFace {
    const definition = TileSet1856.definitions.find((tile) => tile.id === definitionId)
    assertExists(definition, `Unknown 1856 tile ${definitionId}`)
    return definition.face
}

/** Small cities are upgraded or downgraded only from the first 6-train (Phase Five). */
function smallCityRestriction(state: ConstructionState, request: TrackRequest): string | undefined {
    const before = new RailwayMapState(Map1856, TileSet1856, state.tileInventory).tile(
        request.locationId
    ).face
    const changesSmallCities =
        stopCount(before, 'town') > 0 && stopCount(tileFace(request.definitionId), 'town') === 0
    return changesSmallCities && !Phases1856.isAtLeast(state.phaseId, TownUpgradePhaseId)
        ? 'Small cities are upgraded or downgraded only from the first 6-train.'
        : undefined
}

export const TrackRules1856: TrackRules = {
    map: Map1856,
    tileSet: TileSet1856,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => Phases1856.phase(state.phaseId).tileColors,
    // Each operating company may place one track tile in its turn (Lay or Upgrade Track).
    allowance: (state) =>
        state.trackStep?.lays.length ? { reason: 'One lay or upgrade a turn.' } : { cost: 0 },
    preservesStops: preservesStops1856,
    upgradesWithinColor: (_locationId, before, after) =>
        upgradesSmallCity(before, after) || downgradesSmallCity(before, after),
    removedStops: (_locationId, before, after) =>
        downgradesSmallCity(before, after)
            ? before.nodes.filter((node) => node.kind === 'town').map((node) => node.id)
            : [],
    reconfigures: (_locationId, before, after) => upgradesDoubleSmallCity(before, after),
    // The new track must be on a route from one of the company's stations, or the lay must raise
    // (or, downgrading a small city, lower) the value of a city it could run to (Lay or Upgrade
    // Track); a small city becoming a large one does so.
    useful: ({ home, newTrack, increasedCityRevenue, connectedCity }) =>
        home || newTrack || increasedCityRevenue || connectedCity,
    homeLocations: (companyId) => {
        const home = Homes1856[companyId]
        return home ? [home] : []
    },
    restriction(state, request) {
        if (PrivateCatalog1856.blockedBy(state, request.locationId))
            return 'A player-owned private company blocks this hex.'
        return smallCityRestriction(state, request)
    }
}
