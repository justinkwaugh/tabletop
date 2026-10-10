import { expect, it } from 'vitest'
import { TileEdges, routeRevenue } from '@tabletop/18xx'
import { EighteenThirtyTwoMap, revenueStages } from './index.js'

const edgesOf = (locationId: string) =>
    EighteenThirtyTwoMap.location(locationId).preprintedTile.paths.flatMap((path) =>
        path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
    )

it('uses the printed board’s coordinates, from Kansas City (O14) to Miami (AA28)', () => {
    expect(EighteenThirtyTwoMap.location('O14').name).toBe('Kansas City')
    expect(EighteenThirtyTwoMap.location('AA28').name).toBe('Miami')
    expect(EighteenThirtyTwoMap.definition.locations).toHaveLength(102)
})

it('places neighbors around pointy hexes', () => {
    const neighbors = (id: string) =>
        TileEdges.map((edge) => EighteenThirtyTwoMap.neighbor(id, edge)?.id)
    expect(neighbors('T29')).toEqual(['U28', 'T27', 'S28', 'S30', 'T31', undefined])
    expect(neighbors('S22')).toEqual(['T21', 'S20', 'R21', 'R23', 'S24', 'T23'])
})

it('points every printed track at a neighboring hex', () => {
    for (const location of EighteenThirtyTwoMap.definition.locations)
        for (const edge of edgesOf(location.id))
            expect(
                EighteenThirtyTwoMap.neighbor(location.id, edge),
                `${location.id} edge ${edge}`
            ).toBeDefined()
})

it('joins printed track across hex edges', () => {
    const fixed = ['gray', 'red']
    for (const location of EighteenThirtyTwoMap.definition.locations) {
        if (!fixed.includes(location.preprintedTile.color)) continue
        for (const edge of edgesOf(location.id)) {
            const neighbor = EighteenThirtyTwoMap.neighbor(location.id, edge)!
            if (!fixed.includes(neighbor.preprintedTile.color)) continue
            expect(edgesOf(neighbor.id), `${location.id} edge ${edge}`).toContain((edge + 3) % 6)
        }
    }
})

it('reserves each home, with Georgia and the Atlanta & West Point in two Atlanta cities', () => {
    expect(
        EighteenThirtyTwoMap.stationReservations().map(
            (reservation) =>
                `${reservation.companyId} ${reservation.locationId}/${reservation.nodeId}`
        )
    ).toEqual([
        'NW O36/city',
        'GMO W14/city',
        'GRR S22/city-0',
        'AWP S22/city-1',
        'LN P19/city',
        'SAL Q32/city',
        'SOU P23/city',
        'ACL T29/city',
        'FEC W26/city',
        'CG U28/city'
    ])
})

it('values offboards and the coal fields first, second and last by phase', () => {
    const value = (locationId: string, phaseId: string) => {
        const node = EighteenThirtyTwoMap.location(locationId).preprintedTile.nodes[0]
        if (node.kind === 'junction') throw new Error('Expected a revenue location')
        return routeRevenue(node.revenue, revenueStages(phaseId))
    }
    expect(['2', '4', '5', '6', '8', '12'].map((phase) => value('O14', phase))).toEqual([
        30, 30, 50, 50, 60, 60
    ])
    expect(['2', '5', '8'].map((phase) => value('AA28', phase))).toEqual([20, 30, 50])
    expect(['2', '5', '8'].map((phase) => value('O26', phase))).toEqual([40, 60, 60])
    expect(['2', '5', '8'].map((phase) => value('N19', phase))).toEqual([30, 50, 50])
})

it('marks the anchored coastal locations', () => {
    const marked = (id: string) =>
        EighteenThirtyTwoMap.definition.locations
            .filter((location) => location.markers?.some((marker) => marker.id === id))
            .map((location) => location.id)
            .sort()
    expect(marked('port')).toEqual(
        ['AA28', 'O36', 'R33', 'T29', 'U28', 'V15', 'W14', 'W16', 'W22', 'W26', 'Z25'].sort()
    )
})
