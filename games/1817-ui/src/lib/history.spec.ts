import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import type { BuyConvertedShare } from '@tabletop/1817'
import { moneyFormat } from '@tabletop/18xx-ui'
import { eighteenSeventeenHistoryDescription } from './history.js'

it('names the pool a converted company’s share was bought from', () => {
    const buy = (poolId?: string): BuyConvertedShare => ({
        id: 'buy',
        gameId: 'history',
        source: ActionSource.User,
        playerId: 'alex',
        type: 'BuyConvertedShare',
        companyId: 'PRR',
        expectedPrice: 80,
        metadata: {
            certificateId: 'PRR:share:3',
            companyId: 'PRR',
            shares: 1,
            buyer: { kind: 'player', playerId: 'alex' },
            seller: { kind: 'company', companyId: 'PRR' },
            ...(poolId ? { poolId } : {}),
            price: 80,
            payments: []
        }
    })
    const describe = (action: BuyConvertedShare) =>
        eighteenSeventeenHistoryDescription(
            action,
            {
                companyName: (id) => id,
                playerName: (id) => id,
                poolName: () => 'Treasury',
                bankName: 'Bank'
            },
            moneyFormat('$'),
            () => ({ text: 'shared' })
        )?.text
    expect(describe(buy('treasury:PRR'))).toBe('Bought a PRR share from Treasury')
    expect(describe(buy())).toBe('Bought a PRR share')
})
