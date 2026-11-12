import { describe, expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import { RailwayMapState } from '../map/mapState.js'
import type { StationState } from '../map/station.js'
import {
    createCityTileFace as city,
    createTownTileFace as town,
    createTrackTileFace as track
} from '../tiles/faces.js'
import { TileCatalog } from '../tiles/catalog.js'
import { TileSet } from '../tiles/inventory.js'
import type { TileFace, TrackGauge } from '../tiles/tile.js'
import { ConstructionReachability } from './constructionReachability.js'
import { layAddedTrack } from './trackConstruction.js'
import { TrackNetwork } from './trackNetwork.js'
import { addedTrack, preservesPath, tileUpgradeMappings } from './trackUpgrade.js'

function gauged(
    face: TileFace,
    gauge: TrackGauge | Readonly<Record<string, TrackGauge>>
): TileFace {
    return {
        ...face,
        paths: face.paths.map((path) => {
            const pathGauge = typeof gauge === 'string' ? gauge : gauge[path.id]
            return pathGauge ? { ...path, gauge: pathGauge } : path
        })
    }
}

const empty = new TileSet({ id: 'empty', entries: [] }, [])

// A column of hexes, each joined to the next by its edge 0 and the next one's edge 3.
function column(faces: readonly TileFace[], tileSet: TileSet = empty): RailwayMapState {
    return new RailwayMapState(
        new RailwayMap({
            id: 'gauges',
            name: 'Gauges',
            orientation: HexOrientation.Flat,
            locations: faces.map((preprintedTile, r) => ({
                id: String(r),
                coordinates: { q: 0, r },
                preprintedTile,
                buildable: true
            }))
        }),
        tileSet,
        tileSet.createInventory()
    )
}

const stations: StationState = {
    stations: [
        {
            id: 'home',
            companyId: 'A',
            status: 'placed',
            position: { locationId: '0', nodeId: 'city', slot: 0 }
        }
    ],
    stationReservations: []
}

const reachesEnd = (faces: readonly TileFace[]) =>
    new TrackNetwork(column(faces), stations, 'A').reaches(String(faces.length - 1), {
        kind: 'node',
        nodeId: 'city'
    })

describe('connected track', () => {
    const narrowHome = gauged(city('yellow', [0], 20, 1), 'narrow')
    const standardCity = city('yellow', [3], 20, 1)

    it('changes gauge only at a stop, dual track keeping the gauge it is entered on', () => {
        expect(
            reachesEnd([narrowHome, gauged(track('yellow', [[3, 0]]), 'dual'), standardCity])
        ).toBe(false)
        expect(
            reachesEnd([narrowHome, gauged(town('yellow', [[3, 0]], 10), 'dual'), standardCity])
        ).toBe(true)
        expect(
            reachesEnd([
                narrowHome,
                gauged(track('yellow', [[3, 0]]), 'dual'),
                gauged(standardCity, 'narrow')
            ])
        ).toBe(true)
        expect(
            reachesEnd([
                gauged(city('yellow', [0], 20, 1), 'dual'),
                gauged(track('yellow', [[3, 0]]), 'dual'),
                standardCity
            ])
        ).toBe(true)
    })

    it('does not join narrow and standard track that meet at a hex side', () => {
        expect(reachesEnd([narrowHome, track('yellow', [[3, 0]]), standardCity])).toBe(false)
        expect(
            reachesEnd([
                narrowHome,
                gauged(track('yellow', [[3, 0]]), 'narrow'),
                gauged(standardCity, 'dual')
            ])
        ).toBe(true)
    })

    it('leaves a mixed-gauge city by track of either gauge', () => {
        const mixed = gauged(city('green', [3, 0], 30, 2), { 'edge-3': 'narrow' })
        expect(reachesEnd([narrowHome, mixed, standardCity])).toBe(true)
    })
})

describe('construction reachability', () => {
    const reachability = new ConstructionReachability(
        column([gauged(city('yellow', [0], 20, 1), 'narrow'), track('white', [])]),
        stations,
        'A'
    )
    const connected = (face: TileFace) => [...reachability.connections('1', face, stations).paths]

    it('connects a new tile’s track of the gauge a route enters by', () => {
        expect(connected(track('yellow', [[3, 0]]))).toEqual([])
        expect(connected(gauged(track('yellow', [[3, 0]]), 'narrow'))).toEqual(['path-0'])
        expect(connected(gauged(track('yellow', [[3, 0]]), 'dual'))).toEqual(['path-0'])
    })

    it('connects track of another gauge beyond a stop on the new tile', () => {
        const mixedTown = gauged(town('yellow', [[3, 0]], 10), { 'town-edge-3': 'narrow' })
        expect(connected(mixedTown).sort()).toEqual(['town-edge-0', 'town-edge-3'])
        const junction: TileFace = gauged(
            {
                ...town('yellow', [[3, 0]], 10),
                nodes: [{ id: 'town', kind: 'junction' }]
            },
            { 'town-edge-3': 'narrow' }
        )
        expect(connected(junction)).toEqual(['town-edge-3'])
    })
})

describe('tile upgrades', () => {
    const line = (gauge?: TrackGauge) => {
        const face = track('yellow', [[0, 3]])
        return gauge ? gauged(face, gauge) : face
    }

    it('keeps standard track by standard or dual track, narrow by narrow or dual', () => {
        const kept = (before?: TrackGauge, after?: TrackGauge) =>
            preservesPath(line(before).paths[0], line(after), {})
        expect(kept(undefined, undefined)).toBe(true)
        expect(kept(undefined, 'dual')).toBe(true)
        expect(kept(undefined, 'narrow')).toBe(false)
        expect(kept('narrow', 'narrow')).toBe(true)
        expect(kept('narrow', 'dual')).toBe(true)
        expect(kept('narrow', undefined)).toBe(false)
        expect(kept('dual', 'dual')).toBe(true)
        expect(kept('dual', 'narrow')).toBe(false)
    })

    it('maps a mixed-gauge city only onto a city keeping each exit’s gauge', () => {
        const before = gauged(city('yellow', [0, 3], 20, 1), { 'edge-3': 'narrow' })
        const after = (gauges: Readonly<Record<string, TrackGauge>>) =>
            tileUpgradeMappings(before, gauged(city('green', [0, 1, 3], 30, 2), gauges))
        expect(after({ 'edge-3': 'narrow', 'edge-1': 'narrow' })).toEqual([{ city: 'city' }])
        expect(after({ 'edge-3': 'dual', 'edge-0': 'dual' })).toEqual([{ city: 'city' }])
        expect(after({ 'edge-0': 'narrow', 'edge-3': 'narrow' })).toEqual([])
        expect(after({})).toEqual([])
    })

    it('counts track changing to dual as added track, with its gauge', () => {
        const before = gauged(town('yellow', [[0, 3]], 10), 'narrow')
        const after = gauged(town('green', [[0, 3, 1]], 20), {
            'town-edge-0': 'narrow',
            'town-edge-3': 'dual',
            'town-edge-1': 'narrow'
        })
        expect(addedTrack(before, after, { town: 'town' })).toEqual([
            after.paths[1],
            after.paths[2]
        ])
    })

    it('finds a lay’s added track from the map and the request', () => {
        const definition = (id: string, face: TileFace) => ({
            id,
            printedNumber: id,
            aliases: [],
            scope: 'Test',
            face
        })
        const tileSet = new TileSet(
            {
                id: 'gauges',
                entries: [
                    { id: 'mixed', faceDefinitionIds: ['test:mixed'], count: 1 },
                    { id: 'dual', faceDefinitionIds: ['test:dual'], count: 1 }
                ]
            },
            [
                new TileCatalog([
                    definition(
                        'test:mixed',
                        gauged(
                            track('green', [
                                [3, 0],
                                [1, 4]
                            ]),
                            { 'path-0': 'narrow' }
                        )
                    ),
                    definition('test:dual', gauged(track('green', [[3, 0]]), 'dual'))
                ])
            ]
        )
        const mapState = column([gauged(track('yellow', [[0, 3]]), 'narrow')], tileSet)
        const rules = { map: mapState.map, tileSet }
        const state = { tileInventory: tileSet.createInventory() }
        const lay = (definitionId: string) =>
            layAddedTrack(state, rules, {
                locationId: '0',
                definitionId,
                rotation: 0,
                nodeMapping: {}
            }).map((path) => path.gauge ?? 'standard')
        expect(lay('test:mixed')).toEqual(['standard'])
        expect(lay('test:dual')).toEqual(['dual'])
    })
})
