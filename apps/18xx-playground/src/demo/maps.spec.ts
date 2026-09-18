import { describe, expect, it } from 'vitest'
import { createMapDrawing, mapSelectionPoint, assertMapOverlays } from '@tabletop/18xx-ui'
import { MapExamples } from './maps.js'

describe('complete title maps', () => {
    it.each(Object.values(MapExamples))(
        'preserves location facts and aligns map edges for $map.definition.name',
        (example) => {
            const scene = createMapDrawing(example.map)
            let checkedConnections = 0
            for (const entry of scene.locations) {
                for (const path of entry.drawing.paths) {
                    expect(path.d).not.toMatch(/NaN|Infinity|undefined/)
                    for (const [index, endpoint] of entry.face.paths
                        .find((candidate) => candidate.id === path.id)!
                        .endpoints.entries()) {
                        if (endpoint.kind !== 'edge') continue
                        const neighbor = example.map.neighbor(entry.location.id, endpoint.edge)
                        if (!neighbor) continue
                        checkedConnections++
                        const other = scene.locations.find(
                            (candidate) => candidate.location.id === neighbor.id
                        )!
                        const point = index === 0 ? path.start : path.end
                        expect(entry.center.x + point.x).toBeCloseTo(
                            (entry.center.x + other.center.x) / 2,
                            1
                        )
                        expect(entry.center.y + point.y).toBeCloseTo(
                            (entry.center.y + other.center.y) / 2,
                            1
                        )
                    }
                }
            }
            expect(checkedConnections).toBeGreaterThan(10)
            const prepared = createMapDrawing(example.map, {
                tileSet: example.tileSet,
                inventory: example.prepared
            })
            expect(prepared.locations.filter((entry) => entry.placed)).toHaveLength(1)
            for (const entry of prepared.locations)
                expect(entry.location).toBe(example.map.location(entry.location.id))
            expect(() => assertMapOverlays(prepared, example.tokens, example.routes)).not.toThrow()
            const token = example.tokens[0]
            const point = mapSelectionPoint(prepared, { kind: 'slot', ...token })
            expect(Number.isFinite(point.x + point.y)).toBe(true)
            expect(() => assertMapOverlays(prepared, [{ ...token, slot: 99 }], [])).toThrow('slot')
            expect(() =>
                assertMapOverlays(prepared, [token, { ...token, id: 'duplicate' }], [])
            ).toThrow('Multiple tokens')
        }
    )
    it('includes every location and title-specific printed rule', () => {
        const top = MapExamples.TOP.map
        const shikoku = MapExamples['1889'].map
        expect(top.definition.locations).toHaveLength(110)
        expect(shikoku.definition.locations).toHaveLength(52)
        expect(top.location('G11').preprintedTile.nodes[0]).toMatchObject({
            kind: 'city',
            stationSlots: 0
        })
        expect(top.location('N18').markers?.[0].id).toBe('vernon-river-bridge')
        expect(top.location('L16').upgradeLabels).toEqual([{ color: 'gray', label: 'CX' }])
        expect(shikoku.location('H5').terrain).toEqual({ cost: 80, kinds: ['water', 'mountain'] })
        expect(shikoku.location('I4').terrain?.kinds).toEqual(['urban'])
        expect(
            shikoku.definition.locations.filter((location) =>
                location.markers?.some((marker) => marker.id === 'port')
            )
        ).toHaveLength(4)
        expect(shikoku.location('F1').preprintedTile.nodes[0]).toMatchObject({
            revenue: {
                kind: 'staged',
                values: [
                    { stage: 'yellow', amount: 30 },
                    { stage: 'brown', amount: 60 },
                    { stage: 'diesel', amount: 100 }
                ]
            }
        })
    })
})
