import { sameStopCounts, type TileFace, type TrackRules } from '@tabletop/18xx'
import { EighteenSeventeenMap } from './map.js'
import { EighteenSeventeenTileSet } from './tiles.js'
import { EighteenSeventeenPhases } from './trains.js'

const SecondLayCost = 20
const isUpgrade = (color: string) => color !== 'yellow'
const cityCount = (face: TileFace) => face.nodes.filter((node) => node.kind === 'city').length

// New York's two cities join into one on its gray tile.
function preservesStops(before: TileFace, after: TileFace): boolean {
    return (
        sameStopCounts(before, after) ||
        (before.labels.includes('NY') &&
            after.labels.includes('NY') &&
            cityCount(before) === 2 &&
            cityCount(after) === 1)
    )
}

export const EighteenSeventeenTrackRules: TrackRules = {
    map: EighteenSeventeenMap,
    tileSet: EighteenSeventeenTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => EighteenSeventeenPhases.phase(state.phaseId).tileColors,
    // Two lays a turn, of which at most one is an upgrade; the second costs $20.
    allowance(state, color) {
        const lays = state.trackStep?.lays ?? []
        if (!lays.length) return { cost: 0 }
        if (lays.length > 1) return { reason: '1817 permits two lays a turn' }
        if (isUpgrade(lays[0].color) && isUpgrade(color))
            return { reason: '1817 permits one upgrade a turn' }
        return { cost: SecondLayCost }
    },
    preservesStops,
    mostExits: (before) => before.nodes.some((node) => node.kind === 'city'),
    useful: ({ home, newTrack, increasedCityRevenue }) => home || newTrack || increasedCityRevenue,
    homeLocations: () => [],
    terrainCost: (_state, _request, cost) => cost,
    restriction(state, request) {
        if (state.trackStep?.lays.some((lay) => lay.locationId === request.locationId))
            return 'The second lay must be on a different hex'
        return undefined
    }
}
