import { expect, it } from 'vitest'
import { TileEdges } from '@tabletop/18xx'
import { EighteenSeventeenMap } from './index.js'

const edgesOf = (locationId: string) =>
    EighteenSeventeenMap.location(locationId).preprintedTile.paths.flatMap((path) =>
        path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
    )

it('draws the 92 hexes of the pointy map', () => {
    expect(EighteenSeventeenMap.definition.locations).toHaveLength(92)
    expect(EighteenSeventeenMap.location('E22').name).toBe('New York')
    expect(EighteenSeventeenMap.location('E22').preprintedTile.labels).toEqual(['NY'])
    expect(
        ['C8', 'C26', 'G18'].map((id) => EighteenSeventeenMap.location(id).preprintedTile.labels)
    ).toEqual([['B'], ['B'], ['B']])
})

it('points every printed track at a neighboring hex', () => {
    for (const location of EighteenSeventeenMap.definition.locations)
        for (const edge of edgesOf(location.id))
            expect(
                EighteenSeventeenMap.neighbor(location.id, edge),
                `${location.id} edge ${edge}`
            ).toBeDefined()
})

it('places neighbors around pointy hexes', () => {
    const neighbors = (id: string) =>
        TileEdges.map((edge) => EighteenSeventeenMap.neighbor(id, edge)?.id)
    expect(neighbors('F13')).toEqual(['G12', 'F11', 'E12', 'E14', 'F15', 'G14'])
})

it('keeps the impassable border between C10 and D11 on both sides', () => {
    expect(EighteenSeventeenMap.neighbor('C10', 5)?.id).toBe('D11')
    expect(EighteenSeventeenMap.neighbor('D11', 2)?.id).toBe('C10')
})

it('charges the printed terrain costs', () => {
    const cost = (id: string) => EighteenSeventeenMap.location(id).terrain?.cost
    expect([cost('E16'), cost('D13'), cost('B9'), cost('C8'), cost('E22'), cost('B3')]).toEqual([
        15,
        10,
        20,
        20,
        20,
        undefined
    ])
})
