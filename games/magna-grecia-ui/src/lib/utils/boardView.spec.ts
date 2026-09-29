import { describe, expect, it } from 'vitest'
import { PointyHexDirection } from '@tabletop/common'
import { HydratedBoard, offsetToAxial } from '@tabletop/magna-grecia'
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
            { playerId: 'p0', placeId: 'city:C1', sold: false },
            { playerId: 'p1', placeId: 'city:C1', sold: true }
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
        const views = marketViews(board())
        expect(views.map((view) => view.sold)).toEqual([false, true])
        expect(views[0].point).not.toEqual(views[1].point)
    })
})
