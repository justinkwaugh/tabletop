import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import type { SellShares } from '@tabletop/18xx'
import { historyStockSales } from './historyStockSales.js'

function sale(id: string, shares: number, saleBlockId: string): SellShares {
    return {
        id, type: 'SellShares', gameId: 'test', playerId: 'a', source: ActionSource.User,
        seller: { kind: 'player', playerId: 'a' },
        sales: [{ companyId: 'R', shares }], expectedProceeds: shares * 100,
        metadata: {
            saleBlockId, seller: { kind: 'player', playerId: 'a' }, payments: [], proceeds: shares * 100,
            sales: [{ companyId: 'R', shares, price: 100, proceeds: shares * 100,
                certificateIds: [], destinationPoolId: 'market', fromMarketSpaceId: 'a', toMarketSpaceId: 'b' }]
        }
    }
}

it('combines only additions to the same sale block and recalculates a shorter history prefix', () => {
    const actions = [sale('one', 1, 'one'), sale('two', 2, 'one'), sale('three', 1, 'three')]
    const before = structuredClone(actions)
    const blocks = historyStockSales(actions)
    expect(blocks.get('one')).toMatchObject({ firstId: 'one', shares: 3, proceeds: 300 })
    expect(blocks.get('two')).toBe(blocks.get('one'))
    expect(blocks.get('three')).toMatchObject({ firstId: 'three', shares: 1, proceeds: 100 })
    expect(historyStockSales(actions.slice(0, 1)).get('one')?.shares).toBe(1)
    expect(actions).toEqual(before)
})
