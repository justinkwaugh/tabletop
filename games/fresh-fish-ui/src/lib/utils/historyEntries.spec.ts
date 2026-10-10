import { describe, expect, it } from 'vitest'
import { createAction } from '@tabletop/common'
import { DrawTile, EndAuction, GoodsType, PlaceDisk, TileType } from '@tabletop/fresh-fish'
import { auctionedGoodsById, groupByTimeLabel } from './historyEntries.js'

function draw(id: string, goodsType: GoodsType) {
    return createAction(DrawTile, {
        id,
        playerId: 'p1',
        metadata: { chosenTile: { type: TileType.Stall, goodsType } }
    })
}

function endAuction(id: string, goodsType?: GoodsType) {
    return createAction(EndAuction, {
        id,
        winnerId: 'p1',
        highBid: 2,
        metadata: goodsType ? { participants: [], goodsType } : { participants: [] }
    })
}

describe('auctionedGoodsById', () => {
    it('reads the goods recorded on the auction', () => {
        const goods = auctionedGoodsById([
            draw('d', GoodsType.Fish),
            endAuction('e', GoodsType.Cheese)
        ])
        expect(goods.get('e')).toBe(GoodsType.Cheese)
    })

    it('falls back to the draw that opened an auction recorded without its goods', () => {
        const goods = auctionedGoodsById([
            draw('d1', GoodsType.Fish),
            endAuction('e1'),
            draw('d2', GoodsType.IceCream),
            endAuction('e2')
        ])
        expect(goods.get('e1')).toBe(GoodsType.Fish)
        expect(goods.get('e2')).toBe(GoodsType.IceCream)
    })
})

describe('groupByTimeLabel', () => {
    it('groups consecutive actions that share a label', () => {
        const actions = ['a', 'b', 'c', 'd'].map((id) =>
            createAction(PlaceDisk, { id, playerId: 'p1', coords: [0, 0] })
        )
        const labels: Record<string, string> = { a: 'now', b: 'now', c: 'earlier', d: 'now' }
        const groups = groupByTimeLabel(actions, (entry) => labels[entry.id])
        expect(
            groups.map((group) => [group.label, group.actions.map((entry) => entry.id)])
        ).toEqual([
            ['now', ['a', 'b']],
            ['earlier', ['c']],
            ['now', ['d']]
        ])
    })
})
