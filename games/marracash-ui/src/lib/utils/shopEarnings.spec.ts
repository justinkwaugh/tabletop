import { describe, expect, it } from 'vitest'
import { ShopIds } from '@tabletop/marracash'
import { shopEarnings } from './shopEarnings.js'

const shopId = ShopIds[0]

describe('shop earnings', () => {
    it('nets the mover’s cut out of the owner’s income', () => {
        const entry = { shopId, ownerId: 'owner', customers: 2, income: 500, moverCut: 200 }
        expect(shopEarnings(entry, 'mover')).toEqual([
            { playerId: 'owner', amount: 300 },
            { playerId: 'mover', amount: 200 }
        ])
    })

    it('shows one earning when the mover owns the shop', () => {
        const entry = { shopId, ownerId: 'mover', customers: 1, income: 300, moverCut: 0 }
        expect(shopEarnings(entry, 'mover')).toEqual([{ playerId: 'mover', amount: 300 }])
    })
})
