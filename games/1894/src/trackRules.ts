import { sameStopCounts, type TrackRules } from '@tabletop/18xx'
import { EighteenNinetyFourMap, ParisLocationId } from './map.js'
import { EighteenNinetyFourTileSet } from './tiles.js'
import { EighteenNinetyFourPhases } from './trains.js'
import { EighteenNinetyFourPrivateCatalog } from './privates.js'

/** A track action that replaced a tile: every green or brown tile laid (§7.3.3). */
const isUpgrade = (color: string) => color !== 'yellow'

export const EighteenNinetyFourTrackRules: TrackRules = {
    map: EighteenNinetyFourMap,
    tileSet: EighteenNinetyFourTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors: (state) => EighteenNinetyFourPhases.phase(state.phaseId).tileColors,
    // Two track actions a round, at most one of them an upgrade (§7.3.3).
    allowance(state, color, upgrade) {
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
    useful: ({ home, connected }) => home || connected,
    homeLocations: (companyId) => EighteenNinetyFourMap.reservedLocationIds(companyId),
    restriction(state, request) {
        if (EighteenNinetyFourPrivateCatalog.blockedBy(state, request.locationId))
            return 'A player-owned private company blocks this hex.'
        if (state.trackStep?.lays.some((lay) => lay.locationId === request.locationId))
            return 'A tile laid this round cannot be upgraded the same round.'
        // Paris's marked city stays the marked city of every tile (§12.2).
        if (request.locationId === ParisLocationId && request.nodeMapping['city-0'] !== 'city-0')
            return 'The PLM’s station space must stay on the marked city.'
        return undefined
    }
}
