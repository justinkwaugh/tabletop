import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { rotateTileEdge, rotateTileFace, type TileEdge } from '@tabletop/18xx'
import { createMapDrawing, mapBorderCosts } from '@tabletop/18xx-ui'
import { MapView1882 } from './mapView.js'

describe('1882 river costs', () => {
    it('show each river cost until track meets across it, and none after (§11.3.3)', () => {
        const file = JSON.parse(
            readFileSync(new URL('../scenarios/finished-game.json', import.meta.url), 'utf8')
        )
        const scene = createMapDrawing(
            MapView1882.map,
            { tileSet: MapView1882.tileSet, inventory: file.state.tileInventory },
            MapView1882
        )
        const entry = (id: string) => scene.locations.find((other) => other.location.id === id)
        const tracksTo = (id: string, edge: TileEdge) => {
            const drawn = entry(id)
            return (
                !!drawn &&
                rotateTileFace(drawn.face, drawn.rotation).paths.some((path) =>
                    path.endpoints.some((end) => end.kind === 'edge' && end.edge === edge)
                )
            )
        }
        const shown = new Set(mapBorderCosts(scene).map((cost) => cost.key))
        let completed = 0
        let owed = 0
        for (const drawn of scene.locations)
            for (const { start, end, border } of drawn.borders) {
                if (border.kind !== 'water') continue
                const neighbor = MapView1882.map.neighbor(drawn.location.id, border.edge)
                if (!neighbor) continue
                const met =
                    tracksTo(drawn.location.id, border.edge) &&
                    tracksTo(neighbor.id, rotateTileEdge(border.edge, 3))
                const key = `${Math.round(drawn.center.x + (start.x + end.x) / 2)},${Math.round(
                    drawn.center.y + (start.y + end.y) / 2
                )}`
                expect(shown.has(key), `${drawn.location.id} side ${border.edge}`).toBe(!met)
                if (met) completed++
                else owed++
            }
        expect(completed).toBeGreaterThan(0)
        expect(owed).toBeGreaterThan(0)
    })
})
