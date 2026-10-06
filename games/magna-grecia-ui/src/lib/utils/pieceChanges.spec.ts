import { describe, expect, it } from 'vitest'
import { PointyHexDirection } from '@tabletop/common'
import { HydratedBoard, offsetToAxial } from '@tabletop/magna-grecia'
import { hasPieceChanges, pieceChanges } from './pieceChanges.js'

const row = (col: number) => offsetToAxial({ row: 1, col })
const road = {
    playerId: 'p0',
    coords: row(4),
    ends: [PointyHexDirection.West, PointyHexDirection.East] as [
        PointyHexDirection,
        PointyHexDirection
    ]
}

function board({
    roads = [] as (typeof road)[],
    attention = undefined as string | undefined,
    markets = [] as { playerId: string; sold: boolean }[]
} = {}) {
    return new HydratedBoard({
        roads,
        cities: [{ id: 'C1', playerId: 'p0', spaces: [row(3)] }],
        oracles: [{ coords: row(5), attentionCityId: attention }],
        markets: markets.map((market) => ({ ...market, coords: row(3) })),
        nextCityNumber: 2
    })
}

describe('piece changes', () => {
    it('finds nothing to animate when the pieces are unchanged', () => {
        expect(hasPieceChanges(pieceChanges(board(), board()))).toBe(false)
    })

    it('drops in a placed road and turns the oracle it now connects to the city', () => {
        const changes = pieceChanges(board(), board({ roads: [road], attention: 'C1' }))
        expect(changes.arrivingRoads.map((view) => view.road)).toEqual([road])
        expect(changes.turnedOracles).toHaveLength(1)
        expect(changes.turnedOracles[0].from.attention).toBeUndefined()
        expect(changes.turnedOracles[0].to.attention).toEqual({ playerId: 'p0', angle: 180 })
    })

    it('takes an undone road away and turns the oracle back', () => {
        const changes = pieceChanges(board({ roads: [road], attention: 'C1' }), board())
        expect(changes.leavingRoads).toHaveLength(1)
        expect(changes.turnedOracles[0].to.attention).toBeUndefined()
    })

    it('raises a built market and stamps a sold one', () => {
        const built = pieceChanges(board(), board({ markets: [{ playerId: 'p0', sold: false }] }))
        expect(built.arrivingMarkets).toHaveLength(1)

        const sold = pieceChanges(
            board({ markets: [{ playerId: 'p0', sold: false }] }),
            board({ markets: [{ playerId: 'p0', sold: true }] })
        )
        expect(sold.changedMarkets.map(({ from, to }) => [from.sold, to.sold])).toEqual([
            [false, true]
        ])
    })
})
