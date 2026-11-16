import { describe, expect, it } from 'vitest'
import { routeRevenue, rotateTileEdge, type TileFace } from '@tabletop/18xx'
import { CanadaCompanyId, CvId, FlosId, Majors1856, ThbId, WaterlooId } from './companies.js'
import {
    BuffaloLocationIds,
    CanadaCompanyLocationId,
    CanadianWestLocationIds,
    HamiltonLocationId,
    Homes1856,
    KitchenerLocationId,
    LLocationIds,
    LowerCanadaLocationIds,
    Map1856,
    PortLocationIds1856,
    SarniaLocationId,
    TorontoLocationId,
    TorontoSouthNodeId
} from './map.js'
import { Phases1856, revenueStages1856 } from './trains.js'

const location = (id: string) => Map1856.location(id)
const tile = (id: string) => location(id).preprintedTile
const cityCount = (face: TileFace) => face.nodes.filter((node) => node.kind === 'city').length

function valuesByPhase(id: string): number[] {
    const [node] = tile(id).nodes
    if (!node || node.kind === 'junction') throw new Error(`${id} has no stop`)
    return Phases1856.phases.map((phase) => routeRevenue(node.revenue, revenueStages1856(phase.id)))
}

describe('the 1856 map', () => {
    it('has the board’s 100 hexes once each', () => {
        const ids = Map1856.definition.locations.map(({ id }) => id)
        expect(ids).toHaveLength(100)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('names the cities and red areas as the board prints them', () => {
        expect(Map1856.placeName(TorontoLocationId)).toBe('Toronto')
        expect(Map1856.placeName(HamiltonLocationId)).toBe('Hamilton')
        expect(Map1856.placeName(KitchenerLocationId)).toBe('Kitchener')
        expect(Map1856.placeName(SarniaLocationId)).toBe('Sarnia')
        expect(Map1856.placeName('A20')).toBe('Detroit - Windsor')
        expect(BuffaloLocationIds.map((id) => Map1856.placeName(id))).toEqual([
            'Buffalo',
            'Buffalo'
        ])
        expect(Map1856.placeName(CanadaCompanyLocationId)).toBe('H11')
    })

    it('reserves each company’s home city, South Toronto for the CV, and reserves Hamilton for the THB', () => {
        for (const company of Majors1856) {
            expect(Homes1856[company.id]).toBe(company.home)
            expect(Map1856.reservedLocationIds(company.id)).toEqual(
                company.id === ThbId ? [] : [company.home]
            )
        }
        expect(location(TorontoLocationId).reservations).toEqual([
            { companyId: CvId, nodeId: TorontoSouthNodeId }
        ])
        expect(location(HamiltonLocationId).reservations).toBeUndefined()
    })

    it('prints London and Barrie yellow B-L, Toronto yellow T with two cities, and three OO hexes', () => {
        for (const id of ['F15', 'M4']) {
            expect(tile(id).color).toBe('yellow')
            expect(tile(id).labels).toEqual(['B-L'])
            expect(cityCount(tile(id))).toBe(1)
        }
        expect(location('F15').upgradeLabels).toEqual([{ color: 'brown', label: 'Lon' }])
        expect(location('M4').upgradeLabels).toEqual([{ color: 'brown', label: 'Bar' }])
        expect(tile(TorontoLocationId).labels).toEqual(['T'])
        expect(cityCount(tile(TorontoLocationId))).toBe(2)
        for (const id of [HamiltonLocationId, 'N17', KitchenerLocationId]) {
            expect(tile(id).color).toBe('yellow')
            expect(tile(id).labels).toEqual(['OO'])
            expect(cityCount(tile(id))).toBe(2)
            expect(tile(id).paths).toEqual([])
        }
        expect(location(HamiltonLocationId).upgradeLabels).toEqual([{ color: 'gray', label: 'H' }])
    })

    it('marks the L hexes for brown #125', () => {
        const marked = Map1856.definition.locations
            .filter((entry) => entry.upgradeLabels?.some((label) => label.label === 'L'))
            .map((entry) => entry.id)
            .sort()
        expect(marked).toEqual([...LLocationIds].sort())
        for (const id of LLocationIds) expect(cityCount(tile(id))).toBe(1)
    })

    it('charges $40 for mountain and water hexes and Hamilton', () => {
        const costs = Object.fromEntries(
            Map1856.definition.locations.flatMap((entry) =>
                entry.terrain ? [[entry.id, entry.terrain]] : []
            )
        )
        expect(Object.keys(costs).sort()).toEqual(
            ['K10', 'K12', 'K14', 'L15', 'M16', 'N15', 'N19', 'N3', 'P7'].sort()
        )
        for (const terrain of Object.values(costs)) expect(terrain.cost).toBe(40)
        expect(costs.L15.kinds).toEqual(['mountain'])
        expect(costs.N19.kinds).toEqual(['water'])
    })

    it('values the red areas and Goderich by phase: the first value, the second from the 5s, the third from the last phase', () => {
        expect(Phases1856.phases.map((phase) => phase.id)).toEqual([
            '2',
            '3',
            '4',
            '5',
            '6',
            'D',
            '8'
        ])
        expect(valuesByPhase('A20')).toEqual([30, 30, 30, 50, 50, 60, 60])
        expect(valuesByPhase('H5')).toEqual([30, 30, 30, 50, 50, 40, 40])
        expect(valuesByPhase(SarniaLocationId)).toEqual([30, 30, 30, 50, 50, 50, 50])
        expect(valuesByPhase('K2')).toEqual([20, 20, 20, 30, 30, 30, 30])
        expect(valuesByPhase('O2')).toEqual([20, 20, 20, 30, 30, 50, 50])
        expect(valuesByPhase('P17')).toEqual([30, 30, 30, 40, 40, 40, 40])
        expect(valuesByPhase('F9')).toEqual([30, 30, 30, 50, 50, 40, 40])
    })

    it('prints Goderich as a gray small city that track runs through', () => {
        const goderich = location('F9')
        expect(goderich.buildable).toBe(false)
        expect(goderich.preprintedTile.color).toBe('gray')
        expect(goderich.preprintedTile.nodes.map((node) => node.kind)).toEqual(['town'])
        expect(goderich.preprintedTile.paths).toHaveLength(3)
    })

    it('counts each two-hex red area once', () => {
        const groups = new Map<string, string[]>()
        for (const entry of Map1856.definition.locations)
            if (entry.stopGroup)
                groups.set(entry.stopGroup, [...(groups.get(entry.stopGroup) ?? []), entry.id])
        expect(Object.fromEntries(groups)).toEqual({
            'Canadian West': CanadianWestLocationIds,
            'Lower Canada': LowerCanadaLocationIds,
            Buffalo: BuffaloLocationIds
        })
    })

    it('leads every printed track out of a fixed hex onto a hex of the map', () => {
        for (const entry of Map1856.definition.locations) {
            if (entry.buildable) continue
            for (const path of entry.preprintedTile.paths)
                for (const end of path.endpoints) {
                    if (end.kind !== 'edge') continue
                    const neighbor = Map1856.neighbor(entry.id, end.edge)
                    expect(neighbor, `${entry.id} edge ${end.edge}`).toBeDefined()
                    expect(neighbor?.buildable, `${entry.id} edge ${end.edge}`).toBe(true)
                }
        }
        expect(tile('A14').paths).toEqual([])
        expect(location('A14').buildable).toBe(false)
        expect(location('N5').buildable).toBe(false)
    })

    it('joins Toronto’s south city to the lower left and Sarnia to Maudaumin', () => {
        const southTrack = tile(TorontoLocationId).paths.find((path) =>
            path.endpoints.some((end) => end.kind === 'node' && end.nodeId === TorontoSouthNodeId)
        )
        const edge = southTrack?.endpoints.find((end) => end.kind === 'edge')
        expect(edge?.kind === 'edge' && Map1856.neighbor(TorontoLocationId, edge.edge)?.id).toBe(
            'M12'
        )
        expect(Map1856.neighbor(SarniaLocationId, 5)?.id).toBe('C14')
        expect(Map1856.neighbor('C14', rotateTileEdge(5, 3))?.id).toBe(SarniaLocationId)
    })

    it('marks the anchors and the hexes the private companies block', () => {
        const markerIds = (id: string) => (location(id).markers ?? []).map((marker) => marker.id)
        for (const id of PortLocationIds1856) expect(markerIds(id)).toContain('port')
        expect(
            Map1856.definition.locations.filter((entry) => markerIds(entry.id).includes('port'))
        ).toHaveLength(13)
        expect(location('L3').markers?.[0]).toMatchObject({ privateCompanyId: FlosId })
        expect(location(KitchenerLocationId).markers?.[0]).toMatchObject({
            privateCompanyId: WaterlooId
        })
        expect(location(CanadaCompanyLocationId).markers?.[0]).toMatchObject({
            privateCompanyId: CanadaCompanyId
        })
        expect([...Map1856.markedPrivateIds].sort()).toEqual(
            [FlosId, WaterlooId, CanadaCompanyId].sort()
        )
    })
})
