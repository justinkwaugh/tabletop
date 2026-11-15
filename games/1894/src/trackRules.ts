import { RailwayMapState, sameStopCounts, type TileFace, type TrackRules } from '@tabletop/18xx'
import { inFinalOperatingSet } from './endingRules.js'
import { londonAccess } from './london.js'
import { EighteenNinetyFourMap, ParisLocationId } from './map.js'
import { EighteenNinetyFourTileSet, SplitCityTiles } from './tiles.js'
import { EighteenNinetyFourPhases } from './trains.js'
import { EighteenNinetyFourPrivateCatalog } from './privates.js'

const cityCount = (face: TileFace) => face.nodes.filter((node) => node.kind === 'city').length
/** A non-big green city: a green city tile without a big city's letter. */
export const isSplittingGreenCity = (face: TileFace) =>
    face.color === 'green' && !face.labels.length && cityCount(face) === 1
const isSplitBrownCity = (face: TileFace) =>
    face.color === 'brown' && !face.labels.length && cityCount(face) === 2

/** A track action that replaced a tile: every green or brown tile laid (§7.3.3). */
const isUpgrade = (color: string) => color !== 'yellow'

export const EighteenNinetyFourTrackRules: TrackRules = {
    map: EighteenNinetyFourMap,
    tileSet: EighteenNinetyFourTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors: (state) => EighteenNinetyFourPhases.phase(state.phaseId).tileColors,
    // Two track actions a round, at most one of them an upgrade (§7.3.3).
    allowance(state, color, upgrade) {
        if (inFinalOperatingSet(state)) return { reason: 'Nothing is built in the final set.' }
        const lays = state.trackStep?.lays ?? []
        if (lays.length >= 2) return { reason: 'A company has two track actions a round.' }
        if (
            (upgrade || isUpgrade(color)) &&
            lays.some((lay) => {
                const face = EighteenNinetyFourTileSet.definitions.find(
                    (tile) => tile.id === lay.definitionId
                )?.face
                return !!face && isUpgrade(face.color)
            })
        )
            return { reason: 'Only one track action a round may be an upgrade.' }
        return { cost: 0 }
    },
    preservesStops: sameStopCounts,
    // A non-big green city's brown tile splits it into two cities, keeping its exits (§12.3.2).
    sharesFullCities: true,
    reconfigures: (_locationId, before, after) =>
        isSplittingGreenCity(before) && isSplitBrownCity(after),
    useful: ({ home, connected }) => home || connected,
    stopAllowed: londonAccess,
    homeLocations: (companyId) => EighteenNinetyFourMap.reservedLocationIds(companyId),
    restriction(state, request) {
        if (EighteenNinetyFourPrivateCatalog.blockedBy(state, request.locationId))
            return 'A player-owned private company blocks this hex.'
        const laidThisRound = [
            ...(state.trackStep?.lays ?? []),
            ...(state.trackStep?.extraLays ?? [])
        ]
        if (laidThisRound.some((lay) => lay.locationId === request.locationId))
            return 'A tile laid this round cannot be upgraded the same round.'
        // Non-big green cities no longer split in phase D (§12.3.2, §15.7).
        const placed = new RailwayMapState(
            EighteenNinetyFourMap,
            EighteenNinetyFourTileSet,
            state.tileInventory
        ).tile(request.locationId).placement
        if (state.phaseId === 'D' && placed && placed.definitionId in SplitCityTiles)
            return 'Green cities cannot be upgraded in phase D.'
        // Paris's marked city stays the marked city of every tile (§12.2).
        if (request.locationId === ParisLocationId && request.nodeMapping['city-0'] !== 'city-0')
            return 'The PLM’s station space must stay on the marked city.'
        return undefined
    }
}
