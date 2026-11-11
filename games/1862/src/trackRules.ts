import type { ConstructionState, TrackRules } from '@tabletop/18xx'
import { company1862 } from './companies.js'
import { homeBuildLocation } from './homes.js'
import { requireState1862 } from './state.js'
import { TileRules1862 } from './tileRules.js'
import { TileSet1862 } from './tiles.js'
import { Phases1862 } from './trains.js'

const definitions = new Map(TileSet1862.definitions.map((tile) => [tile.id, tile]))

function laidTile(definitionId: string | undefined) {
    const tile = definitionId ? definitions.get(definitionId) : undefined
    return tile && { upgrade: tile.face.color !== 'yellow', n: tile.face.labels.includes('N') }
}

/** What the company has built this turn: none, yellow tiles, or its one build (§7.6). */
function turnBuild(state: ConstructionState): 'none' | 'yellow' | 'single' {
    const title = requireState1862(state)
    if (title.build) return 'single'
    const lays = state.trackStep?.lays.map((lay) => laidTile(lay.definitionId)) ?? []
    if (!lays.length) return 'none'
    return lays.some((lay) => !lay || lay.upgrade || lay.n) || lays.length >= 2
        ? 'single'
        : 'yellow'
}

export const TrackRules1862: TrackRules = {
    ...TileRules1862,
    availableColors: (state) => Phases1862.phase(state.phaseId).tileColors,
    // One N tile, two other yellow tiles, or one upgrade; small stations and London links are
    // the turn's build too (§7.6).
    allowance(state, color, upgrade) {
        if (requireState1862(state).lner)
            return { reason: 'No track is built once the LNER forms.' }
        const built = turnBuild(state)
        if (built === 'single') return { reason: 'The company has made its build this turn.' }
        if (upgrade && built !== 'none')
            return { reason: 'An upgrade is the whole of a turn’s build.' }
        if (color !== 'yellow' && !upgrade) return { reason: 'Only yellow tiles are laid new.' }
        return { cost: 0 }
    },
    restriction(state, request) {
        const tile = laidTile(request.definitionId)
        if (tile?.n && state.trackStep?.lays.length)
            return 'A yellow N tile is the whole of a turn’s build.'
        const home = homeBuildLocation(state, request.companyId)
        if (home && request.locationId !== home)
            return 'The company’s first build must make room for its home station.'
        return undefined
    },
    // New track or a large station on the company's routes (§7.6.1, §7.6.3).
    useful: ({ home, connected, newTrack, connectedCity }) =>
        home || (connected && (newTrack || connectedCity)),
    homeLocations: (companyId) => {
        const home = company1862(companyId)?.home
        return home ? [home] : []
    }
}
