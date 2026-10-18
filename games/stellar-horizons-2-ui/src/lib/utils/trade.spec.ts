import { describe, expect, it } from 'vitest'
import { GoodsHolderKind, TradeGood, type SaleOption } from '@tabletop/stellar-horizons-2'
import { groupGoods, saleSources } from './trade.js'

describe('trade helpers', () => {
    it('groups goods by kind in the order they first appear', () => {
        expect(groupGoods([TradeGood.Ore, TradeGood.Food, TradeGood.Ore])).toEqual([
            { good: TradeGood.Ore, count: 2 },
            { good: TradeGood.Food, count: 1 }
        ])
    })

    it('sells from ships first, then the base', () => {
        const base = { kind: GoodsHolderKind.Base, systemId: 'alpha-centauri' } as const
        const ship = { kind: GoodsHolderKind.Ship, shipId: 'starfarers-andromeda' } as const
        const option: SaleOption = {
            systemId: 'alpha-centauri',
            good: TradeGood.Food,
            price: 2,
            sources: [
                { holder: base, count: 2 },
                { holder: ship, count: 1 }
            ],
            payeeIds: []
        }
        expect(saleSources(option, 2)).toEqual([
            { holder: ship, count: 1 },
            { holder: base, count: 1 }
        ])
    })
})
