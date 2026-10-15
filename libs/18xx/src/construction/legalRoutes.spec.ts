import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import { RailwayMapState } from '../map/mapState.js'
import type { StationState } from '../map/station.js'
import {
    createCityTileFace,
    createOffboardTileFace,
    createTownTileFace,
    createTrackTileFace
} from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import type { TileFace } from '../tiles/tile.js'
import { ConstructionReachability } from './constructionReachability.js'
import { TrackNetwork } from './trackNetwork.js'

const tiles = new TileSet({ id: 'empty', entries: [] }, [])
const empty = createTrackTileFace('white', [])

// Locations are named by their axial coordinates. On a flat map edge 0 faces r + 1, edge 1 faces
// q - 1 and r + 1, edge 2 faces q - 1, edge 3 faces r - 1, edge 4 faces q + 1 and r - 1, and
// edge 5 faces q + 1.
function board(locations: Record<string, TileFace>): RailwayMapState {
    return new RailwayMapState(
        new RailwayMap({
            id: 'reach',
            name: 'Reach',
            orientation: HexOrientation.Flat,
            locations: Object.entries(locations).map(([id, preprintedTile]) => {
                const [q, r] = id.split(',').map(Number)
                return { id, coordinates: { q, r }, preprintedTile, buildable: true }
            })
        }),
        tiles,
        tiles.createInventory()
    )
}
function home(locationId: string, rivalAt?: string): StationState {
    return {
        stations: [
            {
                id: 'home',
                companyId: 'A',
                status: 'placed',
                position: { locationId, nodeId: 'city' }
            },
            ...(rivalAt
                ? [
                      {
                          id: 'rival',
                          companyId: 'B',
                          status: 'placed' as const,
                          position: { locationId: rivalAt, nodeId: 'city' }
                      }
                  ]
                : [])
        ],
        stationReservations: []
    }
}
const through = createCityTileFace('yellow', [3, 0], 20, 1)

// Home leads through a switch into a dead-end city. The switch's other branch leads to -1,2, which
// only a route leaving the dead end the way it came could reach.
const deadEnd = {
    '0,0': createCityTileFace('yellow', [0], 20, 1),
    '0,1': createTrackTileFace('green', [
        [3, 0],
        [0, 1]
    ]),
    '0,2': createCityTileFace('gray', [3], 10, 1),
    '-1,2': empty
}

it('does not leave a stop along the track it arrived on', () => {
    const mapState = board(deadEnd)
    const reachability = new ConstructionReachability(mapState, home('0,0'), 'A')
    expect(reachability.canReach('0,2')).toBe(true)
    expect(reachability.canReach('-1,2')).toBe(false)
    const network = new TrackNetwork(mapState, home('0,0'), 'A')
    expect(network.reaches('0,2', { kind: 'node', nodeId: 'city' })).toBe(true)
    expect(network.usesPath('0,1', deadEnd['0,1'].paths[1].id)).toBe(false)
})

it('connects a replacement only along track a route can follow', () => {
    const reachability = new ConstructionReachability(board(deadEnd), home('0,0'), 'A')
    const { paths } = reachability.connections('0,1', deadEnd['0,1'], home('0,0'))
    expect(paths).toEqual(new Set([deadEnd['0,1'].paths[0].id]))
})

it('does not pass a stop twice to reach the other branch of a switch', () => {
    // Home leads through a switch to a town, round a loop and back into the town. Only a route
    // passing the town again could leave it towards the switch and take its other branch to -1,2.
    const mapState = board({
        '0,0': createCityTileFace('yellow', [0], 20, 1),
        '0,1': deadEnd['0,1'],
        '0,2': createTownTileFace('green', [[3, 4, 5]], 10),
        '1,1': createTrackTileFace('yellow', [[1, 0]]),
        '1,2': createTrackTileFace('yellow', [[3, 2]]),
        '-1,2': empty
    })
    const reachability = new ConstructionReachability(mapState, home('0,0'), 'A')
    expect(reachability.canReach('1,2')).toBe(true)
    expect(reachability.canReach('-1,2')).toBe(false)
    expect(
        new TrackNetwork(mapState, home('0,0'), 'A').usesPath('0,1', deadEnd['0,1'].paths[1].id)
    ).toBe(false)
})

it('does not cross a hex side twice', () => {
    // Home leads through a switch at 0,0 into another switch at 0,1, round a loop through a city
    // and back across the same side into 0,0, where only that second crossing could take the
    // branch to -1,1.
    const mapState = board({
        '0,-1': createCityTileFace('yellow', [0], 20, 1),
        '0,0': createTrackTileFace('green', [
            [3, 0],
            [0, 1]
        ]),
        '0,1': createTrackTileFace('green', [
            [3, 1],
            [3, 5]
        ]),
        '-1,2': createTrackTileFace('yellow', [[4, 5]]),
        '0,2': createCityTileFace('yellow', [2, 4], 20, 1),
        '1,1': createTrackTileFace('yellow', [[1, 2]]),
        '-1,1': empty
    })
    const reachability = new ConstructionReachability(mapState, home('0,-1'), 'A')
    expect(reachability.canReach('1,1')).toBe(true)
    expect(reachability.canReach('-1,1')).toBe(false)
})

it('reaches a full rival city but goes no further', () => {
    const mapState = board({
        '0,0': createCityTileFace('yellow', [0], 20, 1),
        '0,1': through,
        '0,2': empty
    })
    const stations = home('0,0', '0,1')
    const reachability = new ConstructionReachability(mapState, stations, 'A')
    expect(reachability.canReach('0,1')).toBe(true)
    expect(reachability.canReach('0,2')).toBe(false)
    const network = new TrackNetwork(mapState, stations, 'A')
    expect(network.reaches('0,1', { kind: 'node', nodeId: 'city' })).toBe(true)
    expect(network.isBlocked('0,1', 'city')).toBe(true)
    expect(network.usesPath('0,1', through.paths[1].id)).toBe(false)
})

it('does not pass through an offboard', () => {
    const mapState = board({
        '0,0': createCityTileFace('yellow', [0], 20, 1),
        '0,1': createOffboardTileFace([3, 0], { kind: 'fixed', amount: 30 }),
        '0,2': empty
    })
    const reachability = new ConstructionReachability(mapState, home('0,0'), 'A')
    expect(reachability.canReach('0,1')).toBe(true)
    expect(reachability.canReach('0,2')).toBe(false)
    const network = new TrackNetwork(mapState, home('0,0'), 'A')
    expect(network.reaches('0,1', { kind: 'node', nodeId: 'offboard' })).toBe(true)
    expect(network.isBlocked('0,1', 'offboard')).toBe(false)
})

it('connects a replacement from a station on it', () => {
    const upgraded = createCityTileFace('green', [0, 2], 30, 2)
    const reachability = new ConstructionReachability(
        board({ '0,0': createCityTileFace('yellow', [0], 20, 1), '0,1': empty, '-1,0': empty }),
        home('0,0'),
        'A'
    )
    const { paths, nodes } = reachability.connections('0,0', upgraded, home('0,0'))
    expect(paths).toEqual(new Set(upgraded.paths.map((path) => path.id)))
    expect(nodes).toEqual(new Set(['city']))
})

it('does not connect a replacement through a full rival city on it', () => {
    const mapState = board({
        '0,0': createCityTileFace('yellow', [0], 20, 1),
        '0,1': through,
        '0,2': empty
    })
    const stations = home('0,0', '0,1')
    const upgraded = createCityTileFace('green', [3, 0, 1], 30, 1)
    const { paths, nodes } = new ConstructionReachability(mapState, stations, 'A').connections(
        '0,1',
        upgraded,
        stations
    )
    expect(paths).toEqual(new Set([upgraded.paths[0].id]))
    expect(nodes).toEqual(new Set(['city']))
})
