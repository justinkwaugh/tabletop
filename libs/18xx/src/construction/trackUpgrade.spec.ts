import { expect, it } from 'vitest'
import {
    createTrackTileFace,
    createCityTileFace,
    createSeparateCitiesTileFace
} from '../tiles/faces.js'
import { tileUpgradeMappings, preservesPath } from './trackUpgrade.js'
import type { TileFace } from '../tiles/tile.js'
it('preserves independent tracks, not merely their exits', () => {
    const before = createTrackTileFace('yellow', [
        [0, 3],
        [1, 4]
    ])
    expect(
        tileUpgradeMappings(
            before,
            createTrackTileFace('green', [
                [0, 4],
                [1, 3]
            ])
        )
    ).toEqual([])
    expect(
        tileUpgradeMappings(
            before,
            createTrackTileFace('green', [
                [0, 3],
                [1, 4],
                [2, 5]
            ])
        )
    ).toEqual([{}])
})
it('permits a path through a junction but not an inserted revenue stop', () => {
    const path = createTrackTileFace('yellow', [[0, 3]]).paths[0]
    const city = createCityTileFace('green', [0, 3], 30, 2)
    expect(preservesPath(path, city, {})).toBe(false)
    expect(preservesPath(path, { ...city, nodes: [{ id: 'city', kind: 'junction' }] }, {})).toBe(
        true
    )
})
it('maps renamed cities and preserves distinct cities unless they merge', () => {
    const city = createCityTileFace('yellow', [0], 20, 1)
    const after: TileFace = {
        ...city,
        color: 'green',
        nodes: city.nodes.map((node) => ({ ...node, id: 'new' })),
        paths: [
            {
                id: 'route',
                endpoints: [
                    { kind: 'edge', edge: 0 },
                    { kind: 'node', nodeId: 'new' }
                ]
            }
        ]
    }
    expect(tileUpgradeMappings(city, after)).toEqual([{ city: 'new' }])
})
it('keeps the order of cities that have no track', () => {
    const cities = (color: string, first: readonly (0 | 2)[], second: readonly (0 | 2)[]) =>
        createSeparateCitiesTileFace(color, [
            { edges: first, revenue: 0, stationSlots: 1 },
            { edges: second, revenue: 0, stationSlots: 1 }
        ])
    expect(tileUpgradeMappings(cities('yellow', [], []), cities('green', [0], [2]))).toEqual([
        { 'city-0': 'city-0', 'city-1': 'city-1' }
    ])
    expect(tileUpgradeMappings(cities('yellow', [0], []), cities('green', [2], [0]))).toEqual([
        { 'city-0': 'city-1', 'city-1': 'city-0' }
    ])
})
