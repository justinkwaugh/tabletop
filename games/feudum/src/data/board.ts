import type { VesselType } from './components.js'
import { RegionIds, type RegionId } from './regionTiles.js'
import type { MapDirection } from './tracks.js'

export type SpaceId = `space.${RegionId}.${number}`

/** R-1.2.1 One of the 22 location spaces. */
export interface Space {
    readonly id: SpaceId
    readonly region: RegionId
    readonly letters: readonly MapDirection[]
    /** The printed starting mark (R-1.4.9). */
    readonly startingSpace: boolean
    /** R-1.2.2 Reached by a ship or submersible route. */
    readonly port: boolean
}

/** R-1.2.1 In region order, then by number. */
export const Spaces: readonly Space[] = [
    { id: 'space.sea.1', region: 'sea', letters: ['N'], startingSpace: false, port: true },
    { id: 'space.sea.2', region: 'sea', letters: ['S', 'W'], startingSpace: false, port: true },
    { id: 'space.sea.3', region: 'sea', letters: ['E'], startingSpace: false, port: true },
    { id: 'space.island.1', region: 'island', letters: ['N'], startingSpace: false, port: true },
    { id: 'space.island.2', region: 'island', letters: ['E'], startingSpace: false, port: true },
    { id: 'space.island.3', region: 'island', letters: ['W'], startingSpace: false, port: true },
    { id: 'space.island.4', region: 'island', letters: ['S'], startingSpace: false, port: false },
    {
        id: 'space.forest.1',
        region: 'forest',
        letters: ['N', 'W'],
        startingSpace: false,
        port: true
    },
    { id: 'space.forest.2', region: 'forest', letters: [], startingSpace: true, port: false },
    {
        id: 'space.forest.3',
        region: 'forest',
        letters: ['S', 'E'],
        startingSpace: true,
        port: false
    },
    { id: 'space.desert.1', region: 'desert', letters: ['N'], startingSpace: false, port: true },
    {
        id: 'space.desert.2',
        region: 'desert',
        letters: ['S', 'W'],
        startingSpace: false,
        port: true
    },
    { id: 'space.desert.3', region: 'desert', letters: [], startingSpace: true, port: false },
    { id: 'space.desert.4', region: 'desert', letters: [], startingSpace: true, port: false },
    { id: 'space.desert.5', region: 'desert', letters: ['E'], startingSpace: false, port: false },
    {
        id: 'space.badlands.1',
        region: 'badlands',
        letters: ['N', 'W'],
        startingSpace: true,
        port: false
    },
    { id: 'space.badlands.2', region: 'badlands', letters: [], startingSpace: false, port: true },
    { id: 'space.badlands.3', region: 'badlands', letters: [], startingSpace: false, port: true },
    { id: 'space.badlands.4', region: 'badlands', letters: [], startingSpace: true, port: false },
    {
        id: 'space.badlands.5',
        region: 'badlands',
        letters: ['S', 'E'],
        startingSpace: false,
        port: false
    },
    {
        id: 'space.mountain.1',
        region: 'mountain',
        letters: ['N', 'W'],
        startingSpace: false,
        port: false
    },
    {
        id: 'space.mountain.2',
        region: 'mountain',
        letters: ['S', 'E'],
        startingSpace: false,
        port: true
    }
]

/** R-1.2.1 A region's name is its terrain. */
export interface Region {
    readonly id: `region.${RegionId}`
    readonly region: RegionId
    readonly spaces: readonly Space[]
}

/** R-1.2.1 Left to right on the board. */
export const Regions: readonly Region[] = RegionIds.map((region) => ({
    id: `region.${region}`,
    region,
    spaces: Spaces.filter((space) => space.region === region)
}))

/** R-1.2.2 */
export type RouteMedium = 'road' | VesselType | 'ferry'
export const RouteMedia: readonly RouteMedium[] = [
    'road',
    'ship',
    'submersible',
    'flying-machine',
    'ferry'
]

export type RouteId = `route.${RouteMedium}.${RegionId}-${number}--${RegionId}-${number}`

/** R-1.2-H1 Undirected and listed once, its endpoints in region order. */
export interface Route {
    readonly id: RouteId
    readonly medium: RouteMedium
    readonly a: SpaceId
    readonly b: SpaceId
}

type Leg = readonly [RegionId, number, RegionId, number]

function routes(medium: RouteMedium, legs: readonly Leg[]): Route[] {
    return legs.map(([aRegion, aNumber, bRegion, bNumber]) => ({
        id: `route.${medium}.${aRegion}-${aNumber}--${bRegion}-${bNumber}`,
        medium,
        a: `space.${aRegion}.${aNumber}`,
        b: `space.${bRegion}.${bNumber}`
    }))
}

/** R-1.2-H1, R-1.2.2 As printed on the board, by medium; `docs/board-map.md` lists them. */
export const Routes: readonly Route[] = [
    ...routes('road', [
        ['forest', 1, 'forest', 2],
        ['forest', 2, 'forest', 3],
        ['forest', 2, 'badlands', 1],
        ['forest', 3, 'badlands', 1],
        ['forest', 3, 'desert', 4],
        ['badlands', 1, 'badlands', 2],
        ['badlands', 2, 'badlands', 4],
        ['desert', 3, 'desert', 4],
        ['desert', 1, 'desert', 3],
        ['desert', 2, 'desert', 5],
        ['island', 1, 'island', 2],
        ['island', 3, 'island', 4],
        ['mountain', 1, 'mountain', 2]
    ]),
    ...routes('ship', [
        ['sea', 1, 'forest', 1],
        ['sea', 1, 'sea', 2],
        ['sea', 2, 'island', 3],
        ['island', 3, 'desert', 2],
        ['desert', 1, 'desert', 2],
        ['desert', 1, 'badlands', 3],
        ['badlands', 2, 'badlands', 3],
        ['badlands', 2, 'mountain', 2]
    ]),
    ...routes('submersible', [
        ['sea', 1, 'forest', 1],
        ['island', 1, 'forest', 1],
        ['sea', 1, 'sea', 2],
        ['sea', 2, 'island', 3],
        ['sea', 2, 'island', 2],
        ['sea', 3, 'island', 1],
        ['sea', 3, 'desert', 1],
        ['desert', 1, 'desert', 2],
        ['island', 3, 'desert', 2]
    ]),
    ...routes('flying-machine', [
        ['island', 2, 'desert', 1],
        ['island', 2, 'island', 4],
        ['island', 4, 'desert', 2],
        ['desert', 2, 'desert', 5],
        ['desert', 5, 'badlands', 5],
        ['badlands', 5, 'mountain', 2],
        ['mountain', 1, 'mountain', 2],
        ['badlands', 2, 'mountain', 1]
    ]),
    ...routes('ferry', [
        ['island', 1, 'forest', 2],
        ['desert', 4, 'desert', 5],
        ['badlands', 4, 'mountain', 2]
    ])
]
