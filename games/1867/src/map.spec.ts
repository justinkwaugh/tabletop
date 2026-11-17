import { describe, expect, it } from 'vitest'
import { CnId } from './companies.js'
import {
    CnHome,
    DetroitLocationIds,
    GreenCitySpots1867,
    LakePortLocationIds,
    LockedLocationIds1867,
    Map1867,
    MontrealLocationId,
    MontrealNodeIds,
    OttawaLocationId,
    TimminsLocationId,
    TorontoLocationId,
    TorontoNodeIds,
    YellowTileStubs1867
} from './map.js'
import { Phases1867, revenueStages1867 } from './trains.js'

const location = (id: string) => Map1867.location(id)

function offboardValue(id: string, phaseId: string): number {
    const node = location(id).preprintedTile.nodes[0]
    if (node.kind !== 'offboard' || node.revenue.kind !== 'staged') throw new Error(id)
    const stage = revenueStages1867(phaseId).at(-1)
    const value = node.revenue.values.find((entry) => entry.stage === stage)
    if (!value) throw new Error(`${id} has no ${stage} value`)
    return value.amount
}

const cities = (id: string) =>
    location(id).preprintedTile.nodes.filter((node) => node.kind === 'city')
const exits = (id: string, nodeId: string) =>
    location(id)
        .preprintedTile.paths.filter((path) =>
            path.endpoints.some((end) => end.kind === 'node' && end.nodeId === nodeId)
        )
        .flatMap((path) => path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : [])))

describe('the map', () => {
    it('has every hex of the board once', () => {
        const ids = Map1867.definition.locations.map(({ id }) => id)
        expect(ids).toHaveLength(94)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('prints Montreal yellow with three separate cities, the third without track (§7.2.1)', () => {
        const montreal = location(MontrealLocationId)
        expect(montreal.preprintedTile.color).toBe('yellow')
        expect(montreal.preprintedTile.labels).toEqual(['M'])
        expect(cities(MontrealLocationId).map(({ id }) => id)).toEqual(MontrealNodeIds)
        expect(MontrealNodeIds.map((nodeId) => exits(MontrealLocationId, nodeId))).toEqual([
            [1],
            [3],
            []
        ])
        expect(montreal.terrain).toEqual({ cost: 20, kinds: ['water'] })
    })

    it('prints Toronto yellow with two separate cities, the CN in one from setup (§2.H)', () => {
        const toronto = location(TorontoLocationId)
        expect(toronto.preprintedTile.labels).toEqual(['T'])
        expect(cities(TorontoLocationId).map(({ id }) => id)).toEqual([
            TorontoNodeIds.national,
            TorontoNodeIds.open
        ])
        expect(CnHome).toEqual({ locationId: TorontoLocationId, nodeId: TorontoNodeIds.national })
        expect(Map1867.stationReservations()).toEqual([
            { companyId: CnId, nodeId: TorontoNodeIds.national, locationId: TorontoLocationId }
        ])
    })

    it('opens Montreal’s third city and Timmins to minors only from phase 3 (§7.2.1)', () => {
        for (const { locationId, nodeId } of GreenCitySpots1867)
            expect(cities(locationId).map(({ id }) => id)).toContain(nodeId)
        expect(cities(TimminsLocationId)).toMatchObject([
            { kind: 'city', stationSlots: 1, revenue: { kind: 'fixed', amount: 40 } }
        ])
        expect(location(TimminsLocationId).preprintedTile.color).toBe('gray')
    })

    it('values the off-board locations by phase: yellow, green in 3–4, brown in 5–6, grey (§11)', () => {
        const byPhase = (id: string) =>
            Phases1867.phases.map((phase) => offboardValue(id, phase.id))
        expect(byPhase('A7')).toEqual([20, 30, 30, 40, 40, 40, 40])
        expect(byPhase('F18')).toEqual([30, 40, 40, 50, 50, 60, 60])
        expect(byPhase('M15')).toEqual([30, 40, 40, 50, 50, 60, 60])
        expect(byPhase('P8')).toEqual([30, 30, 30, 40, 40, 40, 40])
        expect(byPhase('A19')).toEqual([30, 40, 40, 50, 50, 70, 70])
    })

    it('counts Detroit once across its two hexes, with no track between them', () => {
        expect(new Set(DetroitLocationIds.map((id) => location(id).stopGroup))).toEqual(
            new Set(['Detroit'])
        )
        for (const id of DetroitLocationIds)
            for (const path of location(id).preprintedTile.paths)
                for (const end of path.endpoints)
                    if (end.kind === 'edge')
                        expect(Map1867.across(id, end.edge)?.location.preprintedTile.color).toBe(
                            'white'
                        )
    })

    it('prints two blue lake ports worth $10', () => {
        for (const id of LakePortLocationIds) {
            expect(location(id).preprintedTile.color).toBe('blue')
            expect(location(id).preprintedTile.nodes).toMatchObject([
                { kind: 'offboard', revenue: { kind: 'fixed', amount: 10 } }
            ])
        }
    })

    it('fixes the grey, red and blue hexes', () => {
        const fixed = Map1867.definition.locations.filter((entry) => !entry.buildable)
        expect(fixed.map(({ preprintedTile }) => preprintedTile.color).toSorted()).toEqual(
            [...Array(5).fill('gray'), ...Array(7).fill('red'), ...Array(2).fill('blue')].toSorted()
        )
    })

    it('charges $20 to build in water hexes and $80 to cross a river (§8.6.2)', () => {
        for (const id of ['K11', OttawaLocationId, MontrealLocationId])
            expect(location(id).terrain).toEqual({ cost: 20, kinds: ['water'] })
        expect(location('N8').borders).toEqual([
            { edge: 0, kind: 'water', cost: 80 },
            { edge: 5, kind: 'water', cost: 80 }
        ])
        const rivers = Map1867.definition.locations.flatMap((entry) =>
            (entry.borders ?? []).filter((border) => border.kind === 'water')
        )
        expect(rivers).toHaveLength(10)
        expect(rivers.every((border) => border.cost === 80)).toBe(true)
    })

    it('closes the thick black borders to track (§8.6.1)', () => {
        expect(Map1867.across('D10', 0)).toBeUndefined()
        expect(Map1867.across('C11', 3)).toBeUndefined()
        expect(Map1867.across('D18', 5)).toBeUndefined()
        expect(Map1867.across('E19', 2)).toBeUndefined()
        expect(Map1867.across('E17', 0)?.location.id).toBe('E19')
    })

    it('labels Hamilton, Berlin, Quebec and Ottawa Y, and Ottawa O from grey (§8.6)', () => {
        for (const id of ['E17', 'D16', 'O7', OttawaLocationId])
            expect(location(id).preprintedTile.labels).toEqual(['Y'])
        expect(location(OttawaLocationId).upgradeLabels).toEqual([{ color: 'gray', label: 'O' }])
    })

    it('points each yellow triangle at a neighbouring hex (§8.6.2)', () => {
        expect(Object.keys(YellowTileStubs1867).toSorted()).toEqual(['G15', 'K13', 'L10'])
        for (const [id, edge] of Object.entries(YellowTileStubs1867)) {
            expect(location(id).preprintedTile.color).toBe('white')
            expect(Map1867.across(id, edge)).toBeDefined()
        }
    })

    it('locks Granby until phase 3 (§8.6)', () => {
        expect(LockedLocationIds1867).toEqual(['M13'])
        expect(location('M13').markers?.map(({ id }) => id)).toEqual(['locked'])
    })
})
