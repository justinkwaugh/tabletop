import { expect, it } from 'vitest'
import type { TileEdge } from '@tabletop/18xx'
import { EighteenThirtyMap } from './index.js'

const edgesOf = (locationId: string) =>
    EighteenThirtyMap.location(locationId).preprintedTile.paths.flatMap((path) =>
        path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
    )

const Edges: readonly TileEdge[] = [0, 1, 2, 3, 4, 5]

it('places neighbors around pointy hexes', () => {
    const neighbors = (id: string) => Edges.map((edge) => EighteenThirtyMap.neighbor(id, edge)?.id)
    expect(neighbors('H12')).toEqual(['I11', 'H10', 'G11', 'G13', 'H14', 'I13'])
    expect(neighbors('A19')).toEqual(['B18', 'A17', undefined, undefined, undefined, 'B20'])
})

it('points every printed track at a neighboring hex', () => {
    for (const location of EighteenThirtyMap.definition.locations)
        for (const edge of edgesOf(location.id))
            expect(
                EighteenThirtyMap.neighbor(location.id, edge),
                `${location.id} edge ${edge}`
            ).toBeDefined()
})

it('joins printed track across hex edges', () => {
    const fixed = ['gray', 'red']
    for (const location of EighteenThirtyMap.definition.locations) {
        if (!fixed.includes(location.preprintedTile.color)) continue
        for (const edge of edgesOf(location.id)) {
            const neighbor = EighteenThirtyMap.neighbor(location.id, edge)!
            if (!fixed.includes(neighbor.preprintedTile.color)) continue
            expect(edgesOf(neighbor.id), `${location.id} edge ${edge}`).toContain((edge + 3) % 6)
        }
    }
})

it('draws impassable borders between existing hexes', () => {
    for (const location of EighteenThirtyMap.definition.locations)
        for (const border of location.borders ?? [])
            expect(EighteenThirtyMap.neighbor(location.id, border.edge)).toBeDefined()
})

it('makes Canada one stop and, as the reference does, leaves the Gulf hexes separate', () => {
    const group = (id: string) => EighteenThirtyMap.location(id).stopGroup
    expect([group('A9'), group('A11')]).toEqual(['Canada', 'Canada'])
    expect([group('I1'), group('J2')]).toEqual([undefined, undefined])
})
