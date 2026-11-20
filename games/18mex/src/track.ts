import {
    getCompany,
    sameStopCounts,
    type ConstructionState,
    type TileFace,
    type TrackRules
} from '@tabletop/18xx'
import { MinorIdsMex } from './companies.js'
import {
    CopperCanyonLabel,
    MapMex,
    MexicoCityLocationId,
    PueblaLocationId,
    homeLocationMex
} from './map.js'
import { requireStateMex } from './state.js'
import {
    CopperCanyonTileId,
    MexicoCityPairs,
    TileSetMex,
    mapStateMex,
    tileFaceMex
} from './tiles.js'
import { PhasesMex } from './trains.js'

/** Whether each of the turn's lays so far was an upgrade: any tile but a yellow one (4.4.1(c)). */
function laysThisTurn(state: ConstructionState): boolean[] {
    return (state.trackStep?.lays ?? []).map(
        (lay) => !!lay.definitionId && tileFaceMex(lay.definitionId).color !== 'yellow'
    )
}

/** The yellow lays a major may make in its turn: two, or three in its first under 8(a). */
function yellowLays(state: ConstructionState, companyId: string): number {
    return requireStateMex(state).options.threeYellowLays && !getCompany(state, companyId).operated
        ? 3
        : 2
}

/** The Mexico City pair holding this tile, if it is one of its halves. */
function mexicoCityPair(definitionId: string): Readonly<Record<string, string>> | undefined {
    return MexicoCityPairs.find((pair) => Object.values(pair).includes(definitionId))
}

/**
 * Puebla's printed cost, paid on the double hex's upgrades whichever half the tile is laid from:
 * $60 for the first, $40 printed on the green tile (Table IV).
 */
function pueblaCost(state: ConstructionState): number {
    const tile = mapStateMex(state).tile(PueblaLocationId)
    return (
        (tile.placement ? 0 : (MapMex.location(PueblaLocationId).terrain?.cost ?? 0)) +
        (tile.face.upgradeCost ?? 0)
    )
}

/** An upgrade keeps its stops; the Copper Canyon tile brings its own town (Table III). */
export function preservesStopsMex(before: TileFace, after: TileFace): boolean {
    return sameStopCounts(before, after) || after.labels.includes(CopperCanyonLabel)
}

export const TrackRulesMex: TrackRules = {
    map: MapMex,
    tileSet: TileSetMex,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => PhasesMex.phase(state.phaseId).tileColors,
    // A major lays one or two yellow tiles or upgrades one; a minor lays one yellow tile
    // (4.2(b), 4.3(c), 4.4.1(a)).
    allowance(state, color) {
        const companyId = state.trackStep?.companyId
        if (!companyId) return { reason: 'It is not a track step.' }
        const lays = [...laysThisTurn(state), color !== 'yellow']
        const upgrades = lays.filter((upgrade) => upgrade).length
        const yellows = lays.length - upgrades
        if (MinorIdsMex.includes(companyId))
            return upgrades === 0 && yellows === 1
                ? { cost: 0 }
                : { reason: 'A minor company lays one yellow tile.' }
        const limit = yellowLays(state, companyId)
        return (upgrades === 0 && yellows <= limit) || (upgrades === 1 && yellows === 0)
            ? { cost: 0 }
            : {
                  reason: `A major company lays ${limit === 3 ? 'three' : 'two'} yellow tiles or upgrades one.`
              }
    },
    preservesStops: (before, after) => preservesStopsMex(before, after),
    // A lay needs new track, or a city, connected to the company's stations (4.4.1(j), TR-2).
    useful: ({ home, newTrack, connectedCity }) => home || newTrack || connectedCity,
    homeLocations: (companyId) => [homeLocationMex(companyId)],
    terrainCost: (state, request, cost) =>
        request.locationId === MexicoCityLocationId ? cost + pueblaCost(state) : cost,
    restriction(_state, request) {
        if (request.definitionId === CopperCanyonTileId)
            return 'Only a company owning the KCM&O lays the Copper Canyon tile.'
        const pair = mexicoCityPair(request.definitionId)
        if (pair) {
            if (request.locationId !== MexicoCityLocationId)
                return 'The Mexico City double tile is laid from Mexico City.'
            if (request.rotation !== 0) return 'The Mexico City tiles lie only as printed.'
        }
        return undefined
    },
    // The Mexico City tiles are double hexes, Puebla's half laid with Mexico City's (4.4.1(g)).
    companionTiles(_state, details) {
        const pair = mexicoCityPair(details.definitionId)
        if (!pair || details.locationId !== MexicoCityLocationId) return []
        return [{ locationId: PueblaLocationId, definitionId: pair[PueblaLocationId], rotation: 0 }]
    }
}
