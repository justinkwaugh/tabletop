import { describe, expect, it } from 'vitest'
import {
    routeRevenue,
    tilePathsAtEndpoint,
    type MapLocation,
    type TileEdge,
    type TileFace,
    type TrackGauge
} from '@tabletop/18xx'
import { Corporations1849, GaribaldiHomeLocationIds } from './companies.js'
import { Map1849, MessinaLocationId, PortLocationIds } from './map.js'
import { revenueStages1849 } from './trains.js'

const locations = Map1849.definition.locations

function exitGauges(face: TileFace): Map<TileEdge, TrackGauge | 'standard'> {
    return new Map(
        face.paths.flatMap((path) =>
            path.endpoints.flatMap((end) =>
                end.kind === 'edge' ? [[end.edge, path.gauge ?? 'standard'] as const] : []
            )
        )
    )
}

const meets = (a: TrackGauge | 'standard', b: TrackGauge | 'standard') =>
    a === b || a === 'dual' || b === 'dual'

describe('the map', () => {
    it('has every hex of the board once', () => {
        expect(locations).toHaveLength(73)
        expect(new Set(locations.map(({ id }) => id)).size).toBe(locations.length)
    })

    it('runs no printed track off the map, into an impassable side or a blank grey side (§10.3)', () => {
        for (const location of locations)
            for (const [edge, gauge] of exitGauges(location.preprintedTile)) {
                const across = Map1849.across(location.id, edge)
                expect(across, `${location.id} edge ${edge}`).toBeDefined()
                if (!across) continue
                const facing = exitGauges(across.location.preprintedTile).get(across.edge)
                if (facing) expect(meets(gauge, facing), `${location.id} edge ${edge}`).toBe(true)
                else expect(across.location.buildable, `${location.id} edge ${edge}`).toBe(true)
            }
    })

    it('counts the hex northeast of Messina as two, so Calabria is three hexes away (§10.5.1)', () => {
        let location: MapLocation = Map1849.location(MessinaLocationId)
        let exit: TileEdge = 4
        let crossings = 0
        for (;;) {
            const across = Map1849.across(location.id, exit)
            if (!across) throw new Error(`No track across ${location.id} edge ${exit}`)
            crossings++
            location = across.location
            const [path] = tilePathsAtEndpoint(location.preprintedTile, {
                kind: 'edge',
                edge: across.edge
            })
            expect(path.gauge).toBe('dual')
            const onward = path.endpoints.find(
                (end) => !(end.kind === 'edge' && end.edge === across.edge)
            )
            if (onward?.kind !== 'edge') break
            exit = onward.edge
        }
        expect(location.name).toBe('Calabria')
        expect(crossings).toBe(3)
    })

    it('prints the terrain tokens of the components: 9 rough, 7 hills, 16 mountains', () => {
        const count = (cost: number, kind: string) =>
            locations.filter(
                (location) =>
                    location.terrain?.cost === cost && location.terrain.kinds.includes(kind)
            ).length
        expect([count(40, 'rough'), count(80, 'hill'), count(160, 'mountain')]).toEqual([9, 7, 16])
        expect(locations.filter((location) => location.terrain)).toHaveLength(32)
    })

    it('reserves each fixed home, and none for the Garibaldi', () => {
        for (const corporation of Corporations1849) {
            const reserved = Map1849.reservedLocationIds(corporation.id)
            expect(reserved).toEqual(corporation.id === 'AFG' ? [] : corporation.homeLocationIds)
        }
        for (const id of GaribaldiHomeLocationIds)
            expect(
                Map1849.location(id).preprintedTile.nodes.some((node) => node.kind === 'city')
            ).toBe(true)
    })

    it('pays the grey cities and Calabria by phase (§10.5.2)', () => {
        const value = (id: string, phaseId: string) => {
            const node = Map1849.location(id).preprintedTile.nodes[0]
            if (node.kind === 'junction') throw new Error(`${id} has no stop`)
            return routeRevenue(node.revenue, revenueStages1849(phaseId))
        }
        const phases = ['4H', '6H', '8H', '10H', '12H', '16H']
        for (const id of ['C1', 'E1', 'M9'])
            expect(phases.map((phase) => value(id, phase))).toEqual([20, 20, 30, 30, 40, 40])
        expect(phases.map((phase) => value('C15', phase))).toEqual([10, 10, 30, 30, 90, 90])
        expect(PortLocationIds.map((id) => value(id, '4H'))).toEqual([10, 20, 60, 20])
    })

    it('leaves only the grey, red and blue hexes fixed', () => {
        expect(
            locations
                .filter((location) => !location.buildable)
                .map(({ id }) => id)
                .sort()
        ).toEqual(
            ['A13 A15 B16 C1 C9 C13 E1 E13 F12 K13 M9', 'C15', 'A5 L14 N8 a12']
                .join(' ')
                .split(' ')
                .sort()
        )
        expect(Map1849.location('M9').preprintedTile.nodes).toMatchObject([{ stationSlots: 2 }])
    })

    it('places the Milazzo port off the board, next to Milazzo', () => {
        expect(Map1849.across('a12', 5)?.location.name).toBe('Milazzo')
    })
})
