import { describe, expect, it } from 'vitest'
import { PointyHexDirection } from '@tabletop/common'
import { HydratedBoard, offsetToAxial } from '@tabletop/magna-grecia'
import { hexCenter } from './boardGeometry.js'
import { marketViews, oracleViews } from './boardView.js'

const row = (col: number) => offsetToAxial({ row: 1, col })

function board() {
    return new HydratedBoard({
        roads: [
            {
                playerId: 'p0',
                coords: row(4),
                ends: [PointyHexDirection.West, PointyHexDirection.East]
            }
        ],
        cities: [{ id: 'C1', playerId: 'p0', spaces: [row(3)] }],
        oracles: [{ coords: row(5), attentionCityId: 'C1' }],
        markets: [
            { playerId: 'p0', coords: row(3), sold: false },
            { playerId: 'p1', coords: row(3), sold: true }
        ],
        nextCityNumber: 2
    })
}

describe('board view', () => {
    it('points an oracle along the road toward the city it favours', () => {
        const hydrated = board()
        const [oracle] = oracleViews(hydrated, hydrated.network())
        expect(oracle.attention).toEqual({ playerId: 'p0', angle: 180 })
    })

    it('lays out each market in its own slot on the place', () => {
        const hydrated = board()
        const views = marketViews(hydrated, hydrated.network())
        expect(views.map((view) => view.sold)).toEqual([false, true])
        expect(views[0].point).not.toEqual(views[1].point)
    })

    it('marks a market active only while it serves one of its owner’s cities', () => {
        const hydrated = board()
        hydrated.markets.push({ playerId: 'p2', coords: row(3), sold: false })
        const views = marketViews(hydrated, hydrated.network())
        expect(views.map((view) => view.active)).toEqual([true, false, false])
    })

    it('keeps each market on its own tile when places merge', () => {
        const hydrated = board()
        hydrated.cities[0].spaces.push(row(2))
        hydrated.markets.push({ playerId: 'p2', coords: row(2), sold: false })
        const views = marketViews(hydrated, hydrated.network())
        const onFirstTile = hexCenter(row(3))
        const onSecondTile = hexCenter(row(2))
        expect(views[0].point.x - onFirstTile.x).toBe(views[2].point.x - onSecondTile.x)
        expect(views[2].point.y - onSecondTile.y).toBe(views[0].point.y - onFirstTile.y)
    })
})
