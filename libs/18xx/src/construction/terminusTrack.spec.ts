import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import { RailwayMapState } from '../map/mapState.js'
import type { StationState } from '../map/station.js'
import { createCityTileFace, createTrackTileFace } from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import type { TileEdge, TileFace } from '../tiles/tile.js'
import { TrackNetwork } from './trackNetwork.js'

const tiles = new TileSet({ id: 'empty', entries: [] }, [])

function line(faces: readonly TileFace[]) {
    return new RailwayMapState(
        new RailwayMap({
            id: 'line',
            name: 'Line',
            orientation: HexOrientation.Flat,
            locations: faces.map((preprintedTile, r) => ({
                id: String(r),
                coordinates: { q: 0, r },
                preprintedTile,
                buildable: true
            }))
        }),
        tiles,
        tiles.createInventory()
    )
}

function stationAt(locationId: string): StationState {
    return {
        stations: [
            {
                id: 'home',
                companyId: 'A',
                status: 'placed',
                position: { locationId, nodeId: 'city', slot: 0 }
            }
        ],
        stationReservations: []
    }
}

/** A city some of whose track is terminus track, by the hex sides it leads to. */
function terminusCity(
    terminusEdges: readonly TileEdge[],
    openEdges: readonly TileEdge[]
): TileFace {
    const face = createCityTileFace('gray', [...terminusEdges, ...openEdges], 30, 2)
    return {
        ...face,
        paths: face.paths.map((path, index) =>
            index < terminusEdges.length ? { ...path, terminus: true as const } : path
        )
    }
}

const city = { kind: 'node', nodeId: 'city' } as const

it('reaches a terminus city but nothing beyond it', () => {
    const state = line([
        createCityTileFace('yellow', [0], 20, 1),
        terminusCity([3, 0], []),
        createCityTileFace('yellow', [3], 40, 1)
    ])
    const network = new TrackNetwork(state, stationAt('0'), 'A')
    expect(network.reaches('1', city)).toBe(true)
    expect(network.reaches('2', city)).toBe(false)
})

it('leaves a terminus city it has a station in by its terminus track', () => {
    const state = line([
        createCityTileFace('yellow', [0], 20, 1),
        terminusCity([3, 0], []),
        createCityTileFace('yellow', [3], 40, 1)
    ])
    const network = new TrackNetwork(state, stationAt('1'), 'A')
    expect(network.reaches('0', city)).toBe(true)
    expect(network.reaches('2', city)).toBe(true)
})

it('passes a city by its open track to end across terminus track, never the reverse', () => {
    // Hex 2 and hex 3 are joined by track that is a terminus at both of their cities.
    const state = line([
        createCityTileFace('yellow', [0], 20, 1),
        createCityTileFace('yellow', [3, 0], 20, 2),
        terminusCity([0], [3]),
        terminusCity([3], [0]),
        createCityTileFace('yellow', [3], 40, 1)
    ])
    const fromNorth = new TrackNetwork(state, stationAt('0'), 'A')
    expect(fromNorth.reaches('2', city)).toBe(true)
    expect(fromNorth.reaches('3', city)).toBe(true)
    expect(fromNorth.reaches('4', city)).toBe(false)
    const fromSouth = new TrackNetwork(state, stationAt('4'), 'A')
    expect(fromSouth.reaches('2', city)).toBe(true)
    expect(fromSouth.reaches('1', city)).toBe(false)
})

it('follows each lane of a hex side to the same lane across it', () => {
    const lanes = (edge: TileEdge): TileFace => ({
        color: 'gray',
        labels: [],
        nodes: [],
        paths: [
            {
                id: 'first',
                endpoints: [
                    { kind: 'edge', edge },
                    { kind: 'edge', edge: 1 }
                ]
            },
            {
                id: 'second',
                endpoints: [
                    { kind: 'edge', edge, lane: 1 },
                    { kind: 'edge', edge: 2 }
                ]
            }
        ]
    })
    const state = line([createCityTileFace('yellow', [0], 20, 1), lanes(3)])
    const single = new TrackNetwork(state, stationAt('0'), 'A')
    expect(single.usesPath('1', 'first')).toBe(true)
    expect(single.usesPath('1', 'second')).toBe(false)
    const cityOnSecondLane: TileFace = {
        ...createCityTileFace('yellow', [], 20, 1),
        paths: [{ id: 'out', endpoints: [{ kind: 'edge', edge: 0, lane: 1 }, city] }]
    }
    const second = new TrackNetwork(
        line([cityOnSecondLane, lanes(3), createTrackTileFace('gray', [[3, 0]])]),
        stationAt('0'),
        'A'
    )
    expect(second.usesPath('1', 'second')).toBe(true)
    expect(second.usesPath('1', 'first')).toBe(false)
})
